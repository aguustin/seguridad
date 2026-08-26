const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const visitController = require('../controllers/visitController');

router.use(authenticate, requireAdmin);

router.get('/', visitController.getVisits);

module.exports = router;
