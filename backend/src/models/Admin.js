const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const Admin = sequelize.define('Admin', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Mismo campo que SecurityStaff/Client — hasta ahora solo esos dos roles
  // podían recibir push (el admin nunca tuvo dónde guardarlo, aunque
  // AdminLoginScreen ya intentaba registrarlo). Necesario para que una
  // emergencia de cliente/guardia le llegue al admin aunque tenga la app
  // cerrada (antes solo se enteraba por socket, si estaba conectado).
  expoPushToken: {
    type: DataTypes.STRING,
  },
}, {
  hooks: {
    beforeCreate: async (admin) => {
      admin.password = await bcrypt.hash(admin.password, 10);
    },
    beforeUpdate: async (admin) => {
      if (admin.changed('password')) {
        admin.password = await bcrypt.hash(admin.password, 10);
      }
    },
  },
});

Admin.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = Admin;
