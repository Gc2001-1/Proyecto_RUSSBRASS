const db = require('../config/db');
const { esIdValido, esAdmin } = require('../utils/validaciones');

// Historial de asistencia: ensayos y presentaciones unidos con las mismas columnas.
// Los datos que solo existen en un tipo de evento (id_profesor, hora) salen como NULL en el otro.
const HISTORIAL_ASISTENCIA = `
    SELECT
        a.id_alumno,
        a.nombre AS alumno,
        b.id_banda,
        b.nombre_banda,
        e.id_ensayo AS id_evento,
        COALESCE(e.descripcion, 'Sin descripción') AS descripcion,
        e.id_profesor,
        ae.asistio,
        ae.justificacion,
        ae.registrado_por,
        e.fecha,
        e.hora::text AS hora,
        e.lugar AS lugar,
        'ensayo' AS tipo_evento
    FROM public.asistencia_ensayo ae
    INNER JOIN public.ensayo e ON ae.id_ensayo = e.id_ensayo
    INNER JOIN public.alumno a ON ae.id_alumno = a.id_alumno
    INNER JOIN public.banda b ON e.id_banda = b.id_banda

    UNION ALL

    SELECT
        a.id_alumno,
        a.nombre AS alumno,
        b.id_banda,
        b.nombre_banda,
        p.id_presentacion AS id_evento,
        COALESCE(p.descripcion, 'Sin descripción') AS descripcion,
        NULL::int AS id_profesor,
        ap.asistio,
        ap.justificacion,
        ap.registrado_por,
        p.fecha,
        NULL::text AS hora,
        p.lugar_presentacion AS lugar,
        'presentacion' AS tipo_evento
    FROM public.asistencia_presentacion ap
    INNER JOIN public.presentacion p ON ap.id_presentacion = p.id_presentacion
    INNER JOIN public.alumno a ON ap.id_alumno = a.id_alumno
    INNER JOIN public.banda b ON p.id_banda = b.id_banda
`;

// Un Admin ve todas las bandas. Un Profesor solo las bandas en las que está asignado (profesor_banda),
// sin importar qué id_banda mande en la consulta: un id_banda ajeno simplemente no devuelve datos.
const BANDAS_DEL_PROFESOR = (parametro) =>
    `(SELECT pb.id_banda FROM public.profesor_banda pb WHERE pb.id_profesor = $${parametro})`;

const getHistorialAsistencia = async (req, res) => {
    const { id_alumno, id_banda, fecha, tipo } = req.query;

    if (id_alumno !== undefined && !esIdValido(id_alumno)) {
        return res.status(400).json({ mensaje: 'id_alumno debe ser un número válido' });
    }

    if (id_banda !== undefined && !esIdValido(id_banda)) {
        return res.status(400).json({ mensaje: 'id_banda debe ser un número válido' });
    }

    if (fecha !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
        return res.status(400).json({ mensaje: 'fecha debe tener el formato AAAA-MM-DD' });
    }

    if (tipo !== undefined && !['ensayo', 'presentacion'].includes(String(tipo).toLowerCase())) {
        return res.status(400).json({ mensaje: 'tipo debe ser "ensayo" o "presentacion"' });
    }

    const conditions = [];
    const params = [];

    if (!esAdmin(req)) {
        params.push(req.profesor?.id_profesor);
        conditions.push(`h.id_banda IN ${BANDAS_DEL_PROFESOR(params.length)}`);
    }

    if (id_alumno) {
        conditions.push(`h.id_alumno = $${params.length + 1}`);
        params.push(id_alumno);
    }

    if (id_banda) {
        conditions.push(`h.id_banda = $${params.length + 1}`);
        params.push(id_banda);
    }

    if (fecha) {
        conditions.push(`h.fecha = $${params.length + 1}::date`);
        params.push(fecha);
    }

    if (tipo) {
        conditions.push(`h.tipo_evento = $${params.length + 1}`);
        params.push(String(tipo).toLowerCase());
    }

    // La fecha se devuelve como texto AAAA-MM-DD (no como Date con hora y zona horaria)
    let query = `
        SELECT h.id_alumno, h.alumno, h.id_banda, h.nombre_banda, h.id_evento, h.descripcion,
               h.id_profesor, h.asistio, h.justificacion, h.registrado_por,
               TO_CHAR(h.fecha, 'YYYY-MM-DD') AS fecha,
               h.hora, h.lugar, h.tipo_evento
        FROM (${HISTORIAL_ASISTENCIA}) h`;

    if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY h.fecha DESC, h.tipo_evento ASC, h.id_evento DESC, h.alumno ASC`;

    try {
        const result = await db.query(query, params);
        res.json({
            total: result.rows.length,
            filtros: { id_alumno: id_alumno || null, id_banda: id_banda || null, fecha: fecha || null, tipo: tipo || null },
            datos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({ mensaje: 'Error al obtener el historial de asistencia' });
    }
};

// Resumen por banda: cuenta registros reales de asistencia_ensayo de los ensayos de cada banda.
// Un Profesor solo ve las bandas en las que está asignado.
const getResumenPorBanda = async (req, res) => {
    const params = [];
    let filtroProfesor = '';

    if (!esAdmin(req)) {
        params.push(req.profesor?.id_profesor);
        filtroProfesor = `AND b.id_banda IN ${BANDAS_DEL_PROFESOR(params.length)}`;
    }

    try {
        const result = await db.query(`
            SELECT
                b.id_banda,
                b.nombre_banda,
                (
                    SELECT COUNT(*)::int
                    FROM public.alumno_banda ab
                    INNER JOIN public.alumno a ON a.id_alumno = ab.id_alumno
                    WHERE ab.id_banda = b.id_banda AND a.activo = true
                ) AS total_alumnos,
                (
                    SELECT COUNT(*)::int
                    FROM public.asistencia_ensayo ae
                    INNER JOIN public.ensayo e ON e.id_ensayo = ae.id_ensayo
                    WHERE e.id_banda = b.id_banda AND ae.asistio = true
                ) AS asistencias,
                (
                    SELECT COUNT(*)::int
                    FROM public.asistencia_ensayo ae
                    INNER JOIN public.ensayo e ON e.id_ensayo = ae.id_ensayo
                    WHERE e.id_banda = b.id_banda AND ae.asistio = false
                ) AS faltas
            FROM public.banda b
            WHERE b.activo = true ${filtroProfesor}
            ORDER BY b.nombre_banda ASC
        `, params);

        res.json({
            total_bandas: result.rows.length,
            datos: result.rows
        });
    } catch (error) {
        console.error('Error al obtener resumen por banda:', error);
        res.status(500).json({ mensaje: 'Error al obtener el resumen por banda' });
    }
};

// Resumen general: un conteo independiente por tabla (sin JOINs entre ellas). Solo Admin (se controla en la ruta).
const getResumenGeneral = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT
                (SELECT COUNT(*)::int FROM public.alumno WHERE activo = true) AS total_alumnos,
                (SELECT COUNT(*)::int FROM public.banda WHERE activo = true) AS total_bandas,
                (SELECT COUNT(*)::int FROM public.profesor WHERE activo = true) AS total_profesores,
                (SELECT COUNT(*)::int FROM public.ensayo) AS total_ensayos
        `);

        res.json({ resumen: result.rows[0] });
    } catch (error) {
        console.error('Error al obtener resumen general:', error);
        res.status(500).json({ mensaje: 'Error al obtener el resumen general' });
    }
};

module.exports = {
    getHistorialAsistencia,
    getResumenPorBanda,
    getResumenGeneral
};
