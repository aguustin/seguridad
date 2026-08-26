const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Ejecución concreta de una ronda: un guardia recorriendo una PatrolRoute.
 * `endedAt` null = ronda en curso (mismo patrón que AttendanceRecord.checkOut).
 */
const PatrolSession = sequelize.define('PatrolSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  securityStaffId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'SecurityStaffs',
      key: 'id',
    },
  },
  patrolRouteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'PatrolRoutes',
      key: 'id',
    },
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  endedAt: {
    type: DataTypes.DATE,
  },
  status: {
    type: DataTypes.ENUM('in_progress', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'in_progress',
  },
  // Cuándo se le mandó el push de "esta ronda sigue en curso, ¿te olvidaste
  // de finalizarla?" (ver services/reminderService.js). null = todavía no.
  reminderSentAt: {
    type: DataTypes.DATE,
  },
});

module.exports = PatrolSession;
