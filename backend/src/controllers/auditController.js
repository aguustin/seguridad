const { Op } = require('sequelize');
const { AuditLog } = require('../models');

// ── AUDITORÍA (admin, solo lectura) ─────────────────────────────────────────
// Los registros los crea auditService.log() desde los controllers que
// hacen la acción — acá solo se consultan, con filtros simples, mismo
// criterio que patrolController.getSessions/visitController.getVisits.
exports.getAuditLogs = async (req, res) => {
  try {
    const { action, entityType, from, to, limit = 50, offset = 0 } = req.query;

    const where = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(from);
      if (to) where.createdAt[Op.lte] = new Date(to);
    }

    const result = await AuditLog.findAndCountAll({
      where,
      include: [{ association: 'actor', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
