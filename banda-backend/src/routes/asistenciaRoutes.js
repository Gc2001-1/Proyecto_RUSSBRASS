const express = require('express');
const router = express.Router();
const asistenciaController = require('../controllers/asistenciaController');
const { verificarToken, tieneAccesoABanda } = require('../middlewares/authMiddleware');

// Proteger rutas con Token y con acceso a la banda (Admin siempre; Profesor solo si está asignado)
router.post('/ensayo', verificarToken, tieneAccesoABanda, asistenciaController.registrarAsistenciaEnsayo);
router.post('/presentacion', verificarToken, tieneAccesoABanda, asistenciaController.registrarAsistenciaPresentacion);
router.get('/porcentaje', verificarToken, tieneAccesoABanda, asistenciaController.getPorcentajeAsistencia);

module.exports = router;
