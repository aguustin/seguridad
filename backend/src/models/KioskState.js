const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Estado global del kiosco de acceso (fila única, id fijo = 1).
 *
 * Representa si los dispositivos en "modo escáner" (ver KioskContext en
 * mobile) tienen permitido registrar check-in/check-out facial en este
 * momento. Es independiente del modo escáner del dispositivo: un celular
 * puede seguir bloqueado en la pantalla de escaneo (KioskContext) mientras
 * este estado está en `false` — en ese caso el dispositivo debe mostrar
 * "kiosco cerrado" sin activar la cámara.
 *
 * Es una fila única a propósito: hoy el dispositivo kiosco no hace login
 * (no tiene forma de identificar a qué barrio pertenece), así que no
 * corresponde un estado por barrio todavía.
 */
const KioskState = sequelize.define('KioskState', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    defaultValue: 1,
  },
  isOpen: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false, // cerrado por defecto: nadie escanea hasta que un admin lo abra
  },
  updatedByAdminId: {
    type: DataTypes.UUID,
    references: {
      model: 'Admins',
      key: 'id',
    },
  },
});

module.exports = KioskState;
