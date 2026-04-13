const Admin = require('./Admin');
const Neighborhood = require('./Neighborhood');
const SecurityStaff = require('./SecurityStaff');
const Client = require('./Client');
const AttendanceRecord = require('./AttendanceRecord');
const Alert = require('./Alert');
const Message = require('./Message');
const FinancialRecord = require('./FinancialRecord');

// Associations
Neighborhood.hasMany(SecurityStaff, { foreignKey: 'neighborhoodId', as: 'staff' });
SecurityStaff.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

Neighborhood.hasMany(Client, { foreignKey: 'neighborhoodId', as: 'clients' });
Client.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

SecurityStaff.hasMany(AttendanceRecord, { foreignKey: 'securityStaffId', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(SecurityStaff, { foreignKey: 'securityStaffId', as: 'staff' });

Neighborhood.hasMany(AttendanceRecord, { foreignKey: 'neighborhoodId', as: 'attendanceRecords' });
AttendanceRecord.belongsTo(Neighborhood, { foreignKey: 'neighborhoodId', as: 'neighborhood' });

module.exports = {
  Admin,
  Neighborhood,
  SecurityStaff,
  Client,
  AttendanceRecord,
  Alert,
  Message,
  FinancialRecord,
};
