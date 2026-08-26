const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const statisticsController = require('../controllers/statisticsController');

router.use(authenticate, requireAdmin);

router.get('/', statisticsController.getOperationalStats);

module.exports = router;
