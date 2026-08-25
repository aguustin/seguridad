const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const kioskController = require('../controllers/kioskController');

// Público — el dispositivo kiosco todavía no tiene sesión (no hace login).
router.get('/status', kioskController.getPublicStatus);

// Solo administrador: consultar detalle y abrir/cerrar.
router.get('/', authenticate, requireAdmin, kioskController.getState);
router.patch('/', authenticate, requireAdmin, kioskController.setState);

module.exports = router;
