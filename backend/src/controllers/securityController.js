const { SecurityStaff, AttendanceRecord, Message, Alert } = require('../models');
const checkinService = require('../services/checkinService');

exports.getMyProfile = async (req, res) => {
  try {
    const staff = await SecurityStaff.findByPk(req.user.id, {
      attributes: { exclude: ['faceDescriptor'] },
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    if (!staff) return res.status(404).json({ error: 'Perfil no encontrado' });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyAttendance = async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;
    const records = await AttendanceRecord.findAndCountAll({
      where: { securityStaffId: req.user.id },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['checkIn', 'DESC']],
    });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getActiveColleagues = async (req, res) => {
  try {
    const staff = await SecurityStaff.findAll({
      where: {
        neighborhoodId: req.user.neighborhoodId,
        isOnDuty: true,
        isActive: true,
      },
      attributes: ['id', 'firstName', 'lastName', 'profilePhoto', 'isOnDuty', 'isOperator'],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Para el operador: lista todos los guardias activos de su barrio con estado de check-in
exports.getActiveGuardsStatus = async (req, res) => {
  try {
    const staff = await SecurityStaff.findAll({
      where: { isOnDuty: true, isActive: true },
      attributes: ['id', 'firstName', 'lastName', 'profilePhoto', 'contact', 'neighborhoodId'],
      include: [{ association: 'neighborhood', attributes: ['id', 'name'] }],
    });
    res.json(staff);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getChatMessages = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const neighborhoodId = req.user.neighborhoodId;

    const messages = await Message.findAndCountAll({
      where: { roomType: 'security_chat', roomId: neighborhoodId },
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ ...messages, rows: messages.rows.reverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyAlerts = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const neighborhoodId = req.user.neighborhoodId;

    const alerts = await Alert.findAll({
      where: {
        type: 'admin_to_security',
        [Op.or]: [
          { targetNeighborhoodId: neighborhoodId },
          { targetSecurityId: req.user.id },
          { targetNeighborhoodId: null, targetSecurityId: null },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── ALERTAS DEL GUARDIA ────────────────────────────────────────────────────

exports.sendGuardAlert = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason?.trim()) {
      return res.status(400).json({ error: 'La razón de la alerta es obligatoria' });
    }

    const guard = await SecurityStaff.findByPk(req.user.id, {
      attributes: ['firstName', 'lastName', 'contact'],
    });

    const alert = await Alert.create({
      type: 'guard_alert',
      title: '⚠️ ALERTA DE GUARDIA',
      message: `${guard.firstName} ${guard.lastName}: ${reason}`,
      reason,
      senderId: req.user.id,
      senderType: 'security',
    });

    const io = req.app.get('io');
    if (io) {
      const payload = {
        ...alert.toJSON(),
        guardFirstName: guard.firstName,
        guardLastName:  guard.lastName,
        guardContact:   guard.contact,
      };
      // Siempre va al admin
      io.to('role:admin').emit('guard_alert', payload);
      // También va al operador si hay uno
      io.to('role:operator').emit('guard_alert', payload);
    }

    res.status(201).json({ message: 'Alerta enviada', alert });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resolveGuardAlert = async (req, res) => {
  try {
    const { id } = req.params;
    // Solo el guardia que la envió puede resolverla
    const alert = await Alert.findOne({ where: { id, senderId: req.user.id, type: 'guard_alert' } });
    if (!alert) return res.status(404).json({ error: 'Alerta no encontrada' });

    await alert.update({ isRead: true, resolvedAt: new Date() });

    const io = req.app.get('io');
    if (io) {
      io.to('role:admin').emit('guard_alert_resolved', { id });
      io.to('role:operator').emit('guard_alert_resolved', { id });
    }

    res.json({ message: 'Alerta terminada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMyActiveAlert = async (req, res) => {
  try {
    const alert = await Alert.findOne({
      where: { senderId: req.user.id, type: 'guard_alert', isRead: false },
      order: [['createdAt', 'DESC']],
    });
    res.json(alert || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CHECK-IN ───────────────────────────────────────────────────────────────

exports.confirmCheckin = async (req, res) => {
  try {
    const { sessionId } = req.body;
    const current = checkinService.getCurrentSessionId();
    if (sessionId && sessionId !== current) {
      return res.status(400).json({ error: 'Sesión de check-in no válida o ya expirada' });
    }
    checkinService.confirmCheckin(req.user.id, sessionId || current);
    res.json({ message: 'Check-in confirmado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── LOGOUT (limpia isOperator) ─────────────────────────────────────────────

exports.securityLogout = async (req, res) => {
  try {
    const staff = await SecurityStaff.findByPk(req.user.id, { attributes: ['isOperator'] });
    if (staff?.isOperator) {
      await SecurityStaff.update({ isOperator: false }, { where: { id: req.user.id } });
      // Notificar para que el socket salga de role:operator
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('operator_assigned', { isOperator: false });
      }
    }
    res.json({ message: 'Logout registrado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
