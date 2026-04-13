const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // 'security_chat' = chat entre guardias del mismo barrio
  // 'client_admin'  = chat entre cliente y admin
  roomType: {
    type: DataTypes.ENUM('security_chat', 'client_admin'),
    allowNull: false,
  },
  // ID del barrio (para security_chat) o ID del cliente (para client_admin)
  roomId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  senderType: {
    type: DataTypes.ENUM('admin', 'security', 'client'),
    allowNull: false,
  },
  senderName: {
    type: DataTypes.STRING,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

module.exports = Message;
