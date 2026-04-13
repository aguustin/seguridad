const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM('admin_to_security', 'client_emergency', 'client_to_admin', 'guard_alert'),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  reason: {
    type: DataTypes.TEXT, // razón de la alerta del guardia
  },
  // Quien envía
  senderId: {
    type: DataTypes.UUID,
  },
  senderType: {
    type: DataTypes.ENUM('admin', 'client', 'security'),
  },
  // Destino
  targetNeighborhoodId: {
    type: DataTypes.UUID,
  },
  targetSecurityId: {
    type: DataTypes.UUID,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Para emergencias de cliente
  clientLatitude: {
    type: DataTypes.DOUBLE,
  },
  clientLongitude: {
    type: DataTypes.DOUBLE,
  },
  resolvedAt: {
    type: DataTypes.DATE,
  },
});

module.exports = Alert;
