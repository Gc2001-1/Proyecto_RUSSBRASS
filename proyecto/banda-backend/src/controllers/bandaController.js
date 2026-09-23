const db = require('../config/db');
const { esIdValido, puedeVerInactivos, LIMITES_TEXTO, validarLongitudes } = require('../utils/validaciones');

const TIPOS_BANDA = ['paz', 'clasica', 'orquesta'];
const MENSAJE_TIPO = 'El tipo de banda es obligatorio y debe ser: paz, clasica u orquesta';

const normalizarTipo = (tipo) => String(tipo ?? '').trim().toLowerCase();

const getBandas = async (req, res) => {
    try {
        const filtro = puedeVerInactivos(req) ? '' : 'WHERE activo = true';
        const result = await db.query(
            `SELECT id_banda, nombre_banda, tipo, descripcion, activo FROM public.banda ${filtro} ORDER BY nombre_banda ASC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener bandas:', error);
        res.status(500).json({ mensaje: 'Error al obtener la lista de bandas' });
    }
};

const getBandaById = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la banda no es válido' });
    }

    try {
        const filtro = puedeVerInactivos(req) ? '' : 'AND activo = true';
        const result = await db.query(
            `SELECT id_banda, nombre_banda, tipo, descripcion, activo FROM public.banda WHERE id_banda = $1 ${filtro}`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Banda no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener la banda:', error);
        res.status(500).json({ mensaje: 'Error al obtener la banda' });
    }
};

const createBanda = async (req, res) => {
    const { nombre_banda, tipo, descripcion } = req.body || {};

    if (!nombre_banda || String(nombre_banda).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre de la banda es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ nombre_banda }, LIMITES_TEXTO.banda);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    const tipoBanda = normalizarTipo(tipo);
    if (!TIPOS_BANDA.includes(tipoBanda)) {
        return res.status(400).json({ mensaje: MENSAJE_TIPO });
    }

    try {
        const existe = await db.query(
            'SELECT id_banda, activo FROM public.banda WHERE LOWER(nombre_banda) = LOWER($1)',
            [String(nombre_banda).trim()]
        );

        if (existe.rows.length > 0) {
            const mensaje = existe.rows[0].activo === false
                ? 'Existe una banda eliminada con ese nombre'
                : 'La banda ya existe';
            return res.status(409).json({ mensaje });
        }

        const result = await db.query(
            'INSERT INTO public.banda (nombre_banda, tipo, descripcion) VALUES ($1, $2, $3) RETURNING id_banda, nombre_banda, tipo, descripcion',
            [String(nombre_banda).trim(), tipoBanda, descripcion ? String(descripcion).trim() : null]
        );

        res.status(201).json({
            mensaje: 'Banda creada correctamente',
            banda: result.rows[0]
        });
    } catch (error) {
        // 23505: violación de UNIQUE (dos solicitudes simultáneas con el mismo nombre)
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'La banda ya existe' });
        }
        console.error('Error al crear la banda:', error);
        res.status(500).json({ mensaje: 'Error al crear la banda' });
    }
};

const updateBanda = async (req, res) => {
    const { id } = req.params;
    const { nombre_banda, tipo, descripcion } = req.body || {};

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la banda no es válido' });
    }

    if (!nombre_banda || String(nombre_banda).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre de la banda es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ nombre_banda }, LIMITES_TEXTO.banda);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    const tipoBanda = normalizarTipo(tipo);
    if (!TIPOS_BANDA.includes(tipoBanda)) {
        return res.status(400).json({ mensaje: MENSAJE_TIPO });
    }

    try {
        const existe = await db.query(
            'SELECT id_banda FROM public.banda WHERE LOWER(nombre_banda) = LOWER($1) AND id_banda <> $2',
            [String(nombre_banda).trim(), id]
        );

        if (existe.rows.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe otra banda con ese nombre' });
        }

        // Si no se envía descripcion se conserva la actual (COALESCE con NULL)
        const result = await db.query(
            `UPDATE public.banda
             SET nombre_banda = $1, tipo = $2, descripcion = COALESCE($3, descripcion)
             WHERE id_banda = $4 AND activo = true
             RETURNING id_banda, nombre_banda, tipo, descripcion`,
            [
                String(nombre_banda).trim(),
                tipoBanda,
                descripcion === undefined || descripcion === null ? null : String(descripcion).trim(),
                id
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Banda no encontrada' });
        }

        res.json({
            mensaje: 'Banda actualizada correctamente',
            banda: result.rows[0]
        });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'Ya existe otra banda con ese nombre' });
        }
        console.error('Error al actualizar la banda:', error);
        res.status(500).json({ mensaje: 'Error al actualizar la banda' });
    }
};

// Soft delete: la banda se desactiva y conserva sus ensayos, presentaciones y membresías
const deleteBanda = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la banda no es válido' });
    }

    try {
        const result = await db.query(
            'UPDATE public.banda SET activo = false WHERE id_banda = $1 AND activo = true RETURNING id_banda',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: 'Banda no encontrada' });
        }

        res.json({ mensaje: 'Banda eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar la banda:', error);
        res.status(500).json({ mensaje: 'Error al eliminar la banda' });
    }
};

// Reactivar una banda eliminada (solo Admin, se controla en la ruta).
// Conserva sus ensayos, presentaciones y membresías, que el soft delete no toca.
const reactivarBanda = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la banda no es válido' });
    }

    try {
        const result = await db.query(
            'UPDATE public.banda SET activo = true WHERE id_banda = $1 AND activo = false RETURNING id_banda, nombre_banda, tipo, descripcion, activo',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Banda no encontrada o ya estaba activa' });
        }

        res.json({ mensaje: 'Banda reactivada correctamente', banda: result.rows[0] });
    } catch (error) {
        console.error('Error al reactivar la banda:', error);
        res.status(500).json({ mensaje: 'Error al reactivar la banda' });
    }
};

// Asignar un profesor a una banda (solo Admin, se controla en la ruta)
const asignarProfesor = async (req, res) => {
    const { id_banda } = req.params;
    const { id_profesor } = req.body || {};

    if (!esIdValido(id_banda)) {
        return res.status(400).json({ mensaje: 'El id de la banda no es válido' });
    }

    if (!esIdValido(id_profesor)) {
        return res.status(400).json({ mensaje: 'id_profesor es obligatorio y debe ser un número válido' });
    }

    try {
        const banda = await db.query(
            'SELECT 1 FROM public.banda WHERE id_banda = $1 AND activo = true',
            [id_banda]
        );

        if (banda.rowCount === 0) {
            return res.status(404).json({ mensaje: 'Banda no encontrada' });
        }

        const profesor = await db.query(
            'SELECT 1 FROM public.profesor WHERE id_profesor = $1 AND activo = true',
            [id_profesor]
        );

        if (profesor.rowCount === 0) {
            return res.status(404).json({ mensaje: 'Profesor no encontrado' });
        }

        const result = await db.query(
            `INSERT INTO public.profesor_banda (id_profesor, id_banda)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING
             RETURNING id_profesor, id_banda, asignado_en`,
            [id_profesor, id_banda]
        );

        if (result.rowCount === 0) {
            return res.status(409).json({ mensaje: 'El profesor ya está asignado a esta banda' });
        }

        res.status(201).json({
            mensaje: 'Profesor asignado a la banda correctamente',
            asignacion: result.rows[0]
        });
    } catch (error) {
        console.error('Error al asignar profesor a la banda:', error);
        res.status(500).json({ mensaje: 'Error al asignar el profesor a la banda' });
    }
};

// Quitar un profesor de una banda (solo Admin, se controla en la ruta)
const quitarProfesor = async (req, res) => {
    const { id_banda, id_profesor } = req.params;

    if (!esIdValido(id_banda) || !esIdValido(id_profesor)) {
        return res.status(400).json({ mensaje: 'Los ids de banda y profesor deben ser números válidos' });
    }

    try {
        const result = await db.query(
            'DELETE FROM public.profesor_banda WHERE id_profesor = $1 AND id_banda = $2 RETURNING id_profesor',
            [id_profesor, id_banda]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: 'El profesor no está asignado a esa banda' });
        }

        res.json({ mensaje: 'Profesor quitado de la banda correctamente' });
    } catch (error) {
        console.error('Error al quitar profesor de la banda:', error);
        res.status(500).json({ mensaje: 'Error al quitar el profesor de la banda' });
    }
};

module.exports = {
    getBandas,
    getBandaById,
    createBanda,
    updateBanda,
    deleteBanda,
    reactivarBanda,
    asignarProfesor,
    quitarProfesor
};
