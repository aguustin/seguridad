const { Op } = require('sequelize');
const {
  Admin,
  SecurityStaff,
  Client,
  Neighborhood,
  AttendanceRecord,
  Alert,
  FinancialRecord,
} = require('../models');
const { sendWakeUpAlert, sendPushNotification } = require('../services/notificationService');
const { makeUserJoinRoom, makeUserLeaveRoom } = require('../services/socketService');
const faceService = require('../services/faceService');
const path = require('path');

// ── ADMINISTRADORES ────────────────────────────────────────────────────────
// Alta de administradores adicionales, solo accesible para un admin ya
// autenticado (ver middleware requireAdmin en routes/admin.js). El primer
// admin del sistema se crea vía POST /api/auth/admin/register (público solo
// mientras no exista ninguno — ver authController.adminRegister).
exports.createAdmin = async (req, res) => {
  try {
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      return res.status(400).json({ error: 'Usuario, contraseña y nombre son obligatorios' });
    }
    const admin = await Admin.create({ username, password, name });
    res.status(201).json({ id: admin.id, username: admin.username, name: admin.name });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
};

// ── BARRIOS ────────────────────────────────────────────────────────────────
exports.getNeighborhoods = async (req, res) => {
  try {
    const neighborhoods = await Neighborhood.findAll({ where: { isActive: true } });
    res.json(neighborhoods);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createNeighborhood = async (req, res) => {
  try {
    const { name, address, description } = req.body;
    const n = await Neighborhood.create({ name, address, description });
    res.status(201).json(n);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateNeighborhood = async (req, res) => {
  try {
    const { id } = req.params;
    await Neighborhood.update(req.body, { where: { id } });
    const updated = await Neighborhood.findByPk(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GUARDIAS ───────────────────────────────────────────────────────────────
// Alta de guardias (antes era pública en authController.securityRegister —
// ver disclosure en la conversación: ahora requiere admin autenticado).
// Misma lógica de siempre: extrae el descriptor facial de la foto de perfil
// mediante faceService antes de crear el registro.
exports.createSecurityStaff = async (req, res) => {
  try {
    const { firstName, lastName, documentNumber, age } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Se requiere foto de perfil' });
    }

    const profilePhotoPath = req.file.path
      ? path.relative(path.join(__dirname, '../../'), req.file.path)
      : null;

    const imageBuffer =
      req.file.buffer || require('fs').readFileSync(req.file.path);

    const descriptor = await faceService.extractDescriptor(imageBuffer);

    if (!descriptor) {
      return res.status(400).json({
        error: 'No se detectó un rostro válido en la foto de perfil'
      });
    }

    const staff = await SecurityStaff.create({
      firstName,
      lastName,
      documentNumber,
      age: parseInt(age),
      profilePhoto: profilePhotoPath,
      faceDescriptor: faceService.descriptorToJson(descriptor),
    });

    res.status(201).json({
      message: 'Guardia registrado correctamente',
      staff
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'Ya existe un guardia con ese documento' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getSecurityStaff = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const staff = await SecurityStaff.findAll({
      where,
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      attributes: { exclude: ['faceDescriptor'] },
    });
    // Agregar flag booleano: ¿tiene descriptor facial listo?
    const result = staff.map((s) => ({
      ...s.toJSON(),
      faceDescriptor: s.getDataValue('faceDescriptor') != null,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getSecurityProfile = async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await SecurityStaff.findByPk(id, {
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
      attributes: { exclude: ['faceDescriptor'] },
    });
    if (!staff) return res.status(404).json({ error: 'Guardia no encontrado' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateSecurityStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = [
      'firstName', 'lastName', 'documentNumber', 'age',
      'neighborhoodId', 'shiftStart', 'shiftEnd',
      'paymentDay', 'salary', 'contact',
    ];
    const updates = {};
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

    await SecurityStaff.update(updates, { where: { id } });
    const updated = await SecurityStaff.findByPk(id, {
      attributes: { exclude: ['faceDescriptor'] },
    });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deactivateSecurityStaff = async (req, res) => {
  try {
    const { id } = req.params;
    await SecurityStaff.update({ isActive: false }, { where: { id } });
    res.json({ message: 'Guardia dado de baja correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAttendanceHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0, from, to } = req.query;
    const where = { securityStaffId: id };
    if (from || to) {
      where.checkIn = {};
      if (from) where.checkIn[Op.gte] = new Date(from);
      if (to) where.checkIn[Op.lte] = new Date(to);
    }

    const records = await AttendanceRecord.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['checkIn', 'DESC']],
      include: [{ association: 'neighborhood', attributes: ['name'] }],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ALERTAS ────────────────────────────────────────────────────────────────
exports.sendAlert = async (req, res) => {
  try {
    const { title, message, targetNeighborhoodId, targetSecurityId } = req.body;
    const adminId = req.user.id;

    const alert = await Alert.create({
      type: 'admin_to_security',
      title,
      message,
      senderId: adminId,
      senderType: 'admin',
      targetNeighborhoodId,
      targetSecurityId,
    });

    // Obtener tokens para notificación push
    const where = { isActive: true };
    if (targetSecurityId) {
      where.id = targetSecurityId;
    } else if (targetNeighborhoodId) {
      where.neighborhoodId = targetNeighborhoodId;
    }

    const staff = await SecurityStaff.findAll({ where, attributes: ['expoPushToken'] });
    const tokens = staff.map((s) => s.expoPushToken).filter(Boolean);

    if (tokens.length > 0) {
      await sendWakeUpAlert(tokens, message);
    }

    // Emitir via Socket.io
    const io = req.app.get('io');
    if (io) {
      if (targetSecurityId) {
        io.to(`user:${targetSecurityId}`).emit('admin_alert', alert.toJSON());
      } else if (targetNeighborhoodId) {
        io.to(`neighborhood:${targetNeighborhoodId}`).emit('admin_alert', alert.toJSON());
      } else {
        io.to('role:security').emit('admin_alert', alert.toJSON());
      }
    }

    res.status(201).json(alert);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CLIENTES ───────────────────────────────────────────────────────────────
exports.registerClient = async (req, res) => {
  try {
    const { username, password, firstName, lastName, age, neighborhoodId } = req.body;

    let profilePhoto = null;
    if (req.file) {
      profilePhoto = path.relative(path.join(__dirname, '../../'), req.file.path);
    }

    const client = await Client.create({
      username,
      password,
      firstName,
      lastName,
      age: age ? parseInt(age) : null,
      profilePhoto,
      neighborhoodId,
    });

    res.status(201).json({
      id: client.id,
      username: client.username,
      firstName: client.firstName,
      lastName: client.lastName,
      profilePhoto: client.profilePhoto,
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: 'El usuario ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
};

exports.getClients = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const clients = await Client.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── FINANZAS ───────────────────────────────────────────────────────────────
exports.createFinancialRecord = async (req, res) => {
  try {
    const { type, category, description, amount, frequency, startDate, neighborhoodId, securityStaffId } = req.body;

    const record = await FinancialRecord.create({
      adminId: req.user.id,
      type,
      category,
      description,
      amount: parseFloat(amount),
      frequency,
      startDate,
      neighborhoodId,
      securityStaffId,
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFinancialRecords = async (req, res) => {
  try {
    const { type, from, to, neighborhoodId, frequency } = req.query;
    const where = { adminId: req.user.id, isActive: true };
    if (type) where.type = type;
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;
    if (frequency) where.frequency = frequency;
    if (from || to) {
      where.startDate = {};
      if (from) where.startDate[Op.gte] = from;
      if (to) where.startDate[Op.lte] = to;
    }

    const records = await FinancialRecord.findAll({
      where,
      order: [['startDate', 'DESC']],
    });

    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getFinancialStats = async (req, res) => {
  try {
    const { period } = req.query; // 'day', 'week', 'month', 'year', 'total'
    const { sequelize } = require('../config/database');
    const adminId = req.user.id;

    // Calcular rango de fechas según periodo
    const now = new Date();
    let from;
    if (period === 'day') {
      from = new Date(now); from.setHours(0, 0, 0, 0);
    } else if (period === 'week') {
      from = new Date(now); from.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      from = new Date(now.getFullYear(), 0, 1);
    }

    const where = { adminId, isActive: true };
    if (from) where.startDate = { [Op.gte]: from.toISOString().split('T')[0] };

    const records = await FinancialRecord.findAll({ where });

    // Calcular totales considerando frecuencia
    let totalIncome = 0;
    let totalExpense = 0;

    for (const r of records) {
      const amount = parseFloat(r.amount);
      let effectiveAmount = amount;

      // Para registros recurrentes, calcular cuántas veces aplica en el periodo
      if (period && period !== 'total' && r.frequency !== 'unique') {
        const days = from ? Math.ceil((now - from) / (1000 * 60 * 60 * 24)) : 0;
        if (r.frequency === 'monthly') effectiveAmount = amount * (days / 30);
        else if (r.frequency === 'annual') effectiveAmount = amount * (days / 365);
        else if (r.frequency === 'biweekly') effectiveAmount = amount * (days / 15);
      }

      if (r.type === 'income') totalIncome += effectiveAmount;
      else totalExpense += effectiveAmount;
    }

    res.json({
      period: period || 'total',
      totalIncome: Math.round(totalIncome * 100) / 100,
      totalExpense: Math.round(totalExpense * 100) / 100,
      balance: Math.round((totalIncome - totalExpense) * 100) / 100,
      records,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updateFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await FinancialRecord.update(req.body, { where: { id, adminId: req.user.id } });
    const updated = await FinancialRecord.findByPk(id);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deleteFinancialRecord = async (req, res) => {
  try {
    const { id } = req.params;
    await FinancialRecord.update({ isActive: false }, { where: { id, adminId: req.user.id } });
    res.json({ message: 'Registro eliminado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GUARDIAS EN TIEMPO REAL ────────────────────────────────────────────────
exports.getGuardsLocations = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true, isOnDuty: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const staff = await SecurityStaff.findAll({
      where,
      attributes: ['id', 'firstName', 'lastName', 'lastLatitude', 'lastLongitude', 'lastLocationUpdate', 'neighborhoodId'],
      include: [{ association: 'neighborhood', attributes: ['name'] }],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getClientsLocations = async (req, res) => {
  try {
    const { neighborhoodId } = req.query;
    const where = { isActive: true, locationSharingEnabled: true };
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;

    const clients = await Client.findAll({
      where,
      attributes: ['id', 'firstName', 'lastName', 'lastLatitude', 'lastLongitude', 'lastLocationUpdate'],
    });
    res.json(clients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const alerts = await Alert.findAll({
      where: { type: 'client_emergency' },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });

    // Enriquecer con nombre y barrio del cliente que envió la alerta —
    // mismo criterio que getGuardAlerts (Alert no tiene FK real a Client,
    // ver decisión histórica documentada en el modelo). Antes esta lista no
    // traía ningún dato del cliente: el admin no tenía forma de saber quién
    // envió la emergencia salvo lo que el propio cliente haya escrito en el
    // mensaje.
    const enriched = await Promise.all(
      alerts.map(async (a) => {
        if (!a.senderId) return a.toJSON();
        const client = await Client.findByPk(a.senderId, {
          attributes: ['firstName', 'lastName'],
          include: [{ association: 'neighborhood', attributes: ['name'] }],
        });
        return {
          ...a.toJSON(),
          clientName: client ? `${client.firstName} ${client.lastName}` : null,
          clientNeighborhood: client?.neighborhood?.name || null,
        };
      })
    );

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resolveAlert = async (req, res) => {
  try {
    const { id } = req.params;
    // Acotado a client_emergency: este endpoint es "resolver emergencia de
    // cliente" (ver sección de rutas). guard_alert tiene su propio endpoint
    // de resolución (securityController.resolveGuardAlert, con su propia
    // regla de quién puede resolverla) — sin este filtro, este endpoint
    // podía en teoría tocar cualquier tipo de Alert por id.
    const [count] = await Alert.update(
      { isRead: true, resolvedAt: new Date() },
      { where: { id, type: 'client_emergency' } }
    );
    if (count === 0) return res.status(404).json({ error: 'Alerta no encontrada' });

    // Notificar a todos los admins conectados para que actualicen el contador
    const io = req.app.get('io');
    if (io) io.emit('alert_resolved', { id });
    res.json({ message: 'Alerta resuelta' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── OPERADOR ───────────────────────────────────────────────────────────────

exports.assignOperator = async (req, res) => {
  try {
    const { id } = req.params;

    // Encontrar operador anterior (para sacarlo del room de socket)
    const prevOp = await SecurityStaff.findOne({
      where: { isOperator: true },
      attributes: ['id'],
    });

    // Solo puede haber un operador: quitar el anterior
    await SecurityStaff.update({ isOperator: false }, { where: { isOperator: true } });

    // Asignar el nuevo
    await SecurityStaff.update({ isOperator: true }, { where: { id, isActive: true } });

    const updated = await SecurityStaff.findByPk(id, {
      attributes: { exclude: ['faceDescriptor'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    if (!updated) return res.status(404).json({ error: 'Guardia no encontrado' });

    const io = req.app.get('io');
    if (io) {
      // Sacar al operador anterior del room y notificarlo
      if (prevOp && prevOp.id !== id) {
        makeUserLeaveRoom(prevOp.id, 'role:operator');
        io.to(`user:${prevOp.id}`).emit('operator_assigned', { isOperator: false });
      }
      // Meter al nuevo operador en el room y notificarlo
      makeUserJoinRoom(id, 'role:operator');
      io.to(`user:${id}`).emit('operator_assigned', { isOperator: true });
    }

    res.json({ message: `${updated.firstName} ${updated.lastName} asignado como operador`, staff: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.removeOperator = async (req, res) => {
  try {
    // Encontrar operador actual antes de removerlo
    const prevOp = await SecurityStaff.findOne({
      where: { isOperator: true },
      attributes: ['id'],
    });

    await SecurityStaff.update({ isOperator: false }, { where: { isOperator: true } });

    const io = req.app.get('io');
    if (io && prevOp) {
      makeUserLeaveRoom(prevOp.id, 'role:operator');
      io.to(`user:${prevOp.id}`).emit('operator_assigned', { isOperator: false });
    }

    res.json({ message: 'Operador removido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── HISTORIAL ALERTAS DE GUARDIAS ─────────────────────────────────────────

exports.getGuardAlerts = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const alerts = await Alert.findAndCountAll({
      where: { type: 'guard_alert' },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    // Enriquecer con nombre del guardia y su contacto
    const { rows, count } = alerts;
    const enriched = await Promise.all(
      rows.map(async (a) => {
        if (!a.senderId) return a.toJSON();
        const guard = await SecurityStaff.findByPk(a.senderId, {
          attributes: ['firstName', 'lastName', 'contact'],
        });
        return {
          ...a.toJSON(),
          guardFirstName: guard?.firstName || null,
          guardLastName:  guard?.lastName  || null,
          guardContact:   guard?.contact   || null,
        };
      })
    );

    res.json({ count, rows: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
