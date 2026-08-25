import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraDevice, useCameraFormat, useCameraPermission } from 'react-native-vision-camera';
import { faceScan } from '../services/api';

// Una foto de ~1280x720 alcanza de sobra para face-api y pesa mucho menos
// que la resolución nativa de la cámara (varios MB) — sube más rápido y
// el backend la procesa más rápido.
const PHOTO_FORMAT_FILTER = [{ photoResolution: { width: 1280, height: 720 } }];

/**
 * Hook central del escaneo facial. Encapsula las 5 etapas del flujo:
 *
 *   1. DETECCIÓN  → onFacesDetected() recibe los resultados del frame
 *                    processor (ML Kit, corre localmente en el device).
 *   2. CAPTURA     → cuando hay una cara estable ~STABLE_MS, se toma UNA
 *                    foto real con la cámara (no el frame de baja
 *                    resolución del detector).
 *   3-4. DESCRIPTOR/COMPARACIÓN → se resuelven en el backend (POST a
 *                    /auth/security/face-scan). Acá solo se manda la foto
 *                    y se espera la respuesta.
 *   5. CHECK-IN/OUT → lo decide el backend; este hook solo expone el
 *                    resultado para que la pantalla lo muestre.
 *
 * Mientras no hay una cara detectada NO se dispara ningún request: la
 * detección es puramente local y gratuita en términos de red.
 */

const STABLE_MS = 450;        // cuánto tiempo debe verse una cara antes de capturar
const RESULT_DISPLAY_MS = 2600; // cuánto se muestra el resultado en pantalla
const COOLDOWN_MS = 6000;     // pausa después de mostrar un resultado

export const SCAN_STATUS = {
  WAITING: 'waiting',       // preview, esperando una cara
  PROCESSING: 'processing', // se capturó 1 frame, esperando al backend
  RESULT: 'result',         // mostrando el resultado
  COOLDOWN: 'cooldown',     // pausa antes de volver a aceptar detecciones
};

export const FACE_DETECTION_OPTIONS = {
  performanceMode: 'fast',
  landmarkMode: 'none',
  contourMode: 'none',
  classificationMode: 'none',
  // El rostro tiene que ocupar una porción razonable del encuadre: evita
  // disparar capturas con caras lejanas o de fondo.
  minFaceSize: 0.28,
  trackingEnabled: false,
};

export function useFaceScanner() {
  const device = useCameraDevice('front');
  const format = useCameraFormat(device, PHOTO_FORMAT_FILTER);
  const { hasPermission, requestPermission } = useCameraPermission();
  const cameraRef = useRef(null);

  const [status, setStatus] = useState(SCAN_STATUS.WAITING);
  const [result, setResult] = useState(null);

  // Refs (no disparan re-render): timestamp desde que se ve una cara sin
  // interrupción, y flag para ignorar detecciones mientras se procesa o
  // se está en cooldown (evita doble captura / doble request).
  const faceSeenSinceRef = useRef(null);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const capture = useCallback(async () => {
    if (busyRef.current || !cameraRef.current) return;
    busyRef.current = true;
    faceSeenSinceRef.current = null;
    setStatus(SCAN_STATUS.PROCESSING);

    try {
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const uri = photo.path.startsWith('file://') ? photo.path : `file://${photo.path}`;

      const formData = new FormData();
      formData.append('faceImage', { uri, name: 'face.jpg', type: 'image/jpeg' });

      const { data } = await faceScan(formData);
      if (!mountedRef.current) return;
      setResult({ ok: true, ...data });
    } catch (err) {
      if (!mountedRef.current) return;
      const httpStatus = err.response?.status;
      const message = err.response?.data?.error;
      setResult({
        ok: false,
        httpStatus,
        message: message || (err.name === 'AbortError'
          ? 'Tiempo de espera agotado. Reintentando...'
          : 'No se pudo conectar con el servidor. Reintentando...'),
      });
    } finally {
      if (mountedRef.current) setStatus(SCAN_STATUS.RESULT);
    }
  }, []);

  // Callback del frame processor (ver FaceDetectionCamera). Corre muy
  // seguido (varias veces por segundo) mientras la cámara está activa, pero
  // es barato: solo compara timestamps, no procesa nada pesado acá.
  const onFacesDetected = useCallback((faces) => {
    if (busyRef.current) return;

    if (!faces || faces.length === 0) {
      faceSeenSinceRef.current = null;
      return;
    }

    const now = Date.now();
    if (!faceSeenSinceRef.current) {
      faceSeenSinceRef.current = now;
      return;
    }

    if (now - faceSeenSinceRef.current >= STABLE_MS) {
      capture();
    }
  }, [capture]);

  // RESULT → COOLDOWN → WAITING (automático, no requiere interacción)
  useEffect(() => {
    if (status !== SCAN_STATUS.RESULT) return undefined;
    const t = setTimeout(() => setStatus(SCAN_STATUS.COOLDOWN), RESULT_DISPLAY_MS);
    return () => clearTimeout(t);
  }, [status]);

  useEffect(() => {
    if (status !== SCAN_STATUS.COOLDOWN) return undefined;
    const t = setTimeout(() => {
      if (!mountedRef.current) return;
      setResult(null);
      busyRef.current = false;
      setStatus(SCAN_STATUS.WAITING);
    }, COOLDOWN_MS);
    return () => clearTimeout(t);
  }, [status]);

  // Permite a la pantalla volver a WAITING de inmediato (ej. tras loguear
  // al guardia y salir de la pantalla no hace falta, pero sirve para casos
  // donde la pantalla quiere resetear manualmente).
  const reset = useCallback(() => {
    faceSeenSinceRef.current = null;
    busyRef.current = false;
    setResult(null);
    setStatus(SCAN_STATUS.WAITING);
  }, []);

  return {
    device,
    format,
    hasPermission,
    requestPermission,
    cameraRef,
    onFacesDetected,
    status,
    result,
    reset,
  };
}
