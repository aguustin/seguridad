const router = require('express').Router();
const { authenticate, requireSecurity } = require('../middleware/auth');
const securityController = require('../controllers/securityController');

router.use(authenticate, requireSecurity);

router.get('/profile', securityController.getMyProfile);
router.post('/location', securityController.updateLocation);
router.get('/attendance', securityController.getMyAttendance);
router.get('/colleagues', securityController.getActiveColleagues);
router.get('/active-guards', securityController.getActiveGuardsStatus);
router.get('/chat', securityController.getChatMessages);
router.get('/alerts', securityController.getMyAlerts);

// Alertas del guardia
router.post('/guard-alert', securityController.sendGuardAlert);
router.patch('/guard-alert/:id/resolve', securityController.resolveGuardAlert);
router.get('/guard-alert/active', securityController.getMyActiveAlert);

// Check-in
router.post('/checkin/confirm', securityController.confirmCheckin);

// Rondas (inicio/fin de sesión)
router.post('/patrol/start', securityController.startPatrol);
router.post('/patrol/end', securityController.endPatrol);

// Logout (limpia isOperator si aplica)
router.post('/logout', securityController.securityLogout);

module.exports = router;
