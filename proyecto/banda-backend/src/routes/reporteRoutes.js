const express = require('express');
const router = express.Router();
const reporteController = require('../controllers/reporteController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

// El historial y el resumen por banda se limitan a las bandas del profesor (lo resuelve el controlador)
router.get('/historial', verificarToken, reporteController.getHistorialAsistencia);
router.get('/resumen-bandas', verificarToken, reporteController.getResumenPorBanda);
// Totales de toda la fundación: solo Admin
router.get('/resumen-general', verificarToken, soloAdmin, reporteController.getResumenGeneral);

module.exports = router;
