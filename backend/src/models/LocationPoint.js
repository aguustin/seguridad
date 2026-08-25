const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Historial de puntos GPS (guardias y clientes).
 *
 * Es aditivo: NO reemplaza lastLatitude/lastLongitude/lastLocationUpdate en
 * SecurityStaff/Client — esas columnas siguen siendo "la última posición
 * conocida" y las sigue usando el mapa en vivo
 * (getGuardsLocations/getClientsLocations). Este modelo solo acumula el
 * historial completo para features futuras (ej. rondas).
 *
 * A diferencia de Alert/Message (un UUID+tipo suelto sin FK real, por
 * decisión histórica del proyecto), acá el conjunto de tipos de entidad es
 * chico y fijo (guardia o cliente) — así que en vez de un entityId
 * polimórfico sin integridad referencial, se usan dos FK reales y nullable
 * (securityStaffId / clientId), completando exactamente una de las dos por
 * fila. entityType queda como columna explícita para poder filtrar por
 * tipo sin depender de "cuál de las dos FK no es null".
 */
const LocationPoint = sequelize.define('LocationPoint', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  entityType: {
    type: DataTypes.ENUM('security', 'client'),
    allowNull: false,
  },
  securityStaffId: {
    type: DataTypes.UUID,
    references: {
      model: 'SecurityStaffs',
      key: 'id',
    },
  },
  clientId: {
    type: DataTypes.UUID,
    references: {
      model: 'Clients',
      key: 'id',
    },
  },
  latitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DOUBLE,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = LocationPoint;
