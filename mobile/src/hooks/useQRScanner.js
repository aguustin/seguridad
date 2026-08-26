import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraDevice, useCameraPermission, useCodeScanner } from 'react-native-vision-camera';
import { SCAN_STATUS } from './useFaceScanner';

// Mismos tiempos de exhibición/cooldown que useFaceScanner, para que todos
// los flujos de escaneo se sientan consistentes entre sí.
const RESULT_DISPLAY_MS = 2600;
const COOLDOWN_MS = 2500;

/**
 * Hook de escaneo de códigos QR — genérico: cada pantalla le pasa qué
 * prefijo espera y qué función llamar con el id que sigue al prefijo (ver
 * ScanVisitorQRScreen y ScanCheckpointQRScreen, los dos consumidores
 * actuales). El QR nunca contiene datos reales, solo una referencia opaca
 * (`{prefix}{id}`) — toda la validación pasa en el servidor al llamar
 * `scan`. Mismo patrón de estados que useFaceScanner (WAITING →
 * PROCESSING → RESULT → COOLDOWN → WAITING), reutilizando el mismo enum en
 * vez de duplicarlo.
 *
 * @param {string} prefix - prefijo que debe tener el QR para ser válido acá.
 * @param {string} mismatchMessage - mensaje si el QR escaneado no tiene ese prefijo.
 * @param {(id: string) => Promise<{data: any}>} scan - llamada al backend con el id extraído.
 */
export function useQRScanner({ prefix, mismatchMessage, scan }) {
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const [status, setStatus] = useState(SCAN_STATUS.WAITING);
  const [result, setResult] = useState(null);

  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const handleCode = useCallback(async (rawValue) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStatus(SCAN_STATUS.PROCESSING);

    if (!rawValue?.startsWith(prefix)) {
      if (!mountedRef.current) return;
      setResult({ ok: false, message: mismatchMessage });
      setStatus(SCAN_STATUS.RESULT);
      return;
    }

    const id = rawValue.slice(prefix.length);
    try {
      const { data } = await scan(id);
      if (!mountedRef.current) return;
      setResult({ ok: true, data });
    } catch (err) {
      if (!mountedRef.current) return;
      setResult({ ok: false, message: err.response?.data?.error || 'No se pudo procesar el QR' });
    } finally {
      if (mountedRef.current) setStatus(SCAN_STATUS.RESULT);
    }
  }, [prefix, mismatchMessage, scan]);

  // Callback del codeScanner nativo — corre en el hilo de la cámara cada
  // vez que detecta un código en el frame. `busyRef` evita procesar el
  // mismo QR varias veces mientras se resuelve el primer escaneo.
  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      if (busyRef.current) return;
      const value = codes[0]?.value;
      if (value) handleCode(value);
    },
  });

  // RESULT → COOLDOWN → WAITING automático, igual que useFaceScanner.
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

  const reset = useCallback(() => {
    busyRef.current = false;
    setResult(null);
    setStatus(SCAN_STATUS.WAITING);
  }, []);

  return { device, hasPermission, requestPermission, codeScanner, status, result, reset };
}
