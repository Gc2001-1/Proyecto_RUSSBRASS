const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { esIdValido } = require('../utils/validaciones');

const verificarToken = (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ mensaje: 'Acceso denegado. No se proporcionó un token.' });
    }

    try {
        const verificado = jwt.verify(token, process.env.JWT_SECRET);
        req.profesor = verificado;
        next();
    } catch (error) {
        res.status(401).json({ mensaje: 'Token inválido o expirado.' });
    }
};

// Solo deja pasar a profesores con rol 'Admin'. Debe ir después de verificarToken.
const soloAdmin = (req, res, next) => {
    if (req.profesor?.rol !== 'Admin') {
        return res.status(403).json({ mensaje: 'Acceso denegado. Se requiere rol de administrador.' });
    }
    next();
};

// Los Admin pasan siempre. Un Profesor solo si está asignado a la banda en profesor_banda.
// El id_banda se toma de req.params, req.body o req.query (en ese orden). Debe ir después de verificarToken.
const tieneAccesoABanda = async (req, res, next) => {
    if (req.profesor?.rol === 'Admin') {
        return next();
    }

    const id_banda = req.params?.id_banda ?? req.body?.id_banda ?? req.query?.id_banda;

    if (!esIdValido(id_banda)) {
        return res.status(400).json({ mensaje: 'id_banda es obligatorio y debe ser un número válido' });
    }

    try {
        const result = await db.query(
            'SELECT 1 FROM public.profesor_banda WHERE id_profesor = $1 AND id_banda = $2',
            [req.profesor.id_profesor, id_banda]
        );

        if (result.rowCount === 0) {
            return res.status(403).json({ mensaje: 'No tienes acceso a esta banda' });
        }

        next();
    } catch (error) {
        console.error('Error al verificar acceso a la banda:', error);
        res.status(500).json({ mensaje: 'Error al verificar el acceso a la banda' });
    }
};

module.exports = { verificarToken, soloAdmin, tieneAccesoABanda };
