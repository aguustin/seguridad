import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, RefreshControl, Image, Modal, TextInput, AppState,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  getMyProfile, getActiveColleagues, getMyAlerts,
  sendGuardAlert, resolveGuardAlert, getMyActiveAlert, confirmCheckin,
} from '../../services/api';
import { getSocket, updateLocation } from '../../services/socket';
import * as Location from 'expo-location';
import { startBackgroundLocationTracking, stopBackgroundLocationTracking } from '../../services/backgroundLocation';
import { COLORS, UPLOADS_URL } from '../../config/constants';

export default function SecurityDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [profile, setProfile]       = useState(null);
  const [colleagues, setColleagues] = useState([]);
  const [alerts, setAlerts]         = useState([]);
  const [activeAlert, setActiveAlert] = useState(null); // alerta del guardia en curso
  const [refreshing, setRefreshing]   = useState(false);

  // Modal enviar alerta
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertReason, setAlertReason]             = useState('');
  const [sendingAlert, setSendingAlert]           = useState(false);

  // Check-in pendiente
  const [checkinSession, setCheckinSession] = useState(null); // sessionId pendiente

  // Suscripción activa de watchPositionAsync (foreground). Se guarda en un
  // ref porque hay que poder frenarla al pasar a background, y un ref no
  // dispara re-render como haría un useState.
  const locationWatcherRef = useRef(null);
  // Si el permiso de background ya fue concedido — se pide una sola vez, no
  // en cada transición de estado (para no repetir el diálogo del sistema).
  const backgroundPermissionRef = useRef(false);

  useEffect(() => {
    loadData();
    startForegroundTracking();
    const cleanup = setupSocket();

    // Solo una fuente de tracking activa según el estado de la app:
    // foreground → watchPositionAsync (socket); background →
    // startLocationUpdatesAsync (REST). Nunca las dos al mismo tiempo.
    const appStateSub = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      cleanup?.();
      appStateSub.remove();
      stopForegroundTracking();
    };
  }, []);

  async function handleAppStateChange(nextState) {
    if (nextState === 'background') {
      // Pasa a background: frenar el watcher foreground primero (para que
      // no quede activo ni un instante junto con el de background) y
      // recién ahí arrancar el tracking en background, si hay permiso.
      stopForegroundTracking();
      if (backgroundPermissionRef.current) {
        try {
          await startBackgroundLocationTracking();
        } catch (err) {
          console.error('[SecurityDashboard] Error iniciando tracking en background:', err.message);
        }
      }
    } else if (nextState === 'active') {
      // Vuelve a foreground: frenar background primero y recién ahí
      // retomar el watcher foreground — mismo orden "frenar antes de
      // arrancar" para evitar que ambos convivan.
      try {
        await stopBackgroundLocationTracking();
      } catch (err) {
        console.error('[SecurityDashboard] Error deteniendo tracking en background:', err.message);
      }
      await startForegroundTracking();
    }
    // 'inactive' (iOS, transiciones momentáneas como el centro de control)
    // se ignora a propósito: no es un cambio real de foreground/background.
  }

  function setupSocket() {
    const socket = getSocket();
    if (!socket) return () => {};

    socket.on('admin_alert', (a) => {
      setAlerts((p) => [a, ...p.slice(0, 4)]);
      Alert.alert('🚨 ' + a.title, a.message);
    });

    socket.on('guard_status_change', ({ guardId, status }) => {
      if (status === 'online') loadData();
      else setColleagues((p) => p.filter((c) => c.id !== guardId));
    });

    // Solicitud de check-in del servidor
    socket.on('checkin_request', ({ sessionId }) => {
      setCheckinSession(sessionId);
      Alert.alert(
        '⏱ Verificación de turno',
        'Confirmá que la situación está controlada (60 seg)',
        [
          {
            text: 'Situación controlada',
            onPress: () => handleConfirmCheckin(sessionId),
          },
        ],
        { cancelable: false }
      );
    });

    // Si le asignan / revocan el rol de operador mientras está logueado
    socket.on('operator_assigned', ({ isOperator }) => {
      setProfile((p) => p ? { ...p, isOperator } : p);
      if (isOperator) {
        Alert.alert('Rol asignado', 'Ahora sos el operador activo.');
      }
    });

    return () => {
      socket.off('admin_alert');
      socket.off('guard_status_change');
      socket.off('checkin_request');
      socket.off('operator_assigned');
    };
  }

  async function startForegroundTracking() {
    if (locationWatcherRef.current) return; // ya está activo, no duplicar

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    locationWatcherRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 15000, distanceInterval: 20 },
      (loc) => updateLocation(loc.coords.latitude, loc.coords.longitude)
    );

    // El permiso de background se pide una única vez (la primera vez que
    // arranca el tracking foreground), no en cada transición de estado —
    // en Android 10+/iOS el sistema lo pide en un segundo paso, separado
    // del foreground. Si el guardia no lo otorga, el tracking en
    // background simplemente no se activa más adelante; el foreground
    // sigue funcionando igual, no es bloqueante.
    if (!backgroundPermissionRef.current) {
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        backgroundPermissionRef.current = bg.status === 'granted';
      } catch (err) {
        console.error('[SecurityDashboard] No se pudo pedir permiso de background:', err.message);
      }
    }
  }

  function stopForegroundTracking() {
    if (locationWatcherRef.current) {
      locationWatcherRef.current.remove();
      locationWatcherRef.current = null;
    }
  }

  async function loadData() {
    try {
      const [p, c, a, aa] = await Promise.all([
        getMyProfile(),
        getActiveColleagues(),
        getMyAlerts(),
        getMyActiveAlert(),
      ]);
      setProfile(p.data);
      setColleagues(c.data.filter((x) => x.id !== user?.id));
      setAlerts(a.data.slice(0, 5));
      setActiveAlert(aa.data);
    } catch {}
    finally { setRefreshing(false); }
  }

  async function handleSendAlert() {
    if (!alertReason.trim()) return Alert.alert('Error', 'Describí la razón de la alerta');
    setSendingAlert(true);
    try {
      const { data } = await sendGuardAlert(alertReason.trim());
      setActiveAlert(data.alert);
      setAlertModalVisible(false);
      setAlertReason('');
      Alert.alert('Alerta enviada', 'El administrador y operador fueron notificados.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSendingAlert(false);
    }
  }

  async function handleResolveAlert() {
    if (!activeAlert) return;
    try {
      await resolveGuardAlert(activeAlert.id);
      setActiveAlert(null);
      Alert.alert('Alerta terminada', 'La situación fue marcada como resuelta.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    }
  }

  async function handleConfirmCheckin(sessionId) {
    try {
      await confirmCheckin(sessionId);
      setCheckinSession(null);
    } catch {}
  }

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir', style: 'destructive',
        onPress: () => {
          navigation.navigate('SecurityFaceScan');
          logout();
        },
      },
    ]);
  }

  const isOperator = profile?.isOperator;

  return (
    <>
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadData(); }}
            tintColor={COLORS.accent}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {profile?.profilePhoto
              ? <Image source={{ uri: `${UPLOADS_URL}/${profile.profilePhoto}` }} style={styles.avatar} />
              : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={22} color={COLORS.primary} />
                </View>
              )
            }
            <View>
              <Text style={styles.greeting}>Bienvenido</Text>
              <Text style={styles.guardName}>{profile?.firstName} {profile?.lastName}</Text>
              {isOperator && (
                <View style={styles.operatorPill}>
                  <Ionicons name="headset" size={11} color={COLORS.primary} />
                  <Text style={styles.operatorPillText}>OPERADOR</Text>
                </View>
              )}
              {profile?.neighborhood && (
                <View style={styles.neighborRow}>
                  <Ionicons name="location" size={12} color={COLORS.accent} />
                  <Text style={styles.neighborText}>{profile.neighborhood.name}</Text>
                </View>
              )}
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </View>

        {/* Turno */}
        {profile?.shiftStart && (
          <View style={styles.shiftCard}>
            <View style={styles.shiftItem}>
              <View style={[styles.shiftDot, { backgroundColor: COLORS.success }]} />
              <Text style={styles.shiftLabel}>ENTRADA</Text>
              <Text style={styles.shiftTime}>{profile.shiftStart}</Text>
            </View>
            <View style={styles.shiftSep} />
            <View style={styles.shiftItem}>
              <View style={[styles.shiftDot, { backgroundColor: COLORS.danger }]} />
              <Text style={styles.shiftLabel}>SALIDA</Text>
              <Text style={styles.shiftTime}>{profile.shiftEnd}</Text>
            </View>
          </View>
        )}

        {/* Alerta activa del guardia */}
        {activeAlert ? (
          <View style={styles.activeAlertCard}>
            <View style={styles.activeAlertHeader}>
              <View style={styles.activeAlertDot} />
              <Text style={styles.activeAlertTitle}>⚠️ ALERTA ACTIVA</Text>
            </View>
            <Text style={styles.activeAlertReason} numberOfLines={3}>
              {activeAlert.reason}
            </Text>
            <TouchableOpacity style={styles.resolveBtn} onPress={handleResolveAlert}>
              <Ionicons name="checkmark-circle-outline" size={16} color={COLORS.success} />
              <Text style={styles.resolveBtnText}>Terminar alerta</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* Botón enviar alerta de guardia */
          <TouchableOpacity
            style={styles.guardAlertBtn}
            onPress={() => setAlertModalVisible(true)}
            activeOpacity={0.85}
          >
            <View style={styles.guardAlertIcon}>
              <Ionicons name="alert-circle" size={28} color={COLORS.white} />
            </View>
            <View>
              <Text style={styles.guardAlertTitle}>ENVIAR ALERTA</Text>
              <Text style={styles.guardAlertSub}>Notificar situación irregular</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.4)" style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}

        {/* Alertas del admin */}
        {alerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Alertas recientes</Text>
            {alerts.slice(0, 2).map((a) => (
              <View key={a.id} style={styles.alertCard}>
                <View style={styles.alertDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.alertTitle}>{a.title}</Text>
                  <Text style={styles.alertMsg} numberOfLines={1}>{a.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Compañeros activos */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Compañeros activos</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{colleagues.length}</Text>
            </View>
          </View>
          {colleagues.length === 0
            ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={32} color="rgba(255,255,255,0.3)" />
                <Text style={styles.emptyText}>No hay compañeros activos</Text>
              </View>
            )
            : colleagues.map((c) => (
              <TouchableOpacity key={c.id} style={styles.colleagueRow} onPress={() => navigation.navigate('SecurityChat')}>
                {c.profilePhoto
                  ? <Image source={{ uri: `${UPLOADS_URL}/${c.profilePhoto}` }} style={styles.colAvatar} />
                  : <View style={[styles.colAvatar, styles.colAvatarPlaceholder]}><Ionicons name="person" size={18} color="rgba(255,255,255,0.3)" /></View>
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.colName}>{c.firstName} {c.lastName}</Text>
                  {c.isOperator && (
                    <Text style={styles.colOperator}>Operador</Text>
                  )}
                </View>
                <View style={styles.activePill}><Text style={styles.activePillText}>Activo</Text></View>
              </TouchableOpacity>
            ))
          }
        </View>

        {/* Acciones */}
        <View style={[styles.section, { paddingBottom: 30 }]}>
          <Text style={styles.sectionTitle}>Acciones</Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SecurityAttendance')}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.info + '18' }]}>
                <Ionicons name="time-outline" size={24} color={COLORS.info} />
              </View>
              <Text style={styles.actionLabel}>Historial</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('SecurityChat')}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.success + '18' }]}>
                <Ionicons name="chatbubbles-outline" size={24} color={COLORS.success} />
              </View>
              <Text style={styles.actionLabel}>Chat</Text>
            </TouchableOpacity>
            {isOperator && (
              <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('OperatorDashboard')}>
                <View style={[styles.actionIcon, { backgroundColor: COLORS.accent + '25' }]}>
                  <Ionicons name="headset-outline" size={24} color={COLORS.accent} />
                </View>
                <Text style={styles.actionLabel}>Guardias</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionCard} onPress={handleLogout}>
              <View style={[styles.actionIcon, { backgroundColor: COLORS.danger + '18' }]}>
                <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
              </View>
              <Text style={styles.actionLabel}>Salir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Modal: enviar alerta */}
      <Modal
        visible={alertModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAlertModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>⚠️ Enviar alerta</Text>
              <TouchableOpacity onPress={() => setAlertModalVisible(false)}>
                <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSub}>
              Describí qué sucede. Esta alerta llegará al administrador y operador.
            </Text>
            <TextInput
              style={styles.reasonInput}
              placeholder="Ej: Persona sospechosa en sector norte..."
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={alertReason}
              onChangeText={setAlertReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.sendAlertBtn, sendingAlert && { opacity: 0.6 }]}
              onPress={handleSendAlert}
              disabled={sendingAlert}
            >
              <Ionicons name="alert-circle" size={18} color={COLORS.white} />
              <Text style={styles.sendAlertBtnText}>
                {sendingAlert ? 'Enviando...' : 'Enviar alerta'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.primaryDark },
  header: {
    backgroundColor: COLORS.primary,
    padding: 20, paddingTop: 54,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  headerLeft:           { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:               { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: COLORS.accent },
  avatarPlaceholder:    { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.accent, justifyContent: 'center', alignItems: 'center' },
  greeting:             { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  guardName:            { fontSize: 17, fontWeight: '700', color: COLORS.white },
  operatorPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.accent, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3,
  },
  operatorPillText: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },
  neighborRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  neighborText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },

  shiftCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    margin: 16, borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 4,
  },
  shiftItem:  { flex: 1, alignItems: 'center', gap: 6 },
  shiftDot:   { width: 8, height: 8, borderRadius: 4 },
  shiftLabel: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)', letterSpacing: 1 },
  shiftTime:  { fontSize: 24, fontWeight: '900', color: COLORS.white },
  shiftSep:   { width: 1, backgroundColor: COLORS.surfaceBorder },

  // Alerta activa del guardia
  activeAlertCard: {
    margin: 16, marginTop: 0,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.danger,
  },
  activeAlertHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  activeAlertDot:    { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  activeAlertTitle:  { fontSize: 13, fontWeight: '800', color: COLORS.danger },
  activeAlertReason: { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 19 },
  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 12, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: 'rgba(239,68,68,0.3)',
    alignSelf: 'flex-start',
  },
  resolveBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.success },

  // Botón enviar alerta guardia
  guardAlertBtn: {
    margin: 16, marginTop: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderWidth: 1.5, borderColor: COLORS.danger,
  },
  guardAlertIcon: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: COLORS.danger,
    justifyContent: 'center', alignItems: 'center',
  },
  guardAlertTitle: { fontSize: 15, fontWeight: '800', color: COLORS.white },
  guardAlertSub:   { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  section:       { paddingHorizontal: 16, marginTop: 20 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  countBadge:    { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText:     { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  alertCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder,
    borderLeftWidth: 3, borderLeftColor: COLORS.danger,
  },
  alertDot:   { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  alertTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  alertMsg:   { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  emptyCard:  { backgroundColor: COLORS.surface, borderRadius: 14, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder },
  emptyText:  { fontSize: 14, color: 'rgba(255,255,255,0.45)' },

  colleagueRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  colAvatar:            { width: 42, height: 42, borderRadius: 21 },
  colAvatarPlaceholder: { backgroundColor: COLORS.primaryDark, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.surfaceBorder },
  colName:     { fontSize: 14, fontWeight: '600', color: COLORS.white },
  colOperator: { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 1 },
  activePill:  { backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  activePillText: { fontSize: 11, fontWeight: '700', color: COLORS.success },

  actionsRow:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  actionCard: {
    flex: 1, minWidth: 72,
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 14, alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 2,
  },
  actionIcon:  { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600', color: COLORS.white, textAlign: 'center' },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle:  { fontSize: 17, fontWeight: '800', color: COLORS.white },
  modalSub:    { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16, lineHeight: 19 },
  reasonInput: {
    backgroundColor: COLORS.primary,
    borderRadius: 12, padding: 14,
    color: COLORS.white, fontSize: 14,
    minHeight: 100,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    marginBottom: 16,
  },
  sendAlertBtn: {
    backgroundColor: COLORS.danger,
    borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  sendAlertBtnText: { fontSize: 15, fontWeight: '800', color: COLORS.white },
});
