const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');
const { subirImagen, manejarSubida } = require('../config/upload');

// La foto llega como archivo en multipart/form-data, en el campo `foto`
const subirFoto = manejarSubida(subirImagen('blog').single('foto'));

// Públicas: las usa el sitio sin sesión
router.get('/', blogController.getEntradas);
router.get('/:id', blogController.getEntradaById);

// Solo Admin
router.post('/', verificarToken, soloAdmin, subirFoto, blogController.createEntrada);
router.put('/:id', verificarToken, soloAdmin, subirFoto, blogController.updateEntrada);
router.delete('/:id', verificarToken, soloAdmin, blogController.deleteEntrada);

module.exports = router;
