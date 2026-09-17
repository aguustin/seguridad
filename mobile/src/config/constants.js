// TEMPORAL — túnel de ngrok al backend (puerto 3000), NO la IP LAN.
// Se detectó que el teléfono de prueba no tiene ninguna conectividad LAN
// con esta PC (confirmado probando los puertos 3000/8081/9000 directo
// desde el navegador del celular: ninguno responde), aunque sí puede
// conectarse al bundler de Metro a través del túnel propio de Expo
// (`--tunnel`, dominio exp.direct). Ese túnel de Expo solo expone Metro,
// no el backend — por eso hace falta este segundo túnel aparte.
//
// Esta URL es efímera: cambia cada vez que se reinicia el túnel de ngrok
// (`ngrok http 3000`). Si el login empieza a fallar de nuevo, lo más
// probable es que el túnel se haya reiniciado — pedir la URL nueva y
// actualizar esta línea (no hace falta un nuevo build nativo, el
// dev client recarga el JS solo).
//
// Cuando se resuelva la conectividad LAN real (o se pruebe por USB con
// adb reverse), volver a usar la IP LAN de la PC (ver `ipconfig`),
// ej: 'http://192.168.220.89:3000'.
const API_BASE_URL = 'https://c6b5-190-15-214-118.ngrok-free.app';

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
