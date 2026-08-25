import axios from 'axios';
import { API_URL } from '../config/constants';

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
});

// ── Multipart upload helper ────────────────────────────────────────────────
// axios + React Native FormData tiene un bug conocido: el Content-Type queda
// sin boundary y multer cuelga esperando parsear el body → "Network Error".
// La solución confiable es usar fetch nativo de React Native para uploads.
async function multipartPost(path, formData, timeoutMs = 30000) {
  const headers = { 'Content-Type': 'multipart/form-data' };

  // Incluir token de auth si está disponible en el interceptor de axios
  const token = api.defaults.headers.common['Authorization'];
  if (token) headers['Authorization'] = token;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json.error || `Error ${res.status}`);
    err.response = { data: json, status: res.status };
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

// Timeout más largo que el resto: contempla el cold-start del backend en
// Render Free (puede tardar ~30-50s en "despertar") + el tiempo de
// inferencia de face-api.
export const faceScan = (formData) =>
  multipartPost('/auth/security/face-scan', formData, 45000);

// ── Admin - Barrios ────────────────────────────────────────────────────────
export const getNeighborhoods = () => api.get('/admin/neighborhoods');
export const createNeighborhood = (data) => api.post('/admin/neighborhoods', data);
export const updateNeighborhood = (id, data) => api.put(`/admin/neighborhoods/${id}`, data);

// ── Admin - Guardias ───────────────────────────────────────────────────────
// Alta de guardias: antes era pública (auth/security/register), ahora
// requiere admin autenticado.
export const createSecurityStaff = (formData) =>
  multipartPost('/admin/security', formData);
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
export const registerClient = (formData) =>
  multipartPost('/admin/clients', formData);
export const getClients = (neighborhoodId) =>
  api.get('/admin/clients', { params: { neighborhoodId } });

// ── Admin - Finanzas ───────────────────────────────────────────────────────
export const createFinancialRecord = (data) => api.post('/admin/finances', data);
export const getFinancialRecords = (params) => api.get('/admin/finances', { params });
export const getFinancialStats = (period) =>
  api.get('/admin/finances/stats', { params: { period } });
export const updateFinancialRecord = (id, data) => api.put(`/admin/finances/${id}`, data);
export const deleteFinancialRecord = (id) => api.delete(`/admin/finances/${id}`);

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

// ── Client ─────────────────────────────────────────────────────────────────
export const getClientProfile = () => api.get('/client/profile');
export const toggleLocationSharing = (enabled) =>
  api.post('/client/location-sharing', { enabled });
export const getClientChat = (params) => api.get('/client/chat', { params });
export const sendEmergencyAlert = (data) => api.post('/client/emergency', data);

// ── Kiosco (apertura/cierre) ───────────────────────────────────────────────
// Público — lo consulta el dispositivo kiosco antes de cualquier sesión.
export const getKioskStatus = () => api.get('/kiosk/status');
// Solo admin.
export const getKioskState = () => api.get('/kiosk');
export const setKioskState = (isOpen) => api.patch('/kiosk', { isOpen });
