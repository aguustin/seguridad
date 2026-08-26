const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Registro de acciones administrativas de alto impacto (quién hizo qué,
 * sobre qué entidad, cuándo). Es un log de solo lectura — nunca se edita
 * una fila ya creada, por eso `updatedAt` queda deshabilitado.
 *
 * `actorRole`/`entityType` son STRING (no ENUM, a diferencia de otros
 * campos categóricos del proyecto como Alert.type): el set de acciones
 * auditadas es intencionalmente chico hoy pero puede crecer, y agregar un
 * valor a un ENUM de Postgres bajo el esquema de `sync({alter:true})` que
 * ya usa el proyecto (sin migraciones versionadas) es más frágil que
 * agregar un string nuevo.
 *
 * `entityId` es un UUID suelto sin FK real a propósito: puede apuntar a
 * SecurityStaff, PatrolRoute, PatrolCheckpoint, FinancialRecord,
 * Assignment o Alert según `entityType` — igual que Alert/Message en este
 * mismo proyecto, una FK real no es posible cuando el destino es
 * polimórfico entre varias tablas.
 */
const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  actorId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'Admins', key: 'id' },
  },
  actorRole: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'admin',
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entityType: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entityId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
  },
}, {
  updatedAt: false, // un log nunca se edita
});

module.exports = AuditLog;
