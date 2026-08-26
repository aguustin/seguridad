const jwt = require('jsonwebtoken');
const { Admin, SecurityStaff, Client } = require('../models');

const MODEL_BY_ROLE = { admin: Admin, security: SecurityStaff, client: Client };

/**
 * Revalida contra la base que el usuario del token siga existiendo y
 * activo. El JWT en sí no tiene forma de revocarse antes de su expiración
 * (hasta 7 días por default) — esto no reemplaza eso, pero cierra el caso
 * concreto más importante: si un admin desactiva a un guardia/cliente (o se
 * desactiva un admin), esa cuenta deja de poder usar el token ya emitido en
 * el próximo request, en vez de seguir funcionando hasta que expire solo.
 * Reutilizado también por la autenticación de sockets (ver socketService.js).
 */
async function isStillActive(decoded) {
  const Model = MODEL_BY_ROLE[decoded?.role];
  if (!Model) return false;
  const record = await Model.findByPk(decoded.id, { attributes: ['id', 'isActive'] });
  return !!record && record.isActive !== false;
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!(await isStillActive(decoded))) {
      return res.status(401).json({ error: 'Tu cuenta ya no está activa. Iniciá sesión de nuevo.' });
    }
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso solo para administradores' });
  }
  next();
};

const requireSecurity = (req, res, next) => {
  if (req.user?.role !== 'security') {
    return res.status(403).json({ error: 'Acceso solo para seguridad' });
  }
  next();
};

const requireClient = (req, res, next) => {
  if (req.user?.role !== 'client') {
    return res.status(403).json({ error: 'Acceso solo para clientes' });
  }
  next();
};

const requireAdminOrSecurity = (req, res, next) => {
  if (!['admin', 'security'].includes(req.user?.role)) {
    return res.status(403).json({ error: 'Acceso no autorizado' });
  }
  next();
};

// Exportado además de usarse acá adentro: authController.changePassword lo
// reutiliza para resolver el modelo del usuario autenticado sin duplicar
// este mapa (mismo motivo por el que existe acá: Admin/SecurityStaff/Client
// comparten la forma "buscar por id + chequear isActive").
module.exports = { authenticate, requireAdmin, requireSecurity, requireClient, requireAdminOrSecurity, isStillActive, MODEL_BY_ROLE };
