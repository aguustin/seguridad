const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const Client = sequelize.define('Client', {
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
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  age: {
    type: DataTypes.INTEGER,
  },
  profilePhoto: {
    type: DataTypes.STRING,
  },
  neighborhoodId: {
    type: DataTypes.UUID,
    references: {
      model: 'Neighborhoods',
      key: 'id',
    },
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  // Ubicación en tiempo real
  locationSharingEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
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
}, {
  hooks: {
    beforeCreate: async (client) => {
      client.password = await bcrypt.hash(client.password, 10);
    },
    beforeUpdate: async (client) => {
      if (client.changed('password')) {
        client.password = await bcrypt.hash(client.password, 10);
      }
    },
  },
});

Client.prototype.validatePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

module.exports = Client;
