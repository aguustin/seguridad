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
router.delete('/checkpoints/:id', patrolController.deleteCheckpoint);

module.exports = router;
