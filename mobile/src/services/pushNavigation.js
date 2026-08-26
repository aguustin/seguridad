import { navigationRef } from '../navigation/navigationRef';

// A qué pantalla llevar al tocar cada tipo de notificación push — mismo
// `type` que manda cada controller en el `data` del push (ver
// backend/src/services/notificationService.js y sus llamadas). Cada tipo
// solo se manda al rol que puede llegar a esa pantalla, así que no hace
// falta resolver el rol acá: si el usuario logueado no es el que
// corresponde, la pantalla simplemente no existe en su stack actual y la
// navegación no hace nada (ver navigateFromNotification).
const ROUTE_BY_TYPE = {
  // Seguridad
  assignment: { screen: 'SecurityDashboard' },
  wake_up: { screen: 'SecurityDashboard' },
  patrol_reminder: { screen: 'Patrol' },
  // Admin
  client_emergency: { screen: 'AdminAlerts', params: { initialTab: 0 } },
  guard_alert: { screen: 'AdminAlerts', params: { initialTab: 1 } },
  // Cliente
  visit_arrived: { screen: 'ClientDashboard' },
  alert_resolved: { screen: 'ClientDashboard' },
};

/**
 * Navega a la pantalla correspondiente al tocar una notificación push.
 * `navigationRef` puede no estar listo todavía (app recién arrancando,
 * AuthContext todavía resolviendo sesión) — se reintenta unas pocas veces
 * antes de rendirse en silencio, mismo criterio de tolerancia a fallos que
 * el resto de la app (ej. refrescos post-mutación en try/catch propio).
 */
export function navigateFromNotification(data, attempt = 0) {
  const route = data?.type && ROUTE_BY_TYPE[data.type];
  if (!route) return;

  if (!navigationRef.isReady()) {
    if (attempt >= 10) return; // ~5s de reintentos, después se abandona
    setTimeout(() => navigateFromNotification(data, attempt + 1), 500);
    return;
  }

  try {
    navigationRef.navigate(route.screen, route.params);
  } catch (err) {
    // La pantalla puede no existir en el stack actual (ej. llegó un push
    // de otro rol a un dispositivo compartido) — no es un error real.
    console.log('[Push] No se pudo navegar:', err.message);
  }
}
