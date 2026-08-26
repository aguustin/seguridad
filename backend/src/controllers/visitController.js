const { Op } = require('sequelize');
const { Visit } = require('../models');

// ── VISITAS (vista administrativa, solo lectura) ────────────────────────────
// Las visitas las crea/cierra el guardia en la puerta (ver
// securityController.js) — admin solo consulta, con filtros simples, mismo
// criterio que patrolController.getSessions.
exports.getVisits = async (req, res) => {
  try {
    const {
      neighborhoodId, securityStaffId, active, from, to,
      limit = 50, offset = 0,
    } = req.query;

    const where = {};
    if (neighborhoodId) where.neighborhoodId = neighborhoodId;
    if (securityStaffId) where.registeredByStaffId = securityStaffId;
    if (active === 'true') where.exitAt = null;
    else if (active === 'false') where.exitAt = { [Op.ne]: null };
    if (from || to) {
      where.entryAt = {};
      if (from) where.entryAt[Op.gte] = new Date(from);
      if (to) where.entryAt[Op.lte] = new Date(to);
    }

    const result = await Visit.findAndCountAll({
      where,
      include: [
        { association: 'neighborhood', attributes: ['id', 'name'] },
        { association: 'registeredBy', attributes: ['id', 'firstName', 'lastName'] },
        { association: 'destinationClient', attributes: ['id', 'firstName', 'lastName'] },
      ],
      order: [['entryAt', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
