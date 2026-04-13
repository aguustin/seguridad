const router = require('express').Router();
const authController = require('../controllers/authController');
const { upload, faceUpload } = require('../middleware/upload');

// Admin
router.post('/admin/login', authController.adminLogin);
router.post('/admin/register', authController.adminRegister);

// Security staff
router.post('/security/register', upload.single('profilePhoto'), authController.securityRegister);
router.post('/security/face-scan', faceUpload.single('faceImage'), authController.securityFaceScan);

// Client
router.post('/client/login', authController.clientLogin);

module.exports = router;
