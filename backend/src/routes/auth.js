const router = require('express').Router();
const authController = require('../controllers/authController');
const { faceUpload } = require('../middleware/upload');
const { createRateLimiter } = require('../middleware/rateLimiter');

// Login: generoso para no bloquear a alguien que se equivoca de contraseña
// un par de veces, suficientemente estricto contra fuerza bruta.
const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Demasiados intentos de inicio de sesión. Esperá unos minutos e intentá de nuevo.',
});
// Registro de admin: solo funciona una vez en la vida del sistema (ver
// adminRegister), pero igual conviene no dejarlo abierto a spam.
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 });
// Face-scan: el kiosco lo llama legítimamente muchas veces por turno (cada
// guardia que entra/sale), así que el límite tiene que ser generoso — el
// objetivo acá es frenar un abuso automatizado, no el uso normal.
const faceScanLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 20 });

// Admin
router.post('/admin/login', loginLimiter, authController.adminLogin);
// Solo permite crear el primer administrador (ver adminRegister) — luego se
// cierra solo. El alta de admins adicionales es POST /api/admin/admins.
router.post('/admin/register', registerLimiter, authController.adminRegister);

// Security staff — el escaneo facial (check-in/check-out) sigue público
// porque el kiosco no tiene sesión. El alta de guardias ahora requiere
// admin: ver POST /api/admin/security.
router.post('/security/face-scan', faceScanLimiter, faceUpload.single('faceImage'), authController.securityFaceScan);

// Client
router.post('/client/login', loginLimiter, authController.clientLogin);

module.exports = router;
