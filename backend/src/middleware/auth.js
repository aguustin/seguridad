const jwt = require('jsonwebtoken');
const { Admin, SecurityStaff, Client } = require('../models');

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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

module.exports = { authenticate, requireAdmin, requireSecurity, requireClient, requireAdminOrSecurity };
