const db = require('../config/db');
const { esIdValido, LIMITES_TEXTO, validarLongitudes } = require('../utils/validaciones');

const BANDAS_INTERES = ['paz', 'clasica', 'orquesta'];
const ESTADOS = ['pendiente', 'contactado', 'inscrito', 'descartado'];
const MENSAJE_ESTADO = `estado debe ser uno de: ${ESTADOS.join(', ')}`;

const COLUMNAS_SOLICITUD = `id_solicitud, nombre_alumno, edad, banda_interes, nombre_contacto,
    telefono_contacto, correo_contacto, mensaje, estado, created_at`;

// Un texto opcional tal como se guarda: sin espacios al inicio ni al final, y vacío o ausente = NULL
const textoOpcional = (valor) => (valor === undefined || valor === null ? null : String(valor).trim() || null);

// Una edad enviada (no vacía) debe ser un entero entre 1 y 120
const edadInvalida = (edad) => {
    if (edad === undefined || edad === null || String(edad).trim() === '') return false;
    return !/^\d+$/.test(String(edad).trim()) || Number(edad) < 1 || Number(edad) > 120;
};

// POST /api/inscripcion — público, sin token. Lo llena cualquier visitante del sitio.
const createSolicitud = async (req, res) => {
    const { nombre_alumno, edad, banda_interes, nombre_contacto, telefono_contacto, correo_contacto, mensaje } = req.body || {};

    if (!nombre_alumno || String(nombre_alumno).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre del alumno es obligatorio' });
    }

    if (!nombre_contacto || String(nombre_contacto).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre de contacto es obligatorio' });
    }

    if (!telefono_contacto || String(telefono_contacto).trim() === '') {
        return res.status(400).json({ mensaje: 'El teléfono de contacto es obligatorio' });
    }

    const errorLongitud = validarLongitudes(
        { nombre_alumno, nombre_contacto, telefono_contacto, correo_contacto, mensaje },
        LIMITES_TEXTO.inscripcion
    );
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    if (edadInvalida(edad)) {
        return res.status(400).json({ mensaje: 'La edad debe ser un número entre 1 y 120' });
    }

    const bandaNormalizada = banda_interes && String(banda_interes).trim() !== '' ? String(banda_interes).trim().toLowerCase() : null;
    if (bandaNormalizada && !BANDAS_INTERES.includes(bandaNormalizada)) {
        return res.status(400).json({ mensaje: 'banda_interes debe ser: paz, clasica u orquesta' });
    }

    try {
        const result = await db.query(
            `INSERT INTO public.solicitud_inscripcion
                (nombre_alumno, edad, banda_interes, nombre_contacto, telefono_contacto, correo_contacto, mensaje)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING ${COLUMNAS_SOLICITUD}`,
            [
                String(nombre_alumno).trim(),
                edad && String(edad).trim() !== '' ? Number(edad) : null,
                bandaNormalizada,
                String(nombre_contacto).trim(),
                String(telefono_contacto).trim(),
                textoOpcional(correo_contacto),
                textoOpcional(mensaje)
            ]
        );

        res.status(201).json({
            mensaje: 'Solicitud enviada correctamente. Nos pondremos en contacto pronto.',
            solicitud: result.rows[0]
        });
    } catch (error) {
        console.error('Error al registrar la solicitud de inscripción:', error);
        res.status(500).json({ mensaje: 'Error al registrar la solicitud' });
    }
};

// GET /api/inscripcion — soloAdmin. ?estado=pendiente filtra.
const getSolicitudes = async (req, res) => {
    const { estado } = req.query;

    if (estado !== undefined && !ESTADOS.includes(String(estado).trim().toLowerCase())) {
        return res.status(400).json({ mensaje: MENSAJE_ESTADO });
    }

    try {
        const params = [];
        let filtro = '';

        if (estado) {
            params.push(String(estado).trim().toLowerCase());
            filtro = 'WHERE estado = $1';
        }

        const result = await db.query(
            `SELECT ${COLUMNAS_SOLICITUD} FROM public.solicitud_inscripcion ${filtro} ORDER BY created_at DESC`,
            params
        );

        res.json({ total: result.rows.length, filtros: { estado: estado || null }, datos: result.rows });
    } catch (error) {
        console.error('Error al obtener solicitudes de inscripción:', error);
        res.status(500).json({ mensaje: 'Error al obtener las solicitudes' });
    }
};

// PATCH /api/inscripcion/:id — soloAdmin. Solo actualiza el campo estado.
const updateEstado = async (req, res) => {
    const { id } = req.params;
    const { estado } = req.body || {};

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id de la solicitud no es válido' });
    }

    if (!estado || !ESTADOS.includes(String(estado).trim().toLowerCase())) {
        return res.status(400).json({ mensaje: `estado es obligatorio y debe ser uno de: ${ESTADOS.join(', ')}` });
    }

    try {
        const result = await db.query(
            `UPDATE public.solicitud_inscripcion SET estado = $1 WHERE id_solicitud = $2 RETURNING ${COLUMNAS_SOLICITUD}`,
            [String(estado).trim().toLowerCase(), id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Solicitud no encontrada' });
        }

        res.json({ mensaje: 'Estado actualizado correctamente', solicitud: result.rows[0] });
    } catch (error) {
        console.error('Error al actualizar el estado de la solicitud:', error);
        res.status(500).json({ mensaje: 'Error al actualizar el estado' });
    }
};

module.exports = { createSolicitud, getSolicitudes, updateEstado };
