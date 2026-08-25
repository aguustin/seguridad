const jwt = require('jsonwebtoken');
const { SecurityStaff, Client } = require('../models');
const checkinService = require('./checkinService');

// Mapa de usuarios conectados: userId -> socketId
const connectedUsers = new Map();

// Referencia al servidor Socket.io (se setea en initSocket)
let _io = null;

/**
 * Hace que el socket de un usuario en línea entre a una room.
 * Si el usuario no está conectado, no hace nada.
 */
function makeUserJoinRoom(userId, room) {
  const socketId = connectedUsers.get(userId);
  if (!socketId || !_io) return;
  const socket = _io.sockets.sockets.get(socketId);
  if (socket) socket.join(room);
}

/**
 * Hace que el socket de un usuario en línea salga de una room.
 */
function makeUserLeaveRoom(userId, room) {
  const socketId = connectedUsers.get(userId);
  if (!socketId || !_io) return;
  const socket = _io.sockets.sockets.get(socketId);
  if (socket) socket.leave(room);
}

function initSocket(io) {
  _io = io;
  // Autenticación del socket via token JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('No token'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch {
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId, role, neighborhoodId } = socket.user;
    connectedUsers.set(userId, socket.id);
    console.log(`[Socket] Conectado: ${role} ${userId}`);

    // Unirse a sala del barrio
    if (neighborhoodId) {
      socket.join(`neighborhood:${neighborhoodId}`);
    }

    // Sala por rol
    socket.join(`role:${role}`);

    // Sala personal para mensajes directos
    socket.join(`user:${userId}`);

    // Marcar guardia como activo
    if (role === 'security') {
      await SecurityStaff.update({ isOnDuty: true }, { where: { id: userId } });
      // Notificar al barrio
      io.to(`neighborhood:${neighborhoodId}`).emit('guard_status_change', {
        guardId: userId,
        status: 'online',
      });

      // Si es operador, unirse a sala de operadores
      const staff = await SecurityStaff.findByPk(userId, { attributes: ['isOperator'] });
      if (staff?.isOperator) {
        socket.join('role:operator');
        console.log(`[Socket] Guardia ${userId} es operador, unido a role:operator`);
      }
    }

    // === MENSAJES DE CHAT ===
    socket.on('send_message', async (data) => {
      const { roomType, roomId, content } = data;
      const { Message } = require('../models');

      const senderName =
        role === 'admin'
          ? 'Administrador'
          : role === 'security'
          ? `Guardia ${userId.slice(0, 6)}`
          : `Cliente ${userId.slice(0, 6)}`;

      const message = await Message.create({
        roomType,
        roomId,
        senderId: userId,
        senderType: role,
        senderName,
        content,
      });

      const roomKey =
        roomType === 'security_chat' ? `neighborhood:${roomId}` : `client_chat:${roomId}`;

      io.to(roomKey).emit('new_message', message.toJSON());
    });

    // === UBICACIÓN EN TIEMPO REAL ===
    socket.on('update_location', async ({ latitude, longitude }) => {
      const { LocationPoint } = require('../models');

      if (role === 'security') {
        await SecurityStaff.update(
          { lastLatitude: latitude, lastLongitude: longitude, lastLocationUpdate: new Date() },
          { where: { id: userId } }
        );
        // Historial de puntos GPS (aditivo — no reemplaza lastLatitude/
        // lastLongitude). Se guarda en un try/catch propio para que un
        // problema acá nunca rompa la actualización de "última posición"
        // ni el evento realtime, que es lo que hoy usa el mapa en vivo.
        try {
          await LocationPoint.create({ entityType: 'security', securityStaffId: userId, latitude, longitude });
        } catch (err) {
          console.error('[Socket] Error guardando LocationPoint (security):', err.message);
        }
        io.to('role:admin').emit('guard_location_update', {
          guardId: userId,
          neighborhoodId,
          latitude,
          longitude,
          timestamp: new Date(),
        });
      } else if (role === 'client') {
        await Client.update(
          { lastLatitude: latitude, lastLongitude: longitude, lastLocationUpdate: new Date() },
          { where: { id: userId } }
        );
        try {
          await LocationPoint.create({ entityType: 'client', clientId: userId, latitude, longitude });
        } catch (err) {
          console.error('[Socket] Error guardando LocationPoint (client):', err.message);
        }
        io.to('role:admin').emit('client_location_update', {
          clientId: userId,
          latitude,
          longitude,
          timestamp: new Date(),
        });
      }
    });

    // === UNIRSE A CHAT CLIENTE-ADMIN ===
    socket.on('join_client_chat', ({ clientId }) => {
      socket.join(`client_chat:${clientId}`);
    });

    // La emergencia de cliente se crea y emite exclusivamente por REST
    // (ver clientController.sendEmergencyAlert) — antes también existía acá
    // un handler 'client_emergency' que duplicaba la creación del Alert y
    // el emit de 'emergency_alert', generando 2 registros por cada botón de
    // pánico. Se eliminó: REST ya crea el Alert y emite el evento a
    // 'role:admin' con el io inyectado en req.app.

    // === CONFIRMACIÓN DE CHECK-IN (guardia) ===
    socket.on('checkin_confirm', ({ sessionId }) => {
      if (role === 'security') {
        checkinService.confirmCheckin(userId, sessionId);
      }
    });

    // === ACTUALIZAR EXPO PUSH TOKEN ===
    socket.on('register_push_token', async ({ token: pushToken }) => {
      if (role === 'security') {
        await SecurityStaff.update({ expoPushToken: pushToken }, { where: { id: userId } });
      } else if (role === 'client') {
        await Client.update({ expoPushToken: pushToken }, { where: { id: userId } });
      }
    });

    // === DESCONEXIÓN ===
    socket.on('disconnect', async () => {
      connectedUsers.delete(userId);
      console.log(`[Socket] Desconectado: ${role} ${userId}`);

      if (role === 'security') {
        await SecurityStaff.update({ isOnDuty: false }, { where: { id: userId } });
        io.to(`neighborhood:${neighborhoodId}`).emit('guard_status_change', {
          guardId: userId,
          status: 'offline',
        });
      }
    });
  });
}

function getConnectedUsers() {
  return connectedUsers;
}

module.exports = { initSocket, getConnectedUsers, makeUserJoinRoom, makeUserLeaveRoom };
