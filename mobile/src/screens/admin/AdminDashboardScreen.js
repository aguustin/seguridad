import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getSecurityStaff, getNeighborhoods, getAlerts } from '../../services/api';
import { getSocket } from '../../services/socket';
import { COLORS } from '../../config/constants';

const SCREEN_W = Dimensions.get('window').width;
// 2 columnas con padding
const ACTION_W = (SCREEN_W - 16 * 2 - 12) / 2;

const StatCard = ({ icon, label, value, accent, onPress }) => (
  <TouchableOpacity
    style={[styles.statCard, accent && styles.statCardAccent]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Ionicons name={icon} size={20} color={accent ? COLORS.primary : COLORS.accent} />
    <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
    <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
  </TouchableOpacity>
);

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
  const [stats, setStats] = useState({ total: 0, active: 0, neighborhoods: 0, alerts: 0 });
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadStats();
    setupSocket();
    // Recargar stats cada vez que la pantalla vuelve a estar en foco
    // (cubre el caso de volver desde AdminAlerts después de resolver alertas)
    const unsub = navigation.addListener('focus', loadStats);
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
      const [staffRes, neighborRes, alertsRes] = await Promise.all([
        getSecurityStaff(), getNeighborhoods(), getAlerts(),
      ]);
      setStats({
        total: staffRes.data.length,
        active: staffRes.data.filter((s) => s.isOnDuty).length,
        neighborhoods: neighborRes.data.length,
        alerts: alertsRes.data.filter((a) => !a.isRead).length,
      });
    } catch {}
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadStats();
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
        </View>
      </View>

      {/* ── Acciones ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.actionsGrid}>
          {/*<QuickAction icon="people-outline"     label="Guardias"      color={COLORS.info}    onPress={() => navigation.navigate('SecurityList')} />*/}
          <QuickAction icon="person-add-outline" label="Nuevo guardia"  color={COLORS.accent}  onPress={() => navigation.navigate('RegisterSecurity')} />
          <QuickAction icon="person-add-outline" label="Nuevo cliente" color={COLORS.success} onPress={() => navigation.navigate('RegisterClient')} />
          <QuickAction icon="map-outline"        label="Mapa en vivo"  color={COLORS.accent}  onPress={() => navigation.navigate('AdminMap')} />
          <QuickAction icon="megaphone-outline"  label="Enviar alerta" color={COLORS.danger}  onPress={() => navigation.navigate('SendAlert')} />
          <QuickAction icon="wallet-outline"     label="Finanzas"      color="#a78bfa"        onPress={() => navigation.navigate('Finances')} />
          <QuickAction icon="bar-chart-outline"  label="Estadísticas"  color="#34d399"        onPress={() => navigation.navigate('Statistics')} />
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

  // Stats grid (2 columnas)
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    gap: 6,
  },
  statCardAccent:  { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  statValue:       { fontSize: 30, fontWeight: '900', color: COLORS.white },
  statValueAccent: { color: COLORS.primary },
  statLabel:       { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  statLabelAccent: { color: 'rgba(0,0,0,0.6)' },

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
