const db = require('../config/db');
const { esIdValido, esAdmin, puedeVerInactivos, LIMITES_TEXTO, validarLongitudes } = require('../utils/validaciones');

// Columnas del alumno que se devuelven al crearlo o reactivarlo. La fecha sale como texto AAAA-MM-DD.
const COLUMNAS_ALUMNO = `id_alumno, nombre, telefono, direccion, TO_CHAR(fecha_inscripcion, 'YYYY-MM-DD') AS fecha_inscripcion, activo`;

// Alumnos con sus bandas. Por defecto solo activos (alumnos y bandas); con `verInactivos`
// se incluyen también los inactivos y cada uno trae su campo `activo`.
// `filtro` agrega una condición extra al WHERE.
const consultaAlumnos = ({ verInactivos = false, filtro = '' } = {}) => {
    const condiciones = [];
    if (!verInactivos) condiciones.push('a.activo = true');
    if (filtro) condiciones.push(filtro);
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    return `
      SELECT
        a.id_alumno,
        a.nombre,
        a.telefono,
        a.direccion,
        TO_CHAR(a.fecha_inscripcion, 'YYYY-MM-DD') AS fecha_inscripcion,
        a.activo,
        COALESCE(
          json_agg(
            json_build_object('id_banda', b.id_banda, 'nombre_banda', b.nombre_banda, 'activo', b.activo)
          ) FILTER (WHERE b.id_banda IS NOT NULL), '[]'
        ) AS bandas
      FROM public.alumno a
      LEFT JOIN public.alumno_banda ab ON a.id_alumno = ab.id_alumno
      LEFT JOIN public.banda b ON ab.id_banda = b.id_banda ${verInactivos ? '' : 'AND b.activo = true'}
      ${where}
      GROUP BY a.id_alumno
      ORDER BY a.nombre ASC;
    `;
};

// Texto opcional tal como se guarda: sin espacios al inicio ni al final, y vacío o ausente = NULL
const textoOpcional = (valor) => (valor === undefined || valor === null ? null : String(valor).trim() || null);

// Un teléfono enviado (no vacío) debe tener al menos 8 caracteres
const telefonoInvalido = (telefono) => {
    return Boolean(telefono) && String(telefono).trim() !== '' && String(telefono).trim().length < 8;
};

// Valida la lista de bandas recibida. Devuelve { ids } (ids === null si no se envió la lista)
// o { error, bandas_invalidas } cuando algún id no es válido, no existe o la banda está inactiva.
const validarBandas = async (bandas) => {
    if (bandas === undefined || bandas === null) {
        return { ids: null };
    }

    if (!Array.isArray(bandas)) {
        return { error: 'El campo bandas debe ser un arreglo de IDs de banda', bandas_invalidas: [] };
    }

    const mal = bandas.filter(id => !esIdValido(id));
    if (mal.length > 0) {
        return { error: `IDs de banda no válidos: ${mal.join(', ')}`, bandas_invalidas: mal };
    }

    const ids = [...new Set(bandas.map(Number))];
    if (ids.length === 0) {
        return { ids };
    }

    const result = await db.query(
        'SELECT id_banda FROM public.banda WHERE id_banda = ANY($1::int[]) AND activo = true',
        [ids]
    );
    const existentes = new Set(result.rows.map(r => r.id_banda));
    const faltantes = ids.filter(id => !existentes.has(id));

    if (faltantes.length > 0) {
        return {
            error: `No existe o está inactiva la banda con ID: ${faltantes.join(', ')}`,
            bandas_invalidas: faltantes
        };
    }

    return { ids };
};

// Un Admin siempre tiene acceso. Un Profesor solo si está asignado (profesor_banda)
// a al menos una de las bandas indicadas. Es el mismo criterio que tieneAccesoABanda,
// pero contra varias bandas posibles.
const tieneAccesoAAlgunaBanda = async (req, idsBanda) => {
    if (esAdmin(req)) return true;
    if (!idsBanda || idsBanda.length === 0) return false;

    const result = await db.query(
        'SELECT 1 FROM public.profesor_banda WHERE id_profesor = $1 AND id_banda = ANY($2::int[]) LIMIT 1',
        [req.profesor?.id_profesor, idsBanda]
    );

    return result.rowCount > 0;
};

// Bandas de la lista que un Profesor NO puede agregar al alumno: no las tiene asignadas (profesor_banda)
// y el alumno todavía no pertenece a ellas. Las bandas que el alumno ya tiene no cuentan: dejarlas
// en la lista no las modifica, así que no requieren permiso.
const bandasAjenasPorAgregar = async (req, idAlumno, idsBanda) => {
    const result = await db.query(
        `SELECT b.id_banda, b.nombre_banda
         FROM public.banda b
         WHERE b.id_banda = ANY($3::int[])
           AND NOT EXISTS (SELECT 1 FROM public.alumno_banda ab WHERE ab.id_alumno = $1 AND ab.id_banda = b.id_banda)
           AND NOT EXISTS (SELECT 1 FROM public.profesor_banda pb WHERE pb.id_profesor = $2 AND pb.id_banda = b.id_banda)
         ORDER BY b.nombre_banda`,
        [idAlumno, req.profesor?.id_profesor, idsBanda]
    );
    return result.rows;
};

// Para editar o eliminar un alumno existente: un Profesor debe estar asignado a al menos una de las
// bandas actuales del alumno (alumno_banda). Devuelve null si puede continuar, o { status, mensaje }.
// Un Admin pasa siempre; si el alumno no existe, la propia operación responde 404.
const verificarAccesoAlumno = async (req, id) => {
    if (esAdmin(req)) return null;

    const result = await db.query(
        `SELECT EXISTS (
            SELECT 1
            FROM public.alumno_banda ab
            INNER JOIN public.profesor_banda pb ON pb.id_banda = ab.id_banda
            WHERE ab.id_alumno = a.id_alumno AND pb.id_profesor = $2
         ) AS permitido
         FROM public.alumno a
         WHERE a.id_alumno = $1 AND a.activo = true`,
        [id, req.profesor?.id_profesor]
    );

    if (result.rows.length === 0) {
        return { status: 404, mensaje: 'Alumno no encontrado' };
    }

    if (!result.rows[0].permitido) {
        return { status: 403, mensaje: 'No tienes acceso a este alumno' };
    }

    return null;
};

// Obtener todos los alumnos con las bandas a las que pertenecen
const getAlumnos = async (req, res) => {
    try {
        const result = await db.query(consultaAlumnos({ verInactivos: puedeVerInactivos(req) }));
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener alumnos:', error);
        res.status(500).json({ mensaje: 'Error al obtener lista de alumnos' });
    }
};

// Crear un nuevo alumno y asignarlo a 1 o más bandas
const createAlumno = async (req, res) => {
    const { nombre, telefono, direccion, bandas } = req.body || {};

    if (!nombre || String(nombre).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre del alumno es obligatorio' });
    }

    if (telefonoInvalido(telefono)) {
        return res.status(400).json({ mensaje: 'El teléfono debe tener al menos 8 caracteres' });
    }

    const errorLongitud = validarLongitudes({ nombre, telefono, direccion }, LIMITES_TEXTO.alumno);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    let client;
    try {
        const validacion = await validarBandas(bandas);
        if (validacion.error) {
            return res.status(400).json({ mensaje: validacion.error, bandas_invalidas: validacion.bandas_invalidas });
        }

        // Un Profesor que asigna bandas debe estar asignado a al menos una de ellas.
        // Sin bandas cualquier profesor puede crear el alumno.
        if (validacion.ids && validacion.ids.length > 0 && !(await tieneAccesoAAlgunaBanda(req, validacion.ids))) {
            return res.status(403).json({ mensaje: 'No tienes acceso a ninguna de las bandas indicadas' });
        }

        // Transacción real: todas las consultas van por el mismo cliente
        client = await db.getClient();
        await client.query('BEGIN');

        const alumnoResult = await client.query(
            `INSERT INTO public.alumno (nombre, telefono, direccion) VALUES ($1, $2, $3) RETURNING ${COLUMNAS_ALUMNO}`,
            [String(nombre).trim(), textoOpcional(telefono), textoOpcional(direccion)]
        );

        const nuevoAlumno = alumnoResult.rows[0];

        if (validacion.ids && validacion.ids.length > 0) {
            await client.query(
                'INSERT INTO public.alumno_banda (id_alumno, id_banda) SELECT $1::int, UNNEST($2::int[])',
                [nuevoAlumno.id_alumno, validacion.ids]
            );
        }

        await client.query('COMMIT');
        res.status(201).json({ mensaje: 'Alumno registrado con éxito', alumno: nuevoAlumno });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al crear alumno:', error);
        res.status(500).json({ mensaje: 'Error al registrar el alumno' });
    } finally {
        if (client) client.release();
    }
};

// Eliminar un alumno (soft delete: se marca como inactivo y se conserva su historial de asistencia)
const deleteAlumno = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del alumno no es válido' });
    }

    try {
        const sinAcceso = await verificarAccesoAlumno(req, id);
        if (sinAcceso) {
            return res.status(sinAcceso.status).json({ mensaje: sinAcceso.mensaje });
        }

        // Una sola sentencia UPDATE ya es atómica, no necesita transacción
        const result = await db.query(
            'UPDATE public.alumno SET activo = false WHERE id_alumno = $1 AND activo = true RETURNING id_alumno',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: 'Alumno no encontrado' });
        }

        res.json({ mensaje: 'Alumno eliminado correctamente' });
    } catch (error) {
        console.error('Error al eliminar alumno:', error);
        res.status(500).json({ mensaje: 'Error al eliminar el alumno' });
    }
};

// Reactivar un alumno eliminado (solo Admin, se controla en la ruta).
// Recupera sus membresías e historial de asistencia, que el soft delete no toca.
const reactivarAlumno = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del alumno no es válido' });
    }

    try {
        const result = await db.query(
            `UPDATE public.alumno SET activo = true WHERE id_alumno = $1 AND activo = false RETURNING ${COLUMNAS_ALUMNO}`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Alumno no encontrado o ya estaba activo' });
        }

        res.json({ mensaje: 'Alumno reactivado correctamente', alumno: result.rows[0] });
    } catch (error) {
        console.error('Error al reactivar alumno:', error);
        res.status(500).json({ mensaje: 'Error al reactivar el alumno' });
    }
};

// Actualizar un alumno. Solo se modifican los campos que vienen en el body:
// telefono y direccion se conservan si no se envían (enviarlos vacíos o en null los borra),
// y las membresías (`bandas`) se reemplazan solo si se envía la lista.
// Un Admin puede agregar o quitar cualquier banda. Un Profesor solo puede agregar o quitar las bandas
// que tiene asignadas: las demás bandas del alumno se conservan intactas, vengan o no en la lista.
const updateAlumno = async (req, res) => {
    const { id } = req.params;
    const { nombre, telefono, direccion, bandas } = req.body || {};

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del alumno no es válido' });
    }

    if (!nombre || String(nombre).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre del alumno es obligatorio' });
    }

    if (telefonoInvalido(telefono)) {
        return res.status(400).json({ mensaje: 'El teléfono debe tener al menos 8 caracteres' });
    }

    const errorLongitud = validarLongitudes({ nombre, telefono, direccion }, LIMITES_TEXTO.alumno);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    let client;
    try {
        const sinAcceso = await verificarAccesoAlumno(req, id);
        if (sinAcceso) {
            return res.status(sinAcceso.status).json({ mensaje: sinAcceso.mensaje });
        }

        const validacion = await validarBandas(bandas);
        if (validacion.error) {
            return res.status(400).json({ mensaje: validacion.error, bandas_invalidas: validacion.bandas_invalidas });
        }

        // Un Profesor no puede agregar una banda que no tiene asignada
        if (!esAdmin(req) && validacion.ids && validacion.ids.length > 0) {
            const ajenas = await bandasAjenasPorAgregar(req, id, validacion.ids);
            if (ajenas.length > 0) {
                const nombres = ajenas.map(b => `"${b.nombre_banda}"`);
                const mensaje = ajenas.length === 1
                    ? `No puedes modificar la banda ${nombres[0]} porque no está asignada a ti`
                    : `No puedes modificar las bandas ${nombres.join(', ')} porque no están asignadas a ti`;
                return res.status(403).json({ mensaje, bandas_no_permitidas: ajenas.map(b => b.id_banda) });
            }
        }

        const campos = ['nombre = $1'];
        const params = [String(nombre).trim()];

        if (telefono !== undefined) {
            params.push(textoOpcional(telefono));
            campos.push(`telefono = $${params.length}`);
        }

        if (direccion !== undefined) {
            params.push(textoOpcional(direccion));
            campos.push(`direccion = $${params.length}`);
        }

        params.push(id);

        client = await db.getClient();
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE public.alumno SET ${campos.join(', ')} WHERE id_alumno = $${params.length} AND activo = true RETURNING id_alumno`,
            params
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'Alumno no encontrado' });
        }

        let bandasSinModificar = [];

        if (validacion.ids !== null) {
            const soloPropias = !esAdmin(req);
            const idProfesor = req.profesor?.id_profesor;

            if (soloPropias) {
                // Bandas del alumno que no son del Profesor y no vienen en la lista: se conservan
                const conservadas = await client.query(
                    `SELECT b.id_banda, b.nombre_banda
                     FROM public.alumno_banda ab
                     INNER JOIN public.banda b ON b.id_banda = ab.id_banda
                     WHERE ab.id_alumno = $1
                       AND NOT (ab.id_banda = ANY($2::int[]))
                       AND NOT EXISTS (SELECT 1 FROM public.profesor_banda pb WHERE pb.id_profesor = $3 AND pb.id_banda = ab.id_banda)
                     ORDER BY b.nombre_banda`,
                    [id, validacion.ids, idProfesor]
                );
                bandasSinModificar = conservadas.rows;
            }

            // Quita solo las bandas que ya no están en la lista y agrega las nuevas, así las membresías
            // que se mantienen conservan su fecha_ingreso. Un Profesor solo puede quitar bandas suyas.
            await client.query(
                `DELETE FROM public.alumno_banda
                 WHERE id_alumno = $1 AND NOT (id_banda = ANY($2::int[]))
                 ${soloPropias ? 'AND id_banda IN (SELECT id_banda FROM public.profesor_banda WHERE id_profesor = $3)' : ''}`,
                soloPropias ? [id, validacion.ids, idProfesor] : [id, validacion.ids]
            );

            if (validacion.ids.length > 0) {
                await client.query(
                    'INSERT INTO public.alumno_banda (id_alumno, id_banda) SELECT $1::int, UNNEST($2::int[]) ON CONFLICT DO NOTHING',
                    [id, validacion.ids]
                );
            }
        }

        await client.query('COMMIT');

        const respuesta = { mensaje: 'Alumno actualizado correctamente' };
        if (bandasSinModificar.length > 0) {
            // Bandas ajenas del alumno que el Profesor no puede tocar y que se dejaron como estaban
            respuesta.bandas_sin_modificar = bandasSinModificar;
        }
        res.json(respuesta);
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al actualizar alumno:', error);
        res.status(500).json({ mensaje: 'Error al actualizar el alumno' });
    } finally {
        if (client) client.release();
    }
};

// Obtener un alumno por su ID
const getAlumnoById = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del alumno no es válido' });
    }

    try {
        const result = await db.query(
            consultaAlumnos({ verInactivos: puedeVerInactivos(req), filtro: 'a.id_alumno = $1' }),
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Alumno no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener el alumno:', error);
        res.status(500).json({ mensaje: 'Error al obtener el alumno' });
    }
};


module.exports = {
    getAlumnos,
    createAlumno,
    deleteAlumno,
    reactivarAlumno,
    updateAlumno,
    getAlumnoById
};
