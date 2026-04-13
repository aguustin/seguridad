const router = require('express').Router();
const { authenticate, requireClient } = require('../middleware/auth');
const clientController = require('../controllers/clientController');

router.use(authenticate, requireClient);

router.get('/profile', clientController.getMyProfile);
router.post('/location-sharing', clientController.toggleLocationSharing);
router.get('/chat', clientController.getChatMessages);
router.post('/emergency', clientController.sendEmergencyAlert);

module.exports = router;
