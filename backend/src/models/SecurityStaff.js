const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SecurityStaff = sequelize.define('SecurityStaff', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  documentNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  age: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  profilePhoto: {
    type: DataTypes.STRING, // ruta al archivo
  },
  faceDescriptor: {
    type: DataTypes.TEXT, // JSON del descriptor facial
  },
  neighborhoodId: {
    type: DataTypes.UUID,
    references: {
      model: 'Neighborhoods',
      key: 'id',
    },
  },
  // Turno: hora de entrada y salida esperadas
  shiftStart: {
    type: DataTypes.STRING, // "08:00"
  },
  shiftEnd: {
    type: DataTypes.STRING, // "16:00"
  },
  // Fecha de pago (dia del mes, ej: 15, 30)
  paymentDay: {
    type: DataTypes.INTEGER,
  },
  salary: {
    type: DataTypes.DECIMAL(10, 2),
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  isOnDuty: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // Ubicación en tiempo real
  lastLatitude: {
    type: DataTypes.DOUBLE,
  },
  lastLongitude: {
    type: DataTypes.DOUBLE,
  },
  lastLocationUpdate: {
    type: DataTypes.DATE,
  },
  expoPushToken: {
    type: DataTypes.STRING,
  },
  // Número de contacto (teléfono)
  contact: {
    type: DataTypes.STRING,
  },
  // Si este guardia es el operador activo
  isOperator: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = SecurityStaff;
