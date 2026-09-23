const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Carpeta física donde caen los archivos. Se sirve como estática desde server.js en /uploads.
const RAIZ_UPLOADS = path.join(__dirname, '..', '..', 'frontend', 'uploads');

const TIPOS_PERMITIDOS = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const TAMANO_MAXIMO = 5 * 1024 * 1024; // 5 MB

const storage = (subcarpeta) => multer.diskStorage({
    destination: (req, file, cb) => {
        const destino = path.join(RAIZ_UPLOADS, subcarpeta);
        fs.mkdirSync(destino, { recursive: true });
        cb(null, destino);
    },
    filename: (req, file, cb) => {
        // Nombre propio, nunca el original del usuario: evita colisiones y rutas maliciosas
        const extension = TIPOS_PERMITIDOS[file.mimetype] || path.extname(file.originalname).toLowerCase();
        const nombre = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
        cb(null, nombre);
    }
});

const filtroImagen = (req, file, cb) => {
    if (!TIPOS_PERMITIDOS[file.mimetype]) {
        return cb(new Error('Solo se permiten imágenes JPG, PNG o WEBP'));
    }
    cb(null, true);
};

// Middleware de multer listo para una ruta: subirImagen('blog').single('foto')
const subirImagen = (subcarpeta) => multer({
    storage: storage(subcarpeta),
    fileFilter: filtroImagen,
    limits: { fileSize: TAMANO_MAXIMO }
});

// Envuelve el middleware de multer para que sus errores salgan como el resto de la API
// (JSON con `mensaje` y 400), en vez del error HTML por defecto de Express.
const manejarSubida = (middlewareMulter) => (req, res, next) => {
    middlewareMulter(req, res, (error) => {
        if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ mensaje: 'La imagen no puede superar los 5 MB' });
        }
        if (error) {
            return res.status(400).json({ mensaje: error.message });
        }
        next();
    });
};

// Ruta relativa que se guarda en la base de datos (nunca la ruta absoluta del disco)
const rutaRelativa = (subcarpeta, file) => `uploads/${subcarpeta}/${file.filename}`;

module.exports = { subirImagen, manejarSubida, rutaRelativa, TAMANO_MAXIMO };
