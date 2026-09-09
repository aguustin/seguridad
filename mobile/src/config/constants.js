// IP LAN de la PC donde corre el backend en desarrollo — tiene que
// coincidir con la IP Wi-Fi real de esa PC (ver `ipconfig`). Estaba
// apuntando a una IP vieja (192.168.100.10, otra subred) que ya no
// corresponde a esta red; detectado durante el diagnóstico de Expo Go y
// actualizado a la IP Wi-Fi actual (192.168.220.89) — sin esto, aunque
// Expo Go cargue el bundle correctamente, la app no podría hablar con el
// backend (login, todo el resto de la API, y el socket).
const API_BASE_URL = 'http://192.168.220.89:3000';

export const API_URL = `${API_BASE_URL}/api`;
export const SOCKET_URL = API_BASE_URL;
export const UPLOADS_URL = `${API_BASE_URL}/uploads`;

export const COLORS = {
  // ── Brand ─────────────────────────────────────────────
  primary:       '#000000',   // negro puro - color principal de marca
  primaryDark:   '#0a0a0a',   // fondo oscuro principal
  primaryLight:  '#1a1a1a',   // superficies secundarias oscuras
  surface:       '#111111',   // cards sobre fondo oscuro
  surfaceBorder: '#2a2a2a',   // bordes sobre fondo oscuro

  accent:        '#fcd34d',   // dorado ámbar - acento de marca
  accentDark:    '#d97706',   // ámbar oscuro para estados presionados
  accentLight:   '#fef9e7',   // fondo suave ámbar para badges/highlights

  // ── Semánticos ────────────────────────────────────────
  success:       '#22c55e',
  successLight:  '#dcfce7',
  danger:        '#ef4444',
  dangerLight:   '#fee2e2',
  warning:       '#f97316',
  warningLight:  '#fff7ed',
  info:          '#3b82f6',
  infoLight:     '#eff6ff',

  // ── Neutros ───────────────────────────────────────────
  white:         '#ffffff',
  background:    '#f5f5f3',   // fondo claro principal (levemente cálido)
  cardBg:        '#ffffff',
  border:        '#e5e5e5',
  borderDark:    '#d4d4d4',

  // ── Texto ─────────────────────────────────────────────
  textPrimary:   '#0a0a0a',
  textSecondary: '#6b7280',
  textLight:     '#9ca3af',
  textOnDark:    '#ffffff',
  textOnAccent:  '#000000',   // texto sobre el dorado
};
