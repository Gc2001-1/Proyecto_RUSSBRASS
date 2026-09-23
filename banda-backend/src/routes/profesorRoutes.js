const express = require('express');
const router = express.Router();
const profesorController = require('../controllers/profesorController');
const { verificarToken, soloAdmin } = require('../middlewares/authMiddleware');

router.get('/', verificarToken, profesorController.getProfesores);
router.get('/:id', verificarToken, profesorController.getProfesorById);
router.post('/', verificarToken, soloAdmin, profesorController.createProfesor);
router.put('/:id', verificarToken, soloAdmin, profesorController.updateProfesor);
router.patch('/:id/reactivar', verificarToken, soloAdmin, profesorController.reactivarProfesor);
router.delete('/:id', verificarToken, soloAdmin, profesorController.deleteProfesor);

module.exports = router;
