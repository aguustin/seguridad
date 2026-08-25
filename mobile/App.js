import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { KioskProvider } from './src/context/KioskContext';
import AppNavigator from './src/navigation';

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
