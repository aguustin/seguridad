import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useKiosk } from '../context/KioskContext';
import { COLORS } from '../config/constants';
import { navigationRef } from './navigationRef';

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
import ClientsListScreen from '../screens/admin/ClientsListScreen';
import EditClientScreen from '../screens/admin/EditClientScreen';
import RegisterSecurityScreen from '../screens/admin/RegisterSecurityScreen';
import RegisterAdminScreen from '../screens/admin/RegisterAdminScreen';
import PatrolSessionsScreen from '../screens/admin/PatrolSessionsScreen';
import PatrolSessionDetailScreen from '../screens/admin/PatrolSessionDetailScreen';
import PatrolRoutesScreen from '../screens/admin/PatrolRoutesScreen';
import PatrolRouteCheckpointsScreen from '../screens/admin/PatrolRouteCheckpointsScreen';
import AdminVisitsScreen from '../screens/admin/AdminVisitsScreen';
import AssignmentsScreen from '../screens/admin/AssignmentsScreen';
import ControlCenterScreen from '../screens/admin/ControlCenterScreen';
import AuditLogScreen from '../screens/admin/AuditLogScreen';

// Security
import FaceScanScreen from '../screens/security/FaceScanScreen';
import SecurityDashboardScreen from '../screens/security/SecurityDashboardScreen';
import SecurityChatScreen from '../screens/security/SecurityChatScreen';
import OperatorDashboardScreen from '../screens/security/OperatorDashboardScreen';
import PatrolScreen from '../screens/security/PatrolScreen';
import PatrolHistoryScreen from '../screens/security/PatrolHistoryScreen';
import PatrolHistoryDetailScreen from '../screens/security/PatrolHistoryDetailScreen';
import VisitsScreen from '../screens/security/VisitsScreen';
import VisitHistoryScreen from '../screens/security/VisitHistoryScreen';
import ScanVisitorQRScreen from '../screens/security/ScanVisitorQRScreen';
import ScanCheckpointQRScreen from '../screens/security/ScanCheckpointQRScreen';

// Client
import ClientLoginScreen from '../screens/client/ClientLoginScreen';
import ClientDashboardScreen from '../screens/client/ClientDashboardScreen';
import EmergencyScreen from '../screens/client/EmergencyScreen';
import ClientChatScreen from '../screens/client/ClientChatScreen';
import VisitInvitationScreen from '../screens/client/VisitInvitationScreen';

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
      <Stack.Screen name="RegisterAdmin" component={RegisterAdminScreen} options={{ title: 'Nuevo administrador' }} />
      <Stack.Screen name="PatrolSessions" component={PatrolSessionsScreen} options={{ title: 'Rondas realizadas' }} />
      <Stack.Screen name="PatrolSessionDetail" component={PatrolSessionDetailScreen} options={{ title: 'Detalle de ronda' }} />
      <Stack.Screen name="PatrolRoutes" component={PatrolRoutesScreen} options={{ title: 'Rutas de ronda' }} />
      <Stack.Screen name="PatrolRouteCheckpoints" component={PatrolRouteCheckpointsScreen} options={{ title: 'Checkpoints' }} />
      <Stack.Screen name="AdminVisits" component={AdminVisitsScreen} options={{ title: 'Visitas' }} />
      <Stack.Screen name="ClientList" component={ClientsListScreen} options={{ title: 'Clientes' }} />
      <Stack.Screen name="EditClient" component={EditClientScreen} options={{ title: 'Editar cliente' }} />
      <Stack.Screen name="Assignments" component={AssignmentsScreen} options={{ title: 'Asignaciones' }} />
      <Stack.Screen name="ControlCenter" component={ControlCenterScreen} options={{ title: 'Centro de Control' }} />
      <Stack.Screen name="AuditLog" component={AuditLogScreen} options={{ title: 'Auditoría' }} />
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
      <Stack.Screen name="Patrol" component={PatrolScreen} options={{ title: 'Ronda' }} />
      <Stack.Screen name="PatrolHistory" component={PatrolHistoryScreen} options={{ title: 'Historial de rondas' }} />
      <Stack.Screen name="PatrolHistoryDetail" component={PatrolHistoryDetailScreen} options={{ title: 'Detalle de ronda' }} />
      <Stack.Screen name="Visits" component={VisitsScreen} options={{ title: 'Visitas' }} />
      <Stack.Screen name="VisitHistory" component={VisitHistoryScreen} options={{ title: 'Historial de visitas' }} />
      <Stack.Screen name="ScanVisitorQR" component={ScanVisitorQRScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ScanCheckpointQR" component={ScanCheckpointQRScreen} options={{ headerShown: false }} />
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
      <Stack.Screen name="VisitInvitation" component={VisitInvitationScreen} options={{ title: 'Invitar visita' }} />
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
      <NavigationContainer ref={navigationRef}>
        <KioskNavigator />
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
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
