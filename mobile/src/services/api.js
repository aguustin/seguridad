import axios from 'axios';
import * as FileSystem from 'expo-file-system/legacy';
import { API_URL } from '../config/constants';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// ── Multipart upload helper ────────────────────────────────────────────────
// Antes esto se hacía con fetch nativo + FormData (pasando un objeto
// {uri, name, type} como "archivo"). En una Development Build nativa sobre
// RN 0.86 (New Architecture) ese objeto no siempre matchea la forma que
// espera el bridge para armar el body multipart, y tira
// "Unsupported FormDataPart implementation" — confirmado con logs reales al
// registrar un guardia (falla justo en el fetch() de la subida de foto).
// Pasaba desapercibido en Expo Go porque corre con otro runtime/versión.
//
// FileSystem.uploadAsync (expo-file-system/legacy) hace la subida
// multipart de forma nativa sin pasar por FormData/fetch en absoluto — es
// el mecanismo estable y mantenido por Expo para este caso, no un parche.
async function multipartUpload(path, fileUri, fields, { fieldName = 'profilePhoto', mimeType = 'image/jpeg' } = {}) {
  const headers = {};

  // Incluir token de auth si está disponible en el interceptor de axios
  const token = api.defaults.headers.common['Authorization'];
  if (token) headers['Authorization'] = token;

  const result = await FileSystem.uploadAsync(`${API_URL}${path}`, fileUri, {
    httpMethod: 'POST',
    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
    fieldName,
    mimeType,
    parameters: fields, // ojo: todos los valores tienen que ser string
    headers,
  });

  let json;
  try {
    json = JSON.parse(result.body);
  } catch {
    json = {};
  }
  if (result.status < 200 || result.status >= 300) {
    const err = new Error(json.error || `Error ${result.status}`);
    err.response = { data: json, status: result.status };
    throw err;
  }
  return { data: json };
}

// ── Auth ───────────────────────────────────────────────────────────────────
export const adminLogin = (username, password) =>
  api.post('/auth/admin/login', { username, password });

export const adminRegister = (data) =>
  api.post('/auth/admin/register', data);

export const clientLogin = (username, password) =>
  api.post('/auth/client/login', { username, password });

// Compartido admin/client — ver authController.changePassword.
export const changePassword = (currentPassword, newPassword) =>
  api.post('/auth/change-password', { currentPassword, newPassword });

// fileUri: URI local de la foto capturada. FileSystem.uploadAsync no tiene
// timeout propio (a diferencia del fetch anterior) — el cold-start del
// backend en Render Free (~30-50s) + inferencia de face-api quedan
// contenidos por el timeout normal del sistema operativo para la conexión.
export const faceScan = (fileUri) =>
  multipartUpload('/auth/security/face-scan', fileUri, {}, { fieldName: 'faceImage', mimeType: 'image/jpeg' });

// ── Admin - Barrios ────────────────────────────────────────────────────────
export const getNeighborhoods = () => api.get('/admin/neighborhoods');
export const createNeighborhood = (data) => api.post('/admin/neighborhoods', data);
export const updateNeighborhood = (id, data) => api.put(`/admin/neighborhoods/${id}`, data);

// ── Admin - Guardias ───────────────────────────────────────────────────────
// Alta de guardias: antes era pública (auth/security/register), ahora
// requiere admin autenticado.
export const createSecurityStaff = (fields, fileUri, mimeType) =>
  multipartUpload('/admin/security', fileUri, fields, { fieldName: 'profilePhoto', mimeType });
export const getSecurityStaff = (neighborhoodId) =>
  api.get('/admin/security', { params: { neighborhoodId } });
export const getSecurityProfile = (id) => api.get(`/admin/security/${id}`);
export const updateSecurityStaff = (id, data) => api.put(`/admin/security/${id}`, data);
export const deactivateSecurityStaff = (id) => api.delete(`/admin/security/${id}`);
export const getAttendanceHistory = (id, params) =>
  api.get(`/admin/security/${id}/attendance`, { params });

// ── Admin - Ubicaciones ────────────────────────────────────────────────────
export const getGuardsLocations = (neighborhoodId) =>
  api.get('/admin/locations/guards', { params: { neighborhoodId } });
export const getClientsLocations = (neighborhoodId) =>
  api.get('/admin/locations/clients', { params: { neighborhoodId } });

// ── Admin - Alertas ────────────────────────────────────────────────────────
export const sendAlert = (data) => api.post('/admin/alerts', data);
export const getAlerts = () => api.get('/admin/alerts');
export const resolveAlert = (id) => api.patch(`/admin/alerts/${id}/resolve`);

// ── Admin - Clientes ───────────────────────────────────────────────────────
// La foto es opcional acá (a diferencia de guardias). multer solo intercepta
// requests multipart/form-data — con JSON simple pasa de largo y usa el
// req.body que ya parseó express.json() (ver backend/src/app.js), así que
// alcanza con un POST normal cuando no hay foto.
export const registerClient = (fields, fileUri, mimeType) =>
  fileUri
    ? multipartUpload('/admin/clients', fileUri, fields, { fieldName: 'profilePhoto', mimeType })
    : api.post('/admin/clients', fields);
export const getClients = (neighborhoodId) =>
  api.get('/admin/clients', { params: { neighborhoodId } });
export const updateClient = (id, data) => api.put(`/admin/clients/${id}`, data);
export const deactivateClient = (id) => api.delete(`/admin/clients/${id}`);

// ── Admin - Finanzas ───────────────────────────────────────────────────────
export const createFinancialRecord = (data) => api.post('/admin/finances', data);
export const getFinancialRecords = (params) => api.get('/admin/finances', { params });
export const getFinancialStats = (period) =>
  api.get('/admin/finances/stats', { params: { period } });
export const updateFinancialRecord = (id, data) => api.put(`/admin/finances/${id}`, data);
export const deleteFinancialRecord = (id) => api.delete(`/admin/finances/${id}`);

// ── Admin - Estadísticas operativas ────────────────────────────────────────
export const getOperationalStats = (params) => api.get('/admin/statistics', { params });

// ── Admin - Administradores ────────────────────────────────────────────────
export const createAdmin = (data) => api.post('/admin/admins', data);

// ── Admin - Operador ───────────────────────────────────────────────────────
export const assignOperator = (id) => api.post(`/admin/security/${id}/assign-operator`);
export const removeOperator = () => api.delete('/admin/operator');
export const getGuardAlerts = (params) => api.get('/admin/guard-alerts', { params });

// ── Security ───────────────────────────────────────────────────────────────
export const getMyProfile = () => api.get('/security/profile');
export const getMyAttendance = (params) => api.get('/security/attendance', { params });
export const getActiveColleagues = () => api.get('/security/colleagues');
export const getActiveGuardsStatus = () => api.get('/security/active-guards');
export const getSecurityChat = (params) => api.get('/security/chat', { params });
export const getMyAlerts = () => api.get('/security/alerts');
export const sendGuardAlert = (reason) => api.post('/security/guard-alert', { reason });
export const resolveGuardAlert = (id) => api.patch(`/security/guard-alert/${id}/resolve`);
export const getMyActiveAlert = () => api.get('/security/guard-alert/active');
export const confirmCheckin = (sessionId) => api.post('/security/checkin/confirm', { sessionId });
export const securityLogout = () => api.post('/security/logout');

// ── Security - Rondas ──────────────────────────────────────────────────────
export const getPatrolRoutes = () => api.get('/security/patrol/routes');
export const startPatrol = (patrolRouteId) => api.post('/security/patrol/start', { patrolRouteId });
export const getActivePatrol = () => api.get('/security/patrol/active');
export const registerCheckpointVisit = (patrolCheckpointId) =>
  api.post('/security/patrol/checkpoint', { patrolCheckpointId });
export const scanCheckpointQR = (patrolCheckpointId) =>
  api.post('/security/patrol/checkpoint/scan', { patrolCheckpointId });
export const endPatrol = () => api.post('/security/patrol/end');
export const getMyPatrolHistory = (params) => api.get('/security/patrol/history', { params });
export const getMyPatrolDetail = (id) => api.get(`/security/patrol/history/${id}`);

// ── Security - Visitas ─────────────────────────────────────────────────────
export const registerVisit = (data) => api.post('/security/visits', data);
export const getActiveVisits = () => api.get('/security/visits/active');
export const getVisitHistory = (params) => api.get('/security/visits', { params });
export const registerVisitExit = (id) => api.patch(`/security/visits/${id}/exit`);
export const scanVisitInvitation = (invitationId) => api.post('/security/visits/scan', { invitationId });

// ── Admin - Visitas ────────────────────────────────────────────────────────
export const getAdminVisits = (params) => api.get('/admin/visits', { params });

// ── Client - Invitaciones de visita (QR) ───────────────────────────────────
export const createVisitInvitation = (visitorName) => api.post('/client/visit-invitations', { visitorName });
export const getVisitInvitations = () => api.get('/client/visit-invitations');

// ── Security - Asignaciones ────────────────────────────────────────────────
export const getMyAssignments = () => api.get('/security/assignments');
export const completeAssignment = (id) => api.patch(`/security/assignments/${id}/complete`);

// ── Admin - Asignaciones ───────────────────────────────────────────────────
export const createAssignment = (data) => api.post('/admin/assignments', data);
export const getAssignments = (params) => api.get('/admin/assignments', { params });
export const cancelAssignment = (id) => api.patch(`/admin/assignments/${id}/cancel`);

// ── Admin - Auditoría ──────────────────────────────────────────────────────
export const getAuditLogs = (params) => api.get('/admin/audit', { params });

// ── Admin - Rondas realizadas ──────────────────────────────────────────────
export const getPatrolSessions = (params) => api.get('/admin/patrol/sessions', { params });
export const getPatrolSessionDetail = (id) => api.get(`/admin/patrol/sessions/${id}`);

// ── Admin - Rutas y checkpoints de ronda ───────────────────────────────────
export const getPatrolAdminRoutes = (neighborhoodId) =>
  api.get('/admin/patrol/routes', { params: { neighborhoodId } });
export const getPatrolAdminRoute = (id) => api.get(`/admin/patrol/routes/${id}`);
export const createPatrolRoute = (data) => api.post('/admin/patrol/routes', data);
export const updatePatrolRoute = (id, data) => api.put(`/admin/patrol/routes/${id}`, data);
export const deactivatePatrolRoute = (id) => api.delete(`/admin/patrol/routes/${id}`);
export const createPatrolCheckpoint = (routeId, data) =>
  api.post(`/admin/patrol/routes/${routeId}/checkpoints`, data);
export const updatePatrolCheckpoint = (id, data) => api.put(`/admin/patrol/checkpoints/${id}`, data);
export const deletePatrolCheckpoint = (id) => api.delete(`/admin/patrol/checkpoints/${id}`);
export const getPatrolCheckpointQR = (id) => api.get(`/admin/patrol/checkpoints/${id}/qr`);

// ── Client ─────────────────────────────────────────────────────────────────
export const getClientProfile = () => api.get('/client/profile');
export const toggleLocationSharing = (enabled) =>
  api.post('/client/location-sharing', { enabled });
export const updateClientContact = (contact) =>
  api.post('/client/contact', { contact });
export const getClientChat = (params) => api.get('/client/chat', { params });
export const sendEmergencyAlert = (data) => api.post('/client/emergency', data);

// ── Kiosco (apertura/cierre) ───────────────────────────────────────────────
// Público — lo consulta el dispositivo kiosco antes de cualquier sesión.
export const getKioskStatus = () => api.get('/kiosk/status');
// Solo admin.
export const getKioskState = () => api.get('/kiosk');
export const setKioskState = (isOpen) => api.patch('/kiosk', { isOpen });
