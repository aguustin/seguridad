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
}, {
  indexes: [
    // Garantiza a nivel de DB que un checkpoint no se registre dos veces en
    // la misma ronda — el controller ya valida esto con un findOne antes de
    // crear (ver securityController.registerCheckpointVisit), pero esa
    // validación por sí sola no cubre dos requests casi simultáneas. Se
    // define como índice del modelo (no una migración aparte) para que
    // sequelize.sync({alter:true}) lo cree igual que el resto del esquema.
    {
      unique: true,
      fields: ['patrolSessionId', 'patrolCheckpointId'],
    },
  ],
});

module.exports = PatrolCheckpointVisit;
