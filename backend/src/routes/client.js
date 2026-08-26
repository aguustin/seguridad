const router = require('express').Router();
const { authenticate, requireClient } = require('../middleware/auth');
const clientController = require('../controllers/clientController');

router.use(authenticate, requireClient);

router.get('/profile', clientController.getMyProfile);
router.post('/location-sharing', clientController.toggleLocationSharing);
router.post('/contact', clientController.updateContact);
router.get('/chat', clientController.getChatMessages);
router.post('/emergency', clientController.sendEmergencyAlert);

// Invitaciones de visita (QR)
router.post('/visit-invitations', clientController.createVisitInvitation);
router.get('/visit-invitations', clientController.getVisitInvitations);

module.exports = router;
