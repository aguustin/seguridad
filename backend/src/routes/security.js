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

// Rondas (rutas disponibles, inicio/fin de sesión, estado activo, checkpoints)
router.get('/patrol/routes', securityController.getPatrolRoutes);
router.post('/patrol/start', securityController.startPatrol);
router.post('/patrol/end', securityController.endPatrol);
router.get('/patrol/active', securityController.getActivePatrol);
router.post('/patrol/checkpoint', securityController.registerCheckpointVisit);
router.post('/patrol/checkpoint/scan', securityController.scanCheckpointQR);
router.get('/patrol/history', securityController.getMyPatrolHistory);
router.get('/patrol/history/:id', securityController.getMyPatrolDetail);

// Visitas (ingreso/egreso de visitantes al barrio)
router.post('/visits', securityController.registerVisit);
router.get('/visits/active', securityController.getActiveVisits);
router.get('/visits', securityController.getVisitHistory);
router.patch('/visits/:id/exit', securityController.registerVisitExit);
router.post('/visits/scan', securityController.scanVisitInvitation);

// Asignaciones (tareas puntuales del admin al guardia)
router.get('/assignments', securityController.getMyAssignments);
router.patch('/assignments/:id/complete', securityController.completeAssignment);

// Logout (limpia isOperator si aplica)
router.post('/logout', securityController.securityLogout);

module.exports = router;
