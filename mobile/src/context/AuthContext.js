import React, { createContext, useState, useContext, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';
import { stopBackgroundLocationTracking } from '../services/backgroundLocation';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  async function loadStoredAuth() {
    try {
      const storedToken = await SecureStore.getItemAsync('authToken');
      const storedUser = await SecureStore.getItemAsync('authUser');
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setToken(storedToken);
        setUser(parsedUser);
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
      }
    } catch (err) {
      console.error('Error cargando auth:', err);
    } finally {
      setLoading(false);
    }
  }

  async function login(userData, authToken) {
    await SecureStore.setItemAsync('authToken', authToken);
    await SecureStore.setItemAsync('authUser', JSON.stringify(userData));
    api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
    setToken(authToken);
    setUser(userData);
  }

  async function logout() {
    // Si es guardia, notificar al backend para limpiar isOperator y frenar
    // el tracking de ubicación en background que haya quedado activo.
    try {
      const storedUser = await SecureStore.getItemAsync('authUser');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed.role === 'security') {
          await api.post('/security/logout').catch(() => {});
          await stopBackgroundLocationTracking().catch(() => {});
        }
      }
    } catch {}

    await SecureStore.deleteItemAsync('authToken');
    await SecureStore.deleteItemAsync('authUser');
    delete api.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
