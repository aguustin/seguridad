const Admin = require('./Admin');
const Neighborhood = require('./Neighborhood');
const SecurityStaff = require('./SecurityStaff');
const Client = require('./Client');
const AttendanceRecord = require('./AttendanceRecord');
const Alert = require('./Alert');
const Message = require('./Message');
const FinancialRecord = require('./FinancialRecord');
const KioskState = require('./KioskState');
const LocationPoint = require('./LocationPoint');
const PatrolRoute = require('./PatrolRoute');
const PatrolCheckpoint = require('./PatrolCheckpoint');
const PatrolSession = require('./PatrolSession');
const PatrolCheckpointVisit = require('./PatrolCheckpointVisit');

// Associations
Neighborhood.hasMany(SecurityStaff, { foreignKey: 'neighborhoodId', as: 'staff' });
SecurityStaff.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

Neighborhood.hasMany(Client, { foreignKey: 'neighborhoodId', as: 'clients' });
Client.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

SecurityStaff.hasMany(AttendanceRecord, { foreignKey: 'securityStaffId', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(SecurityStaff, { foreignKey: 'securityStaffId', as: 'staff' });

Neighborhood.hasMany(AttendanceRecord, { foreignKey: 'neighborhoodId', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

KioskState.belongsTo(Admin, { foreignKey: 'updatedByAdminId', as: 'updatedByAdmin' });

SecurityStaff.hasMany(LocationPoint, { foreignKey: 'securityStaffId', as: 'locationPoints' });
LocationPoint.belongsTo(SecurityStaff, { foreignKey: 'securityStaffId', as: 'securityStaff' });

Client.hasMany(LocationPoint, { foreignKey: 'clientId', as: 'locationPoints' });
LocationPoint.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// ── Rondas (solo modelos + asociaciones en esta etapa) ─────────────────────
Neighborhood.hasMany(PatrolRoute, { foreignKey: 'neighborhoodId', as: 'patrolRoutes' });
PatrolRoute.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

PatrolRoute.hasMany(PatrolCheckpoint, { foreignKey: 'patrolRouteId', as: 'checkpoints' });
PatrolCheckpoint.belongsTo(PatrolRoute, { foreignKey: 'patrolRouteId', as: 'route' });

PatrolRoute.hasMany(PatrolSession, { foreignKey: 'patrolRouteId', as: 'sessions' });
PatrolSession.belongsTo(PatrolRoute, { foreignKey: 'patrolRouteId', as: 'route' });

SecurityStaff.hasMany(PatrolSession, { foreignKey: 'securityStaffId', as: 'patrolSessions' });
PatrolSession.belongsTo(SecurityStaff, { foreignKey: 'securityStaffId', as: 'staff' });

PatrolSession.hasMany(PatrolCheckpointVisit, { foreignKey: 'patrolSessionId', as: 'checkpointVisits' });
PatrolCheckpointVisit.belongsTo(PatrolSession, { foreignKey: 'patrolSessionId', as: 'session' });

PatrolCheckpoint.hasMany(PatrolCheckpointVisit, { foreignKey: 'patrolCheckpointId', as: 'visits' });
PatrolCheckpointVisit.belongsTo(PatrolCheckpoint, { foreignKey: 'patrolCheckpointId', as: 'checkpoint' });

module.exports = {
  Admin,
  Neighborhood,
  SecurityStaff,
  Client,
  AttendanceRecord,
  Alert,
  Message,
  FinancialRecord,
  KioskState,
  LocationPoint,
  PatrolRoute,
  PatrolCheckpoint,
  PatrolSession,
  PatrolCheckpointVisit,
};
