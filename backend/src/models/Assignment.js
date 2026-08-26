const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Tarea puntual que un admin le asigna a un guardia específico (ej. "revisar
 * el portón trasero"). Distinta de Alert (que es una notificación sin
 * estado de cumplimiento) y de PatrolSession (que sigue una ruta
 * predefinida con checkpoints) — acá lo único que importa es si se
 * completó o no.
 */
const Assignment = sequelize.define('Assignment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  neighborhoodId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Neighborhoods', key: 'id' },
  },
  securityStaffId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'SecurityStaffs', key: 'id' },
  },
  assignedByAdminId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Admins', key: 'id' },
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending',
  },
  completedAt: {
    type: DataTypes.DATE,
  },
  // Cuándo se le mandó el push de "seguís con esta tarea pendiente" (ver
  // services/reminderService.js). null = todavía no se le recordó. Evita
  // mandarle el mismo recordatorio una y otra vez en cada barrido del
  // servicio mientras siga pending.
  reminderSentAt: {
    type: DataTypes.DATE,
  },
});

module.exports = Assignment;
