const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Registro de ingreso/egreso de un VISITANTE al barrio — no confundir con
 * AttendanceRecord (que es el turno del GUARDIA). `exitAt` null = el
 * visitante todavía está adentro, mismo patrón que AttendanceRecord.checkOut.
 *
 * `destinationClientId` es opcional a propósito: no todo destino tiene una
 * cuenta de Client cargada (ej. visita a un vecino sin la app), por eso
 * conviven con `destinationDescription` como texto libre — se exige al
 * menos uno de los dos (validado en el controller, no acá).
 */
const Visit = sequelize.define('Visit', {
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
  registeredByStaffId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'SecurityStaffs', key: 'id' },
  },
  destinationClientId: {
    type: DataTypes.UUID,
    references: { model: 'Clients', key: 'id' },
  },
  visitorName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  visitorDocument: {
    type: DataTypes.STRING,
  },
  destinationDescription: {
    type: DataTypes.STRING,
  },
  authorizedBy: {
    type: DataTypes.STRING,
  },
  vehiclePlate: {
    type: DataTypes.STRING,
  },
  notes: {
    type: DataTypes.TEXT,
  },
  entryAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  exitAt: {
    type: DataTypes.DATE,
  },
});

module.exports = Visit;
