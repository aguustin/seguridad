const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Registro de que un guardia pasó por un checkpoint durante una sesión de
 * ronda. El guardia se obtiene indirectamente vía
 * patrolSessionId → PatrolSession.securityStaffId (no se duplica acá).
 */
const PatrolCheckpointVisit = sequelize.define('PatrolCheckpointVisit', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patrolSessionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'PatrolSessions',
      key: 'id',
    },
  },
  patrolCheckpointId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'PatrolCheckpoints',
      key: 'id',
    },
  },
  visitedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = PatrolCheckpointVisit;
