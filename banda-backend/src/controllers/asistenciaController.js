const db = require('../config/db');
const { esIdValido, LIMITES_TEXTO, validarLongitudes } = require('../utils/validaciones');

// Códigos de error de PostgreSQL por formato inválido (fecha, hora, número)
const ERRORES_DE_FORMATO = ['22007', '22008', '22P02'];

// Valida la solicitud y separa las asistencias en válidas y omitidas.
// Válida = alumno activo que pertenece a la banda. Omitida = cualquier otro caso.
// Devuelve { status, error } si la solicitud no se puede procesar, o { validas, omitidos }.
const prepararAsistencias = async (id_banda, asistencias) => {
    if (!esIdValido(id_banda)) {
        return { status: 400, error: 'id_banda es obligatorio y debe ser un número válido' };
    }

    if (asistencias !== undefined && asistencias !== null && !Array.isArray(asistencias)) {
        return { status: 400, error: 'asistencias debe ser un arreglo' };
    }

    const items = asistencias || [];

    for (const item of items) {
        if (!item || !esIdValido(item.id_alumno) || typeof item.asistio !== 'boolean') {
            return { status: 400, error: 'Cada asistencia debe incluir id_alumno (número válido) y asistio (true o false)' };
        }
    }

    const ids = items.map(item => Number(item.id_alumno));
    if (new Set(ids).size !== ids.length) {
        return { status: 400, error: 'Hay alumnos repetidos en asistencias' };
    }

    const banda = await db.query(
        'SELECT 1 FROM public.banda WHERE id_banda = $1 AND activo = true',
        [id_banda]
    );

    if (banda.rowCount === 0) {
        return { status: 400, error: 'La banda no existe o está inactiva' };
    }

    let pertenecen = new Set();
    if (ids.length > 0) {
        const result = await db.query(
            `SELECT a.id_alumno
             FROM public.alumno_banda ab
             INNER JOIN public.alumno a ON a.id_alumno = ab.id_alumno
             WHERE ab.id_banda = $1 AND a.activo = true AND a.id_alumno = ANY($2::int[])`,
            [id_banda, ids]
        );
        pertenecen = new Set(result.rows.map(row => row.id_alumno));
    }

    const validas = items
        .filter(item => pertenecen.has(Number(item.id_alumno)))
        .map(item => ({
            id_alumno: Number(item.id_alumno),
            asistio: item.asistio,
            justificacion: String(item.justificacion ?? '').trim() || null
        }));

    const omitidos = ids.filter(id => !pertenecen.has(id));

    return { validas, omitidos };
};

// Inserta todas las asistencias en un solo INSERT. `tabla` y `columnaEvento` son siempre
// constantes del código (nunca datos del usuario).
const insertarAsistencias = async (client, tabla, columnaEvento, idEvento, validas, idProfesor) => {
    if (validas.length === 0) return;

    await client.query(
        `INSERT INTO public.${tabla} (${columnaEvento}, id_alumno, asistio, justificacion, registrado_por)
         SELECT $1::int, u.id_alumno, u.asistio, u.justificacion, $2::int
         FROM UNNEST($3::int[], $4::bool[], $5::text[]) AS u(id_alumno, asistio, justificacion)`,
        [
            idEvento,
            idProfesor,
            validas.map(v => v.id_alumno),
            validas.map(v => v.asistio),
            validas.map(v => v.justificacion)
        ]
    );
};

// Registrar un Ensayo y guardar la asistencia de la lista de alumnos
const registrarAsistenciaEnsayo = async (req, res) => {
    const body = req.body || {};
    const { id_banda, descripcion, asistencias } = body;
    // asistencias debe ser un arreglo de objetos: [{ id_alumno: 1, asistio: true, justificacion: "opcional" }, ...]
    const id_profesor = req.profesor.id_profesor; // Obtenido del token JWT

    const errorLongitud = validarLongitudes({ lugar: body.lugar }, LIMITES_TEXTO.ensayo);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    let client;
    try {
        const preparado = await prepararAsistencias(id_banda, asistencias);
        if (preparado.error) {
            return res.status(preparado.status).json({ mensaje: preparado.error });
        }

        // fecha, hora y lugar son opcionales: solo se envían si vienen, para respetar los valores por defecto de la tabla
        const columnas = ['id_banda', 'id_profesor', 'descripcion'];
        const valores = [Number(id_banda), id_profesor, descripcion || null];
        for (const campo of ['fecha', 'hora', 'lugar']) {
            if (body[campo] !== undefined && body[campo] !== null && String(body[campo]).trim() !== '') {
                columnas.push(campo);
                valores.push(String(body[campo]).trim());
            }
        }
        const marcadores = valores.map((_, i) => `$${i + 1}`).join(', ');

        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Crear el registro del ensayo
        const ensayoResult = await client.query(
            `INSERT INTO public.ensayo (${columnas.join(', ')}) VALUES (${marcadores}) RETURNING id_ensayo`,
            valores
        );
        const id_ensayo = ensayoResult.rows[0].id_ensayo;

        // 2. Insertar la asistencia de los alumnos válidos
        await insertarAsistencias(client, 'asistencia_ensayo', 'id_ensayo', id_ensayo, preparado.validas, id_profesor);

        await client.query('COMMIT');

        res.status(201).json({
            mensaje: 'Asistencia de ensayo registrada con éxito',
            id_ensayo,
            registrados: preparado.validas.length,
            omitidos: preparado.omitidos
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (ERRORES_DE_FORMATO.includes(error.code)) {
            return res.status(400).json({ mensaje: 'Alguno de los datos (fecha u hora) tiene un formato inválido' });
        }
        console.error('Error al registrar asistencia de ensayo:', error);
        res.status(500).json({ mensaje: 'Error al guardar la asistencia del ensayo' });
    } finally {
        if (client) client.release();
    }
};

// Registrar una Presentación y guardar la asistencia de la lista de alumnos
const registrarAsistenciaPresentacion = async (req, res) => {
    const { id_banda, fecha, lugar_presentacion, descripcion, asistencias } = req.body || {};
    const id_profesor = req.profesor.id_profesor; // Obtenido del token JWT

    if (!fecha || String(fecha).trim() === '') {
        return res.status(400).json({ mensaje: 'La fecha de la presentación es obligatoria' });
    }

    if (!lugar_presentacion || String(lugar_presentacion).trim() === '') {
        return res.status(400).json({ mensaje: 'El lugar de la presentación es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ lugar_presentacion }, LIMITES_TEXTO.presentacion);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    let client;
    try {
        const preparado = await prepararAsistencias(id_banda, asistencias);
        if (preparado.error) {
            return res.status(preparado.status).json({ mensaje: preparado.error });
        }

        client = await db.getClient();
        await client.query('BEGIN');

        // 1. Crear la presentación
        const presResult = await client.query(
            'INSERT INTO public.presentacion (fecha, lugar_presentacion, id_banda, descripcion) VALUES ($1, $2, $3, $4) RETURNING id_presentacion',
            [String(fecha).trim(), String(lugar_presentacion).trim(), Number(id_banda), descripcion || null]
        );
        const id_presentacion = presResult.rows[0].id_presentacion;

        // 2. Insertar la asistencia de los alumnos válidos
        await insertarAsistencias(client, 'asistencia_presentacion', 'id_presentacion', id_presentacion, preparado.validas, id_profesor);

        await client.query('COMMIT');

        res.status(201).json({
            mensaje: 'Asistencia de presentación registrada con éxito',
            id_presentacion,
            registrados: preparado.validas.length,
            omitidos: preparado.omitidos
        });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        if (ERRORES_DE_FORMATO.includes(error.code)) {
            return res.status(400).json({ mensaje: 'La fecha tiene un formato inválido' });
        }
        console.error('Error al registrar asistencia de presentación:', error);
        res.status(500).json({ mensaje: 'Error al guardar la asistencia de la presentación' });
    } finally {
        if (client) client.release();
    }
};

// Porcentaje de asistencia por alumno y banda, según vista_asistencia_alumno
const getPorcentajeAsistencia = async (req, res) => {
    const { id_alumno, id_banda } = req.query;

    if (id_alumno !== undefined && !esIdValido(id_alumno)) {
        return res.status(400).json({ mensaje: 'id_alumno debe ser un número válido' });
    }

    if (id_banda !== undefined && !esIdValido(id_banda)) {
        return res.status(400).json({ mensaje: 'id_banda debe ser un número válido' });
    }

    const conditions = [];
    const params = [];

    if (id_alumno !== undefined) {
        params.push(id_alumno);
        conditions.push(`v.id_alumno = $${params.length}`);
    }

    if (id_banda !== undefined) {
        params.push(id_banda);
        conditions.push(`v.id_banda = $${params.length}`);
    }

    const where = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';

    try {
        // La vista no filtra por activo: si se pide un alumno o una banda concretos, deben existir y estar activos
        const inactivo = await Promise.all([
            id_alumno !== undefined
                ? db.query('SELECT 1 FROM public.alumno WHERE id_alumno = $1 AND activo = true', [id_alumno])
                : null,
            id_banda !== undefined
                ? db.query('SELECT 1 FROM public.banda WHERE id_banda = $1 AND activo = true', [id_banda])
                : null
        ]).then(resultados => resultados.some(r => r !== null && r.rowCount === 0));

        if (inactivo) {
            return res.status(404).json({ mensaje: 'Alumno o banda no encontrados o inactivos' });
        }

        // El join con alumno y banda descarta las filas de alumnos o bandas desactivados
        const result = await db.query(
            `SELECT
                v.id_alumno,
                v.alumno_nombre,
                v.id_banda,
                v.nombre_banda,
                v.total_eventos::int AS total_eventos,
                v.total_asistencias::int AS total_asistencias,
                v.porcentaje_asistencia::float8 AS porcentaje_asistencia,
                v.porcentaje_minimo_requerido::float8 AS porcentaje_minimo_requerido,
                COALESCE(v.total_eventos > 0 AND v.porcentaje_asistencia < v.porcentaje_minimo_requerido, false) AS en_riesgo
             FROM public.vista_asistencia_alumno v
             INNER JOIN public.alumno a ON a.id_alumno = v.id_alumno
             INNER JOIN public.banda b ON b.id_banda = v.id_banda
             WHERE a.activo = true AND b.activo = true
             ${where}
             ORDER BY v.nombre_banda ASC, v.alumno_nombre ASC`,
            params
        );

        res.json({
            total: result.rows.length,
            filtros: { id_alumno: id_alumno || null, id_banda: id_banda || null },
            datos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener porcentaje de asistencia:', error);
        res.status(500).json({ mensaje: 'Error al obtener el porcentaje de asistencia' });
    }
};

module.exports = {
    registrarAsistenciaEnsayo,
    registrarAsistenciaPresentacion,
    getPorcentajeAsistencia
};
