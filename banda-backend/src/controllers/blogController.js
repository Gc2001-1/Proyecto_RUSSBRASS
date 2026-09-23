const db = require('../config/db');
const { esIdValido, LIMITES_TEXTO, validarLongitudes } = require('../utils/validaciones');
const { rutaRelativa } = require('../config/upload');

const COLUMNAS_ENTRADA = `id_entrada, titulo, resumen, foto, enlace_facebook, TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha, activo`;
const LIMITE_MAXIMO = 100;

// Un texto opcional tal como se guarda: sin espacios al inicio ni al final, y vacío o ausente = NULL
const textoOpcional = (valor) => (valor === undefined || valor === null ? null : String(valor).trim() || null);

// GET /api/blog — público. Entradas activas, de la más reciente a la más antigua.
// ?limite=N acota el resultado (para el carrusel del index).
const getEntradas = async (req, res) => {
    const { limite } = req.query;

    if (limite !== undefined && (!/^\d+$/.test(String(limite)) || Number(limite) < 1 || Number(limite) > LIMITE_MAXIMO)) {
        return res.status(400).json({ mensaje: `limite debe ser un número entre 1 y ${LIMITE_MAXIMO}` });
    }

    try {
        const result = await db.query(
            `SELECT ${COLUMNAS_ENTRADA}
             FROM public.entrada_blog
             WHERE activo = true
             ORDER BY fecha DESC, id_entrada DESC
             ${limite ? 'LIMIT $1' : ''}`,
            limite ? [Number(limite)] : []
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener el blog:', error);
        res.status(500).json({ mensaje: 'Error al obtener las entradas del blog' });
    }
};

// GET /api/blog/:id — público, una entrada activa
const getEntradaById = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la entrada no es válido' });
    }

    try {
        const result = await db.query(
            `SELECT ${COLUMNAS_ENTRADA} FROM public.entrada_blog WHERE id_entrada = $1 AND activo = true`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Entrada no encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener la entrada:', error);
        res.status(500).json({ mensaje: 'Error al obtener la entrada' });
    }
};

// POST /api/blog — soloAdmin (se controla en la ruta). `foto` llega como archivo (multipart), opcional.
const createEntrada = async (req, res) => {
    const { titulo, resumen, enlace_facebook, fecha } = req.body || {};

    if (!titulo || String(titulo).trim() === '') {
        return res.status(400).json({ mensaje: 'El título es obligatorio' });
    }

    if (!resumen || String(resumen).trim() === '') {
        return res.status(400).json({ mensaje: 'El resumen es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ titulo, resumen, enlace_facebook }, LIMITES_TEXTO.blog);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    if (fecha && String(fecha).trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
        return res.status(400).json({ mensaje: 'fecha debe tener el formato AAAA-MM-DD' });
    }

    try {
        // fecha, enlace_facebook y foto son opcionales: solo se envían si vienen, para respetar
        // el valor por defecto de la columna (fecha) o dejar NULL (enlace_facebook, foto).
        const columnas = ['titulo', 'resumen', 'creado_por'];
        const valores = [String(titulo).trim(), String(resumen).trim(), req.profesor.id_profesor];

        if (textoOpcional(enlace_facebook)) {
            columnas.push('enlace_facebook');
            valores.push(textoOpcional(enlace_facebook));
        }
        if (fecha && String(fecha).trim() !== '') {
            columnas.push('fecha');
            valores.push(String(fecha).trim());
        }
        if (req.file) {
            columnas.push('foto');
            valores.push(rutaRelativa('blog', req.file));
        }

        const marcadores = valores.map((_, i) => `$${i + 1}`).join(', ');

        const result = await db.query(
            `INSERT INTO public.entrada_blog (${columnas.join(', ')}) VALUES (${marcadores}) RETURNING ${COLUMNAS_ENTRADA}`,
            valores
        );

        res.status(201).json({ mensaje: 'Entrada creada correctamente', entrada: result.rows[0] });
    } catch (error) {
        console.error('Error al crear la entrada:', error);
        res.status(500).json({ mensaje: 'Error al crear la entrada' });
    }
};

// PUT /api/blog/:id — soloAdmin. Si llega un archivo nuevo, reemplaza la foto; si no, se conserva.
const updateEntrada = async (req, res) => {
    const { id } = req.params;
    const { titulo, resumen, enlace_facebook, fecha } = req.body || {};

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la entrada no es válido' });
    }

    if (!titulo || String(titulo).trim() === '') {
        return res.status(400).json({ mensaje: 'El título es obligatorio' });
    }

    if (!resumen || String(resumen).trim() === '') {
        return res.status(400).json({ mensaje: 'El resumen es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ titulo, resumen, enlace_facebook }, LIMITES_TEXTO.blog);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    if (fecha && String(fecha).trim() !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(String(fecha))) {
        return res.status(400).json({ mensaje: 'fecha debe tener el formato AAAA-MM-DD' });
    }

    try {
        // Si no se envía enlace_facebook o fecha se conservan los actuales (COALESCE con NULL)
        const campos = ['titulo = $1', 'resumen = $2', 'enlace_facebook = COALESCE($3, enlace_facebook)', 'fecha = COALESCE($4, fecha)'];
        const valores = [
            String(titulo).trim(),
            String(resumen).trim(),
            textoOpcional(enlace_facebook),
            fecha && String(fecha).trim() !== '' ? String(fecha).trim() : null
        ];

        if (req.file) {
            valores.push(rutaRelativa('blog', req.file));
            campos.push(`foto = $${valores.length}`);
        }

        valores.push(id);

        const result = await db.query(
            `UPDATE public.entrada_blog SET ${campos.join(', ')} WHERE id_entrada = $${valores.length} AND activo = true RETURNING ${COLUMNAS_ENTRADA}`,
            valores
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Entrada no encontrada' });
        }

        res.json({ mensaje: 'Entrada actualizada correctamente', entrada: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar la entrada:', error);
        res.status(500).json({ mensaje: 'Error al actualizar la entrada' });
    }
};

// DELETE /api/blog/:id — soloAdmin, soft delete
const deleteEntrada = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la entrada no es válido' });
    }

    try {
        const result = await db.query(
            'UPDATE public.entrada_blog SET activo = false WHERE id_entrada = $1 AND activo = true RETURNING id_entrada',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ mensaje: 'Entrada no encontrada' });
        }

        res.json({ mensaje: 'Entrada eliminada correctamente' });
    } catch (error) {
        console.error('Error al eliminar la entrada:', error);
        res.status(500).json({ mensaje: 'Error al eliminar la entrada' });
    }
};

module.exports = {
    getEntradas,
    getEntradaById,
    createEntrada,
    updateEntrada,
    deleteEntrada
};
