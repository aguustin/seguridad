const { Op } = require('sequelize');
const { Assignment, SecurityStaff } = require('../models');
const { sendPushNotification } = require('../services/notificationService');
const auditService = require('../services/auditService');

// ── ASIGNACIONES (admin) ────────────────────────────────────────────────────
// Tarea puntual asignada a un guardia específico, con seguimiento de si se
// completó — a diferencia de Alert (admin_to_security), que es solo una
// notificación sin estado de cumplimiento.
exports.createAssignment = async (req, res) => {
  try {
    const { securityStaffId, title, description } = req.body;
    if (!securityStaffId || !title?.trim()) {
      return res.status(400).json({ error: 'securityStaffId y title son obligatorios' });
    }

    const staff = await SecurityStaff.findOne({ where: { id: securityStaffId, isActive: true } });
    if (!staff) return res.status(400).json({ error: 'El guardia indicado no existe o no está activo' });
    if (!staff.neighborhoodId) {
      return res.status(400).json({ error: 'El guardia todavía no tiene un barrio asignado' });
    }

    const assignment = await Assignment.create({
      neighborhoodId: staff.neighborhoodId,
      securityStaffId,
      assignedByAdminId: req.user.id,
      title: title.trim(),
      description: description?.trim() || null,
    });

    // Notificar al guardia: socket (room personal, para si tiene la app
    // abierta) + push siempre que tenga token (para si no la tiene) — se
    // mandan ambos sin condicionar uno al otro, mismo criterio que el resto
    // de los eventos de este bloque (ver notificationService). También a
    // role:admin (ej. Centro de Control): si hay más de un admin
    // conectado, antes solo se enteraba el que la creó.
    const io = req.app.get('io');
    if (io) io.to([`user:${securityStaffId}`, 'role:admin']).emit('assignment_created', assignment.toJSON());
    if (staff.expoPushToken) {
      await sendPushNotification(
        staff.expoPushToken,
        '📋 Nueva tarea asignada',
        title.trim(),
        { type: 'assignment' }
      );
    }

    res.status(201).json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAssignments = async (req, res) => {
  try {
    const {
      securityStaffId, neighborhoodId, status, from, to,
      limit = 50, offset = 0,
    } = req.query;

    const where = {};
    if (securityStaffId) where.securityStaffId = securityStaffId;
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;
    if (status) where.status = status;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const result = await Assignment.findAndCountAll({
      where,
      include: [
        { association: 'staff', attributes: ['id', 'firstName', 'lastName'] },
        { association: 'neighborhood', attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await Assignment.findByPk(id);
    if (!assignment) return res.status(404).json({ error: 'Asignación no encontrada' });
    if (assignment.status !== 'pending') {
      return res.status(400).json({ error: 'Solo se puede cancelar una asignación pendiente' });
    }

    await assignment.update({ status: 'cancelled' });

    await auditService.log({
      actorId: req.user.id,
      action: 'assignment.cancel',
      entityType: 'Assignment',
      entityId: assignment.id,
      metadata: { title: assignment.title, securityStaffId: assignment.securityStaffId },
    });

    const io = req.app.get('io');
    if (io) io.to([`user:${assignment.securityStaffId}`, 'role:admin']).emit('assignment_cancelled', { id });

    // Push al guardia — evita que siga una tarea que ya no corresponde si
    // no tiene la app abierta en ese momento (antes solo se enteraba si
    // estaba conectado al socket).
    const staff = await SecurityStaff.findByPk(assignment.securityStaffId, { attributes: ['expoPushToken'] });
    if (staff?.expoPushToken) {
      await sendPushNotification(
        staff.expoPushToken,
        '❌ Tarea cancelada',
        assignment.title,
        { type: 'assignment' }
      );
    }

    res.json(assignment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
