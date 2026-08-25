const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const adminController = require('../controllers/adminController');

router.use(authenticate, requireAdmin);

// Administradores
router.post('/admins', adminController.createAdmin);

// Barrios
router.get('/neighborhoods', adminController.getNeighborhoods);
router.post('/neighborhoods', adminController.createNeighborhood);
router.put('/neighborhoods/:id', adminController.updateNeighborhood);

// Guardias
router.post('/security', upload.single('profilePhoto'), adminController.createSecurityStaff);
router.get('/security', adminController.getSecurityStaff);
router.get('/security/:id', adminController.getSecurityProfile);
router.put('/security/:id', adminController.updateSecurityStaff);
router.delete('/security/:id', adminController.deactivateSecurityStaff);
router.get('/security/:id/attendance', adminController.getAttendanceHistory);
router.post('/security/:id/assign-operator', adminController.assignOperator);
router.delete('/operator', adminController.removeOperator);

// Ubicaciones en tiempo real
router.get('/locations/guards', adminController.getGuardsLocations);
router.get('/locations/clients', adminController.getClientsLocations);

// Alertas de clientes
router.post('/alerts', adminController.sendAlert);
router.get('/alerts', adminController.getAlerts);
router.patch('/alerts/:id/resolve', adminController.resolveAlert);

// Historial alertas de guardias
router.get('/guard-alerts', adminController.getGuardAlerts);

// Clientes
router.post('/clients', upload.single('profilePhoto'), adminController.registerClient);
router.get('/clients', adminController.getClients);

// Finanzas
router.post('/finances', adminController.createFinancialRecord);
router.get('/finances', adminController.getFinancialRecords);
router.get('/finances/stats', adminController.getFinancialStats);
router.put('/finances/:id', adminController.updateFinancialRecord);
router.delete('/finances/:id', adminController.deleteFinancialRecord);

module.exports = router;
