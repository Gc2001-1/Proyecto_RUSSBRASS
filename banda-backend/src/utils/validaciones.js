// Un ID válido es un entero positivo que cabe en un int4 de PostgreSQL.
// Evita que un valor como "abc" llegue a la base y termine en un error 500.
const esIdValido = (valor) => {
    return /^\d+$/.test(String(valor)) && Number(valor) > 0 && Number(valor) <= 2147483647;
};

// El rol viene del token (req.profesor lo llena verificarToken). Sin token válido nunca es Admin.
const esAdmin = (req) => req.profesor?.rol === 'Admin';

// Solo un Admin puede consultar registros inactivos, y únicamente con ?incluir_inactivos=true (texto exacto).
// Cualquier otro caso (Profesor, o Admin sin el parámetro) ve solo los activos.
const puedeVerInactivos = (req) => {
    return esAdmin(req) && req.query?.incluir_inactivos === 'true';
};

// Largo máximo de cada campo de texto, igual al tamaño de su columna en la base de datos
// (varchar(N)). Si un valor se pasa, PostgreSQL lo rechaza y el usuario vería un error 500.
const LIMITES_TEXTO = Object.freeze({
    alumno: Object.freeze({ nombre: 150, telefono: 30, direccion: 255 }),
    banda: Object.freeze({ nombre_banda: 150 }),
    profesor: Object.freeze({ nombre: 150, correo: 150 }),
    ensayo: Object.freeze({ lugar: 150 }),
    presentacion: Object.freeze({ lugar_presentacion: 150 }),
    // resumen/mensaje/texto son `text` (sin límite en la base): 2000 es un tope razonable de aplicación,
    // no el tamaño de una columna. enlace_facebook sí es varchar(500), igual que los demás campos varchar.
    blog: Object.freeze({ titulo: 150, resumen: 2000, enlace_facebook: 500 }),
    inscripcion: Object.freeze({ nombre_alumno: 150, nombre_contacto: 150, telefono_contacto: 30, correo_contacto: 150, mensaje: 2000 }),
    testimonio: Object.freeze({ autor: 150, texto: 2000 })
});

// Comprueba que ningún campo supere su largo máximo. `valores` es un objeto { campo: valor } y
// `limites` uno de LIMITES_TEXTO. Los campos ausentes (undefined o null) se ignoran. Se mide el valor
// sin espacios al inicio ni al final, que es como se guarda. Devuelve el mensaje de error del primer
// campo que se pasa, o null si todos están bien.
const validarLongitudes = (valores, limites) => {
    for (const [campo, maximo] of Object.entries(limites)) {
        const valor = valores[campo];
        if (valor === undefined || valor === null) continue;

        if (String(valor).trim().length > maximo) {
            return `El campo ${campo} no puede superar los ${maximo} caracteres`;
        }
    }

    return null;
};

module.exports = { esIdValido, esAdmin, puedeVerInactivos, LIMITES_TEXTO, validarLongitudes };
