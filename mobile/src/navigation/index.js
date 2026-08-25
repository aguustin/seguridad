import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useKiosk } from '../context/KioskContext';
import { COLORS } from '../config/constants';

// Screens
import RoleSelectScreen from '../screens/RoleSelectScreen';
import ScannerScreen from '../screens/security/ScannerScreen';

// Admin
import AdminLoginScreen from '../screens/admin/AdminLoginScreen';
import AdminDashboardScreen from '../screens/admin/AdminDashboardScreen';
import SecurityListScreen from '../screens/admin/SecurityListScreen';
import EditSecurityScreen from '../screens/admin/EditSecurityScreen';
import AttendanceHistoryScreen from '../screens/admin/AttendanceHistoryScreen';
import AdminMapScreen from '../screens/admin/AdminMapScreen';
import SendAlertScreen from '../screens/admin/SendAlertScreen';
import AdminAlertsScreen from '../screens/admin/AdminAlertsScreen';
import FinancesScreen from '../screens/admin/FinancesScreen';
import StatisticsScreen from '../screens/admin/StatisticsScreen';
import RegisterClientScreen from '../screens/admin/RegisterClientScreen';
import RegisterSecurityScreen from '../screens/admin/RegisterSecurityScreen';

// Security
import SecurityRegisterScreen from '../screens/security/SecurityRegisterScreen';
import FaceScanScreen from '../screens/security/FaceScanScreen';
import SecurityDashboardScreen from '../screens/security/SecurityDashboardScreen';
import SecurityChatScreen from '../screens/security/SecurityChatScreen';
import OperatorDashboardScreen from '../screens/security/OperatorDashboardScreen';

// Client
import ClientLoginScreen from '../screens/client/ClientLoginScreen';
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import EmergencyScreen from '../screens/client/EmergencyScreen';
import ClientChatScreen from '../screens/client/ClientChatScreen';

const Stack = createNativeStackNavigator();

const commonHeaderStyle = {
  headerStyle: { backgroundColor: COLORS.primary, borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBorder },
  headerTintColor: COLORS.accent,
  headerTitleStyle: { fontWeight: '700', color: COLORS.white, fontSize: 16 },
  headerBackTitleVisible: false,
  // Área de toque grande para el botón de volver
  headerLeftContainerStyle: { paddingLeft: 8 },
  headerBackButtonDisplayMode: 'minimal',
};

function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ ...commonHeaderStyle, headerShown: false }}>
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen} />
      <Stack.Screen name="AdminLogin" component={AdminLoginScreen} />
      <Stack.Screen name="ClientLogin" component={ClientLoginScreen} />
      <Stack.Screen name="SecurityFaceScan" component={FaceScanScreen} />
      <Stack.Screen name="SecurityLogin" component={FaceScanScreen} />
      <Stack.Screen name="SecurityRegister" component={SecurityRegisterScreen} />
    </Stack.Navigator>
  );
}

function AdminNavigator() {
  return (
    <Stack.Navigator screenOptions={commonHeaderStyle}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} options={{ title: 'Panel Admin', headerShown: false }} />
      <Stack.Screen name="SecurityList" component={SecurityListScreen} options={{ title: 'Guardias' }} />
      <Stack.Screen name="EditSecurity" component={EditSecurityScreen} options={{ title: 'Editar guardia' }} />
      <Stack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} options={({ route }) => ({ title: 'Historial asistencia' })} />
      <Stack.Screen name="AdminMap" component={AdminMapScreen} options={{ title: 'Mapa en tiempo real' }} />
      <Stack.Screen name="SendAlert" component={SendAlertScreen} options={{ title: 'Enviar alerta' }} />
      <Stack.Screen name="AdminAlerts" component={AdminAlertsScreen} options={{ title: 'Alertas de emergencia' }} />
      <Stack.Screen name="Finances" component={FinancesScreen} options={{ title: 'Finanzas' }} />
      <Stack.Screen name="Statistics" component={StatisticsScreen} options={{ title: 'Estadísticas' }} />
      <Stack.Screen name="RegisterClient" component={RegisterClientScreen} options={{ title: 'Registrar cliente' }} />
      <Stack.Screen name="Neighborhoods" component={require('../screens/admin/NeighborhoodsScreen').default} options={{ title: 'Barrios' }} />
      <Stack.Screen name="RegisterSecurity" component={RegisterSecurityScreen} options={{ title: 'Registrar guardia' }} />
    </Stack.Navigator>
  );
}

function SecurityNavigator() {
  return (
    <Stack.Navigator screenOptions={commonHeaderStyle}>
      <Stack.Screen name="SecurityDashboard" component={SecurityDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="SecurityChat" component={SecurityChatScreen} options={{ title: 'Chat del barrio' }} />
      <Stack.Screen name="SecurityAttendance" component={require('../screens/security/MyAttendanceScreen').default} options={{ title: 'Mi historial' }} />
      <Stack.Screen name="SecurityFaceScan" component={FaceScanScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OperatorDashboard" component={OperatorDashboardScreen} options={{ title: 'Estado de guardias' }} />
    </Stack.Navigator>
  );
}

function KioskNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false }}>
      <Stack.Screen name="Scanner" component={ScannerScreen} />
    </Stack.Navigator>
  );
}

function ClientNavigator() {
  return (
    <Stack.Navigator screenOptions={commonHeaderStyle}>
      <Stack.Screen name="ClientDashboard" component={ClientDashboardScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ClientEmergency" component={EmergencyScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ClientChat" component={ClientChatScreen} options={{ title: 'Hablar con seguridad' }} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();
  const { kioskActive, kioskLoading } = useKiosk();

  if (loading || kioskLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primary }}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  // El modo escáner tiene prioridad absoluta: sin importar si hay una sesión
  // de admin/guardia/cliente activa en este dispositivo, si el flag está
  // prendido lo único que se puede ver es el escáner. Solo se apaga
  // validando credenciales de administrador (ver KioskContext).
  if (kioskActive) {
    return (
      <NavigationContainer>
        <KioskNavigator />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      {!user ? (
        <AuthNavigator />
      ) : user.role === 'admin' ? (
        <AdminNavigator />
      ) : user.role === 'security' ? (
        <SecurityNavigator />
      ) : (
        <ClientNavigator />
      )}
    </NavigationContainer>
  );
}
