const router = require('express').Router();
const authController = require('../controllers/authController');
const { faceUpload } = require('../middleware/upload');

// Admin
router.post('/admin/login', authController.adminLogin);
// Solo permite crear el primer administrador (ver adminRegister) — luego se
// cierra solo. El alta de admins adicionales es POST /api/admin/admins.
router.post('/admin/register', authController.adminRegister);

// Security staff — el escaneo facial (check-in/check-out) sigue público
// porque el kiosco no tiene sesión. El alta de guardias ahora requiere
// admin: ver POST /api/admin/security.
router.post('/security/face-scan', faceUpload.single('faceImage'), authController.securityFaceScan);

// Client
router.post('/client/login', authController.clientLogin);

module.exports = router;
