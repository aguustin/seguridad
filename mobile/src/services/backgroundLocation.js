import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../config/constants';

export const BACKGROUND_LOCATION_TASK = 'background-location-guard';

const SEND_TIMEOUT_MS = 10000;

/**
 * Define el task de background. TaskManager exige que esto corra a nivel de
 * módulo (no dentro de un componente) y ANTES de llamar a
 * startLocationUpdatesAsync — por eso se importa este archivo una sola vez
 * en App.js, apenas arranca el JS bundle.
 *
 * En Android, este callback puede correr en un contexto "headless" aislado
 * (sin la app en primer plano, a veces sin el resto del árbol de React
 * montado) — por eso NO reutiliza el socket ya conectado ni ningún estado
 * de la app en memoria: solo lee el token de SecureStore y lo manda por
 * REST directo, igual que haría cualquier request normal de la app.
 */
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BackgroundLocation] Error del task:', error.message);
    return;
  }
  if (!data) return;

  const { locations } = data;
  const last = locations?.[locations.length - 1];
  if (!last) return;

  try {
    const token = await SecureStore.getItemAsync('authToken');
    if (!token) return; // sin sesión de guardia activa en este dispositivo

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
    try {
      await fetch(`${API_URL}/security/location`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error('[BackgroundLocation] Error enviando ubicación:', err.message);
  }
});

/**
 * Arranca el tracking en background. Requiere que el permiso "Always"/
 * background ya haya sido otorgado (ver requestBackgroundPermissionsAsync
 * en SecurityDashboardScreen) — si no, expo-location tira un error acá.
 */
export async function startBackgroundLocationTracking() {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  if (alreadyStarted) return;

  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15000,
    distanceInterval: 20,
    pausesUpdatesAutomatically: false,
    showsBackgroundLocationIndicator: true, // iOS: ícono azul de "app usando ubicación en background"
    // Android exige un foreground service (con notificación visible) para
    // mantener vivo el tracking una vez que la app pasa a segundo plano.
    foregroundService: {
      notificationTitle: 'Seguridad Barrios',
      notificationBody: 'Registrando tu ubicación mientras estás de turno',
      notificationColor: '#fcd34d',
    },
  });
}

/**
 * Frena el tracking en background. Se llama al cerrar sesión (ver
 * AuthContext.logout) — si nunca se inició, no hace nada.
 */
export async function stopBackgroundLocationTracking() {
  const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false);
  if (alreadyStarted) {
    await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  }
}
