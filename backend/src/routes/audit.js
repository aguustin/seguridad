const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const auditController = require('../controllers/auditController');

router.use(authenticate, requireAdmin);

router.get('/', auditController.getAuditLogs);

module.exports = router;
