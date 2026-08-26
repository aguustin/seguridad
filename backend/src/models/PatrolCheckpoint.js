const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Punto de control de una ruta de ronda. `radiusMeters` es el radio de
 * validación (qué tan cerca tiene que estar el guardia para que cuente
 * como "pasó por acá" al registrar por GPS — ver
 * securityController.registerCheckpointVisit). También se puede registrar
 * escaneando un QR físico pegado en el lugar, sin depender del radio (ver
 * securityController.scanCheckpointQR y PatrolCheckpointVisit.method).
 */
const PatrolCheckpoint = sequelize.define('PatrolCheckpoint', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  patrolRouteId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'PatrolRoutes',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  radiusMeters: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 20,
  },
});

module.exports = PatrolCheckpoint;
