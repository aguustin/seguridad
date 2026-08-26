import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, Dimensions, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useKiosk } from '../../context/KioskContext';
import {
  getSecurityStaff, getNeighborhoods, getAlerts, getClients,
  getKioskState, setKioskState,
} from '../../services/api';
import { getSocket } from '../../services/socket';
import StatCard from '../../components/StatCard';
import ChangePasswordModal from '../../components/ChangePasswordModal';
import { COLORS } from '../../config/constants';

const SCREEN_W = Dimensions.get('window').width;
// 2 columnas con padding
const ACTION_W = (SCREEN_W - 16 * 2 - 12) / 2;

const QuickAction = ({ icon, label, color, onPress }) => (
  <TouchableOpacity
    style={[styles.actionBtn, { width: ACTION_W }]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <View style={[styles.actionIconCircle, { backgroundColor: color + '22' }]}>
      <Ionicons name={icon} size={28} color={color} />
    </View>
    <Text style={styles.actionLabel} numberOfLines={2}>{label}</Text>
  </TouchableOpacity>
);

export default function AdminDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { activateKiosk } = useKiosk();
  const [stats, setStats] = useState({ total: 0, active: 0, neighborhoods: 0, alerts: 0, clients: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Estado global del kiosco de acceso (abierto/cerrado), persistido en
  // backend — independiente de "activar modo escáner" (que solo bloquea
  // ESTE dispositivo en la pantalla de escaneo).
  const [kiosk, setKiosk] = useState({ isOpen: false, updatedByAdminName: null, loading: true });

  function confirmActivateKiosk() {
    Alert.alert(
      'Activar modo escáner',
      'Este dispositivo va a quedar bloqueado en la pantalla de escaneo facial. Solo va a poder salir con usuario y contraseña de administrador. ¿Continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Activar', onPress: activateKiosk },
      ]
    );
  }

  function confirmToggleKiosk(nextOpen) {
    Alert.alert(
      nextOpen ? 'Abrir kiosco' : 'Cerrar kiosco',
      nextOpen
        ? 'Los dispositivos en modo escáner van a empezar a aceptar reconocimiento facial en la puerta de acceso.'
        : 'Los dispositivos en modo escáner van a dejar de escanear hasta que vuelvas a abrirlo.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: nextOpen ? 'Abrir' : 'Cerrar', onPress: () => toggleKiosk(nextOpen) },
      ]
    );
  }

  async function toggleKiosk(nextOpen) {
    setKiosk((p) => ({ ...p, loading: true }));
    try {
      const { data } = await setKioskState(nextOpen);
      setKiosk((p) => ({ ...p, isOpen: data.isOpen, loading: false }));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar el estado del kiosco');
      setKiosk((p) => ({ ...p, loading: false }));
    }
  }

  async function loadKioskState() {
    try {
      const { data } = await getKioskState();
      setKiosk({ isOpen: data.isOpen, updatedByAdminName: data.updatedByAdminName, loading: false });
    } catch {
      setKiosk((p) => ({ ...p, loading: false }));
    }
  }

  useEffect(() => {
    loadStats();
    loadKioskState();
    setupSocket();
    // Recargar stats cada vez que la pantalla vuelve a estar en foco
    // (cubre el caso de volver desde AdminAlerts después de resolver alertas)
    const unsub = navigation.addListener('focus', () => {
      loadStats();
      loadKioskState();
    });
    return unsub;
  }, [navigation]);

  function setupSocket() {
    const socket = getSocket();
    if (!socket) return;
    socket.on('emergency_alert', () => {
      loadStats(); // actualizar contador inmediatamente
    });
    socket.on('alert_resolved', () => {
      loadStats(); // actualizar contador cuando se resuelve desde otro lado
    });
    return () => {
      socket.off('emergency_alert');
      socket.off('alert_resolved');
    };
  }

  async function loadStats() {
    try {
      const [staffRes, neighborRes, alertsRes, clientsRes] = await Promise.all([
        getSecurityStaff(), getNeighborhoods(), getAlerts(), getClients(),
      ]);
      setStats({
        total: staffRes.data.length,
        active: staffRes.data.filter((s) => s.isOnDuty).length,
        neighborhoods: neighborRes.data.length,
        alerts: alertsRes.data.filter((a) => !a.isRead).length,
        clients: clientsRes.data.length,
      });
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([loadStats(), loadKioskState()]);
    setRefreshing(false);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
      }
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMini}>
            <Ionicons name="shield" size={18} color={COLORS.primary} />
          </View>
          <View>
            <Text style={styles.greeting}>Bienvenido</Text>
            <Text style={styles.adminName}>{user?.name}</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            onPress={() => setShowChangePassword(true)}
          >
            <Ionicons name="key-outline" size={22} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.logoutBtn}
            hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
            onPress={() =>
              Alert.alert('Cerrar sesión', '¿Querés salir?', [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Salir', style: 'destructive', onPress: logout },
              ])
            }
          >
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </View>
      </View>

      <ChangePasswordModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} />

      {/* ── Banner emergencias ── */}
      {stats.alerts > 0 && (
        <TouchableOpacity
          style={styles.emergencyBanner}
          onPress={() => navigation.navigate('AdminAlerts')}
          activeOpacity={0.85}
        >
          <View style={styles.emergencyBannerLeft}>
            <Ionicons name="warning" size={18} color={COLORS.primary} />
            <Text style={styles.emergencyBannerText}>
              {stats.alerts} emergencia{stats.alerts > 1 ? 's' : ''} sin resolver
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
        </TouchableOpacity>
      )}

      {/* ── Estado del kiosco de acceso ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Kiosco de acceso</Text>
        <View style={[styles.kioskCard, kiosk.isOpen ? styles.kioskCardOpen : styles.kioskCardClosed]}>
          <View style={styles.kioskCardLeft}>
            <Ionicons
              name={kiosk.isOpen ? 'lock-open-outline' : 'lock-closed-outline'}
              size={22}
              color={kiosk.isOpen ? COLORS.success : COLORS.danger}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.kioskCardTitle}>
                {kiosk.isOpen ? 'Kiosco abierto' : 'Kiosco cerrado'}
              </Text>
              <Text style={styles.kioskCardSub}>
                {kiosk.isOpen
                  ? 'Los escáneres de acceso están habilitados'
                  : 'Los escáneres de acceso no van a registrar entradas/salidas'}
              </Text>
              {kiosk.updatedByAdminName && (
                <Text style={styles.kioskCardMeta}>Último cambio: {kiosk.updatedByAdminName}</Text>
              )}
            </View>
          </View>
          <Switch
            value={kiosk.isOpen}
            onValueChange={confirmToggleKiosk}
            disabled={kiosk.loading}
            trackColor={{ false: COLORS.surfaceBorder, true: COLORS.success }}
            thumbColor={COLORS.white}
          />
        </View>
      </View>

      {/* ── Resumen ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen</Text>
        <View style={styles.statsGrid}>
          <StatCard icon="people"          label="Guardias"  value={stats.total}
            onPress={() => navigation.navigate('SecurityList')} />
          <StatCard icon="radio-button-on" label="Activos"   value={stats.active} accent
            onPress={() => navigation.navigate('SecurityList')} />
          <StatCard icon="business"        label="Barrios"   value={stats.neighborhoods}
            onPress={() => navigation.navigate('Neighborhoods')} />
          <StatCard icon="alert-circle"    label="Alertas"   value={stats.alerts}
            onPress={() => navigation.navigate('AdminAlerts')} />
          <StatCard icon="person-circle"   label="Clientes"  value={stats.clients}
            onPress={() => navigation.navigate('ClientList')} />
        </View>
      </View>

      {/* ── Acciones ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.actionsGrid}>
          {/*<QuickAction icon="people-outline"     label="Guardias"      color={COLORS.info}    onPress={() => navigation.navigate('SecurityList')} />*/}
          <QuickAction icon="grid-outline"        label="Centro de Control" color={COLORS.danger} onPress={() => navigation.navigate('ControlCenter')} />
          <QuickAction icon="person-add-outline" label="Nuevo guardia"  color={COLORS.accent}  onPress={() => navigation.navigate('RegisterSecurity')} />
          <QuickAction icon="people-outline"      label="Clientes"      color={COLORS.success} onPress={() => navigation.navigate('ClientList')} />
          <QuickAction icon="person-add-outline" label="Nuevo cliente" color={COLORS.success} onPress={() => navigation.navigate('RegisterClient')} />
          <QuickAction icon="map-outline"        label="Mapa en vivo"  color={COLORS.accent}  onPress={() => navigation.navigate('AdminMap')} />
          <QuickAction icon="megaphone-outline"  label="Enviar alerta" color={COLORS.danger}  onPress={() => navigation.navigate('SendAlert')} />
          <QuickAction icon="wallet-outline"     label="Finanzas"      color="#a78bfa"        onPress={() => navigation.navigate('Finances')} />
          <QuickAction icon="bar-chart-outline"  label="Estadísticas"  color="#34d399"        onPress={() => navigation.navigate('Statistics')} />
          <QuickAction icon="scan-outline"       label="Modo escáner"  color={COLORS.info}    onPress={confirmActivateKiosk} />
          <QuickAction icon="shield-checkmark-outline" label="Nuevo admin" color="#60a5fa"    onPress={() => navigation.navigate('RegisterAdmin')} />
          <QuickAction icon="walk-outline"        label="Rondas"        color={COLORS.accent}  onPress={() => navigation.navigate('PatrolSessions')} />
          <QuickAction icon="map-outline"         label="Rutas de ronda" color={COLORS.accent} onPress={() => navigation.navigate('PatrolRoutes')} />
          <QuickAction icon="people-outline"      label="Visitas"       color={COLORS.info}    onPress={() => navigation.navigate('AdminVisits')} />
          <QuickAction icon="clipboard-outline"   label="Asignaciones"  color="#f472b6"        onPress={() => navigation.navigate('Assignments')} />
          <QuickAction icon="time-outline"        label="Auditoría"     color="#94a3b8"        onPress={() => navigation.navigate('AuditLog')} />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content:   { paddingBottom: 36 },

  // Header
  header: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceBorder,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoMini: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  greeting:  { fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5 },
  adminName: { fontSize: 17, fontWeight: '700', color: COLORS.white, marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  logoutBtn: { padding: 8 },

  // Banner
  emergencyBanner: {
    backgroundColor: COLORS.accent,
    marginHorizontal: 16, marginTop: 16,
    borderRadius: 12, padding: 14,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  emergencyBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emergencyBannerText: { fontWeight: '700', color: COLORS.primary, fontSize: 14 },

  // Secciones
  section:      { paddingHorizontal: 16, marginTop: 26 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 14,
  },

  // Kiosco de acceso
  kioskCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    borderLeftWidth: 3,
    gap: 12,
  },
  kioskCardOpen:   { borderLeftColor: COLORS.success },
  kioskCardClosed: { borderLeftColor: COLORS.danger },
  kioskCardLeft:   { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  kioskCardTitle:  { fontSize: 14, fontWeight: '700', color: COLORS.white },
  kioskCardSub:    { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  kioskCardMeta:   { fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 4 },

  // Stats grid (2 columnas) — la tarjeta en sí vive en components/StatCard.js
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },

  // Actions grid (2 columnas fijas)
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionBtn: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    gap: 12,
    minHeight: 110,
  },
  actionIconCircle: {
    width: 54, height: 54, borderRadius: 27,
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: {
    fontSize: 13, fontWeight: '600',
    color: COLORS.white, textAlign: 'center',
    lineHeight: 18,
  },
});
