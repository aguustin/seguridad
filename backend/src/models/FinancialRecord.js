const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FinancialRecord = sequelize.define('FinancialRecord', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  adminId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  type: {
    type: DataTypes.ENUM('income', 'expense'),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING, // ej: "salario", "equipamiento", "cuota barrio"
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  // Frecuencia del registro
  frequency: {
    type: DataTypes.ENUM('unique', 'monthly', 'annual', 'biweekly'),
    allowNull: false,
    defaultValue: 'unique',
  },
  // Fecha del primer registro / registro base
  startDate: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  // Referencia a barrio (opcional)
  neighborhoodId: {
    type: DataTypes.UUID,
  },
  // Referencia a guardia (para registro de pago)
  securityStaffId: {
    type: DataTypes.UUID,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = FinancialRecord;
