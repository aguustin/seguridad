import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { adminLogin } from '../services/api';

const KIOSK_FLAG_KEY = 'kioskModeActive';

const KioskContext = createContext(null);

/**
 * "Modo Escáner": convierte el dispositivo en un kiosco fijo de
 * check-in/check-out, sin acceso al resto de la app.
 *
 * El flag se guarda en SecureStore (persiste incluso si se cierra la app —
 * es lo que mantiene el dispositivo bloqueado en el kiosco). Solo se puede
 * activar desde el panel de administrador ya logueado, y solo se puede
 * desactivar volviendo a validar usuario/contraseña de administrador — un
 * guardia que se para frente al kiosco no tiene forma de salir de este modo.
 */
export function KioskProvider({ children }) {
  const [kioskActive, setKioskActive] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(KIOSK_FLAG_KEY)
      .then((v) => setKioskActive(v === 'true'))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function activateKiosk() {
    await SecureStore.setItemAsync(KIOSK_FLAG_KEY, 'true');
    setKioskActive(true);
  }

  /**
   * Valida usuario/contraseña de admin contra el backend (mismo endpoint
   * que el login de admin) y, si son correctas, apaga el modo kiosco.
   * No persiste ninguna sesión de admin acá — solo confirma la identidad
   * y vuelve a la pantalla de selección de rol.
   */
  async function deactivateKiosk(username, password) {
    await adminLogin(username, password); // tira si las credenciales son inválidas
    await SecureStore.deleteItemAsync(KIOSK_FLAG_KEY);
    setKioskActive(false);
  }

  return (
    <KioskContext.Provider value={{ kioskActive, kioskLoading: loading, activateKiosk, deactivateKiosk }}>
      {children}
    </KioskContext.Provider>
  );
}

export function useKiosk() {
  return useContext(KioskContext);
}
