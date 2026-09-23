const express = require('express');
const router = express.Router();
const alumnoController = require('../controllers/alumnoController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

// Proteger todas las rutas con el middleware de verificación
router.get('/', verificarToken, alumnoController.getAlumnos);
router.get('/:id', verificarToken, alumnoController.getAlumnoById);
router.post('/', verificarToken, alumnoController.createAlumno);
router.put('/:id', verificarToken, alumnoController.updateAlumno);
router.patch('/:id/reactivar', verificarToken, soloAdmin, alumnoController.reactivarAlumno);
router.delete('/:id', verificarToken, alumnoController.deleteAlumno);

module.exports = router;
