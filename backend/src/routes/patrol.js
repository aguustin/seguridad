const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const patrolController = require('../controllers/patrolController');

router.use(authenticate, requireAdmin);

// Rutas de ronda
router.post('/routes', patrolController.createRoute);
router.get('/routes', patrolController.getRoutes);
router.get('/routes/:id', patrolController.getRoute);
router.put('/routes/:id', patrolController.updateRoute);
router.delete('/routes/:id', patrolController.deactivateRoute);

// Checkpoints de una ruta
router.post('/routes/:id/checkpoints', patrolController.createCheckpoint);
router.put('/checkpoints/:id', patrolController.updateCheckpoint);
router.get('/checkpoints/:id/qr', patrolController.getCheckpointQR);
router.delete('/checkpoints/:id', patrolController.deleteCheckpoint);

// Rondas realizadas (vista administrativa, con filtros)
router.get('/sessions', patrolController.getSessions);
router.get('/sessions/:id', patrolController.getSessionDetail);

module.exports = router;
