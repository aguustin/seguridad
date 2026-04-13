import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config/constants';

let socket = null;

export function connectSocket(token) {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
  });

  socket.on('connect', () => console.log('[Socket] Conectado'));
  socket.on('disconnect', (reason) => console.log('[Socket] Desconectado:', reason));
  socket.on('connect_error', (err) => console.error('[Socket] Error:', err.message));

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export function getSocket() {
  return socket;
}

export function sendMessage(roomType, roomId, content) {
  socket?.emit('send_message', { roomType, roomId, content });
}

export function updateLocation(latitude, longitude) {
  socket?.emit('update_location', { latitude, longitude });
}

export function sendEmergency(latitude, longitude, message) {
  socket?.emit('client_emergency', { latitude, longitude, message });
}

export function registerPushToken(token) {
  socket?.emit('register_push_token', { token });
}

export function joinClientChat(clientId) {
  socket?.emit('join_client_chat', { clientId });
}
