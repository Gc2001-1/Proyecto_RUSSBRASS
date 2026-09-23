const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Hash de una contraseña que nadie usa. Se compara contra él cuando el correo no existe o la cuenta
// está inactiva, para que esos casos tarden lo mismo que una contraseña incorrecta y no se pueda
// deducir por el tiempo de respuesta qué correos están registrados.
const HASH_FICTICIO = bcrypt.hashSync('contrasena-ficticia-sin-uso', 10);

const login = async (req, res) => {
    const { correo, contrasena } = req.body || {};

    if (!correo || String(correo).trim() === '' || !contrasena || String(contrasena).trim() === '') {
        return res.status(400).json({ mensaje: 'Correo y contraseña son obligatorios' });
    }

    try {
        const result = await db.query('SELECT * FROM public.profesor WHERE correo = $1', [String(correo).trim()]);
        const profesor = result.rows[0];
        const cuentaValida = Boolean(profesor) && profesor.activo !== false;

        // Solo se acepta la contraseña contra su hash bcrypt (nunca en texto plano)
        const coincide = await bcrypt.compare(String(contrasena), cuentaValida ? profesor.contrasena : HASH_FICTICIO);

        // Correo inexistente, cuenta inactiva y contraseña incorrecta responden exactamente lo mismo:
        // mismo código (401) y mismo mensaje, para no revelar qué correos están registrados.
        if (!cuentaValida || !coincide) {
            return res.status(401).json({ mensaje: 'Correo o contraseña incorrectos' });
        }

        const token = jwt.sign(
            { id_profesor: profesor.id_profesor, nombre: profesor.nombre, correo: profesor.correo, rol: profesor.rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            mensaje: 'Inicio de sesión exitoso',
            token,
            profesor: {
                id_profesor: profesor.id_profesor,
                nombre: profesor.nombre,
                correo: profesor.correo,
                rol: profesor.rol
            }
        });

    } catch (error) {
        console.error('Error en el login:', error);
        res.status(500).json({ mensaje: 'Error en el servidor al intentar iniciar sesión' });
    }
};

module.exports = { login };
