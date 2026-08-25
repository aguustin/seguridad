const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Ruta de ronda: un recorrido definido dentro de un barrio, compuesto por
 * checkpoints (ver PatrolCheckpoint). Es la "plantilla" de la ronda — las
 * ejecuciones concretas de un guardia recorriéndola son PatrolSession.
 */
const PatrolRoute = sequelize.define('PatrolRoute', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  neighborhoodId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Neighborhoods',
      key: 'id',
    },
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = PatrolRoute;
