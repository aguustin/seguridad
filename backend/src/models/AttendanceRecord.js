const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AttendanceRecord = sequelize.define('AttendanceRecord', {
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
  neighborhoodId: {
    type: DataTypes.UUID,
    references: {
      model: 'Neighborhoods',
      key: 'id',
    },
  },
  checkIn: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  checkOut: {
    type: DataTypes.DATE,
  },
  // Diferencia en minutos respecto al turno programado (positivo = tarde)
  checkInDelayMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  notes: {
    type: DataTypes.TEXT,
  },
});

module.exports = AttendanceRecord;
