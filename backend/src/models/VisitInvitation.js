const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Invitación de visita generada por un CLIENTE (residente) para agilizar el
 * ingreso de un visitante esperado — el guardia escanea el QR en vez de
 * tipear los datos a mano. El QR en sí solo codifica este `id` (ver
 * clientController.createVisitInvitation): es un puntero opaco a este
 * registro, nunca contiene los datos reales — así no hace falta firmarlo
 * ni cifrarlo para evitar manipulación (cambiar el UUID a mano solo lleva
 * a "no encontrada", no a poder inventar una autorización), y toda la
 * validación real (vencimiento, uso único, barrio) vive acá en el server.
 *
 * `usedAt`/`usedVisitId` marcan que ya se consumió — de un solo uso, mismo
 * criterio que una invitación puntual para una visita concreta (no una
 * credencial reutilizable).
 */
const VisitInvitation = sequelize.define('VisitInvitation', {
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
  createdByClientId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Clients', key: 'id' },
  },
  visitorName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  usedAt: {
    type: DataTypes.DATE,
  },
  usedVisitId: {
    type: DataTypes.UUID,
    references: { model: 'Visits', key: 'id' },
  },
});

module.exports = VisitInvitation;
