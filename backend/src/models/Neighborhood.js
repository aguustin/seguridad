const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Neighborhood = sequelize.define('Neighborhood', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
  },
  description: {
    type: DataTypes.TEXT,
  },
  latitude: {
    // DOUBLE, no FLOAT: estandariza con SecurityStaff/Client/Alert/
    // LocationPoint/PatrolCheckpoint, que ya usaban DOUBLE (era el único
    // modelo con lat/lng en FLOAT).
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: true,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = Neighborhood;
