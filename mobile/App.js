import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { KioskProvider } from './src/context/KioskContext';
import AppNavigator from './src/navigation';
// Registra el task de background de ubicación (TaskManager.defineTask) —
// tiene que importarse una sola vez, a nivel de módulo, antes de que
// cualquier pantalla llame a startLocationUpdatesAsync.
import './src/services/backgroundLocation';

// Configurar notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  useEffect(() => {
    // Crear canal de notificaciones (Android)
    Notifications.setNotificationChannelAsync('security-alerts', {
      name: 'Alertas de seguridad',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#e94560',
      sound: 'default',
    });
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KioskProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <AppNavigator />
        </AuthProvider>
      </KioskProvider>
    </GestureHandlerRootView>
  );
}
