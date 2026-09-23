const express = require('express');
const router = express.Router();
const bandaController = require('../controllers/bandaController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, bandaController.getBandas);
router.get('/:id', verificarToken, bandaController.getBandaById);
router.post('/', verificarToken, soloAdmin, bandaController.createBanda);
router.put('/:id', verificarToken, soloAdmin, bandaController.updateBanda);
router.patch('/:id/reactivar', verificarToken, soloAdmin, bandaController.reactivarBanda);
router.delete('/:id', verificarToken, soloAdmin, bandaController.deleteBanda);

// Asignar y quitar profesores de una banda
router.post('/:id_banda/profesores', verificarToken, soloAdmin, bandaController.asignarProfesor);
router.delete('/:id_banda/profesores/:id_profesor', verificarToken, soloAdmin, bandaController.quitarProfesor);

module.exports = router;
