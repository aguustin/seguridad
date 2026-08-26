const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const assignmentController = require('../controllers/assignmentController');

router.use(authenticate, requireAdmin);

router.post('/', assignmentController.createAssignment);
router.get('/', assignmentController.getAssignments);
router.patch('/:id/cancel', assignmentController.cancelAssignment);

module.exports = router;
