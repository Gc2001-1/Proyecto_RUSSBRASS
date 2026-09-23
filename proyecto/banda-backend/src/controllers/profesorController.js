const db = require('../config/db');
const bcrypt = require('bcryptjs');
const { esIdValido, puedeVerInactivos, LIMITES_TEXTO, validarLongitudes } = require('../utils/validaciones');

const ROLES = ['Admin', 'Profesor'];

const esAdmin = (req) => req.profesor?.rol === 'Admin';

// Rol que se guardará. Un no-Admin nunca puede asignar roles: se ignora lo que mande y se fuerza 'Profesor'.
// Para un Admin devuelve { rol } (null = no se envió, se usa 'Profesor' al crear o se conserva al actualizar)
// o { error } si el valor no es un rol válido.
const resolverRol = (req, rolRecibido) => {
    if (!esAdmin(req)) {
        return { rol: 'Profesor' };
    }

    if (rolRecibido === undefined || rolRecibido === null || String(rolRecibido).trim() === '') {
        return { rol: null };
    }

    const rol = String(rolRecibido).trim();
    if (!ROLES.includes(rol)) {
        return { error: 'El rol debe ser Admin o Profesor' };
    }

    return { rol };
};

const getProfesores = async (req, res) => {
    try {
        const filtro = puedeVerInactivos(req) ? '' : 'WHERE activo = true';
        const result = await db.query(
            `SELECT id_profesor, nombre, correo, rol, activo FROM public.profesor ${filtro} ORDER BY nombre ASC`
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Error al obtener profesores:', error);
        res.status(500).json({ mensaje: 'Error al obtener la lista de profesores' });
    }
};

const getProfesorById = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del profesor no es válido' });
    }

    try {
        const filtro = puedeVerInactivos(req) ? '' : 'AND activo = true';
        const result = await db.query(
            `SELECT id_profesor, nombre, correo, rol, activo FROM public.profesor WHERE id_profesor = $1 ${filtro}`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Profesor no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error al obtener profesor:', error);
        res.status(500).json({ mensaje: 'Error al obtener el profesor' });
    }
};

const createProfesor = async (req, res) => {
    const { nombre, correo, contrasena, rol } = req.body || {};

    if (!nombre || String(nombre).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre del profesor es obligatorio' });
    }

    if (!correo || String(correo).trim() === '') {
        return res.status(400).json({ mensaje: 'El correo del profesor es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ nombre, correo }, LIMITES_TEXTO.profesor);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    if (!contrasena || String(contrasena).trim() === '') {
        return res.status(400).json({ mensaje: 'La contraseña es obligatoria' });
    }

    const rolResuelto = resolverRol(req, rol);
    if (rolResuelto.error) {
        return res.status(400).json({ mensaje: rolResuelto.error });
    }

    try {
        const existe = await db.query(
            'SELECT id_profesor, activo FROM public.profesor WHERE correo = $1',
            [String(correo).trim()]
        );

        if (existe.rows.length > 0) {
            const mensaje = existe.rows[0].activo === false
                ? 'Existe un profesor eliminado con ese correo'
                : 'Ya existe un profesor con ese correo';
            return res.status(409).json({ mensaje });
        }

        const passwordHash = await bcrypt.hash(String(contrasena), 10);
        const result = await db.query(
            'INSERT INTO public.profesor (nombre, correo, contrasena, rol) VALUES ($1, $2, $3, $4) RETURNING id_profesor, nombre, correo, rol, activo',
            [String(nombre).trim(), String(correo).trim(), passwordHash, rolResuelto.rol || 'Profesor']
        );

        res.status(201).json({ mensaje: 'Profesor creado correctamente', profesor: result.rows[0] });
    } catch (error) {
        // 23505: violación de UNIQUE (dos solicitudes simultáneas con el mismo correo)
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'Ya existe un profesor con ese correo' });
        }
        console.error('Error al crear profesor:', error);
        res.status(500).json({ mensaje: 'Error al crear el profesor' });
    }
};

const updateProfesor = async (req, res) => {
    const { id } = req.params;
    const { nombre, correo, contrasena, rol } = req.body || {};

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del profesor no es válido' });
    }

    if (!nombre || String(nombre).trim() === '') {
        return res.status(400).json({ mensaje: 'El nombre del profesor es obligatorio' });
    }

    if (!correo || String(correo).trim() === '') {
        return res.status(400).json({ mensaje: 'El correo del profesor es obligatorio' });
    }

    const errorLongitud = validarLongitudes({ nombre, correo }, LIMITES_TEXTO.profesor);
    if (errorLongitud) {
        return res.status(400).json({ mensaje: errorLongitud });
    }

    const rolResuelto = resolverRol(req, rol);
    if (rolResuelto.error) {
        return res.status(400).json({ mensaje: rolResuelto.error });
    }

    try {
        const existe = await db.query(
            'SELECT id_profesor FROM public.profesor WHERE correo = $1 AND id_profesor <> $2',
            [String(correo).trim(), id]
        );

        if (existe.rows.length > 0) {
            return res.status(409).json({ mensaje: 'Ya existe otro profesor con ese correo' });
        }

        // Si no se envía rol (solo posible para Admin) se conserva el actual (COALESCE con NULL)
        const campos = ['nombre = $1', 'correo = $2', 'rol = COALESCE($3, rol)'];
        const params = [String(nombre).trim(), String(correo).trim(), rolResuelto.rol];

        // La contraseña solo se toca si viene en el body; si no viene se conserva el hash actual
        if (contrasena && String(contrasena).trim() !== '') {
            const passwordHash = await bcrypt.hash(String(contrasena), 10);
            params.push(passwordHash);
            campos.push(`contrasena = $${params.length}`);
        }

        params.push(id);
        const result = await db.query(
            `UPDATE public.profesor SET ${campos.join(', ')} WHERE id_profesor = $${params.length} AND activo = true RETURNING id_profesor, nombre, correo, rol, activo`,
            params
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Profesor no encontrado' });
        }

        res.json({ mensaje: 'Profesor actualizado correctamente', profesor: result.rows[0] });
    } catch (error) {
        if (error.code === '23505') {
            return res.status(409).json({ mensaje: 'Ya existe otro profesor con ese correo' });
        }
        console.error('Error al actualizar profesor:', error);
        res.status(500).json({ mensaje: 'Error al actualizar el profesor' });
    }
};

// Soft delete: el profesor se desactiva y conserva sus ensayos y asignaciones a bandas.
// Al estar inactivo ya no puede iniciar sesión (el login rechaza cuentas con activo = false).
const deleteProfesor = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del profesor no es válido' });
    }

    // Nadie puede desactivar su propia cuenta
    if (Number(req.profesor?.id_profesor) === Number(id)) {
        return res.status(400).json({ mensaje: 'No puedes desactivar tu propia cuenta' });
    }

    let client;
    try {
        client = await db.getClient();
        await client.query('BEGIN');

        const objetivo = await client.query(
            'SELECT rol FROM public.profesor WHERE id_profesor = $1 AND activo = true',
            [id]
        );

        if (objetivo.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'Profesor no encontrado' });
        }

        // Nunca se puede quedar el sistema sin un Admin activo. FOR UPDATE bloquea las filas de los
        // Admin activos, así dos desactivaciones simultáneas no pueden dejar el sistema sin ninguno.
        if (objetivo.rows[0].rol === 'Admin') {
            const admins = await client.query(
                "SELECT id_profesor FROM public.profesor WHERE rol = 'Admin' AND activo = true FOR UPDATE"
            );

            if (admins.rows.length <= 1) {
                await client.query('ROLLBACK');
                return res.status(400).json({ mensaje: 'No puedes desactivar al único Admin del sistema' });
            }
        }

        const result = await client.query(
            'UPDATE public.profesor SET activo = false WHERE id_profesor = $1 AND activo = true RETURNING id_profesor',
            [id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ mensaje: 'Profesor no encontrado' });
        }

        await client.query('COMMIT');
        res.json({ mensaje: 'Profesor eliminado correctamente' });
    } catch (error) {
        if (client) await client.query('ROLLBACK').catch(() => {});
        console.error('Error al eliminar profesor:', error);
        res.status(500).json({ mensaje: 'Error al eliminar el profesor' });
    } finally {
        if (client) client.release();
    }
};

// Reactivar un profesor eliminado (solo Admin, se controla en la ruta).
// Recupera sus asignaciones a bandas y su historial, que el soft delete no toca.
const reactivarProfesor = async (req, res) => {
    const { id } = req.params;

    if (!esIdValido(id)) {
        return res.status(400).json({ mensaje: 'El id del profesor no es válido' });
    }

    try {
        const result = await db.query(
            'UPDATE public.profesor SET activo = true WHERE id_profesor = $1 AND activo = false RETURNING id_profesor, nombre, correo, rol, activo',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ mensaje: 'Profesor no encontrado o ya estaba activo' });
        }

        res.json({ mensaje: 'Profesor reactivado correctamente', profesor: result.rows[0] });
    } catch (error) {
        console.error('Error al reactivar profesor:', error);
        res.status(500).json({ mensaje: 'Error al reactivar el profesor' });
    }
};

module.exports = {
    getProfesores,
    getProfesorById,
    createProfesor,
    updateProfesor,
    deleteProfesor,
    reactivarProfesor
};
