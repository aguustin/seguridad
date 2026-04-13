import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getClientProfile, toggleLocationSharing } from '../../services/api';
import { updateLocation } from '../../services/socket';
import * as Location from 'expo-location';
import { COLORS } from '../../config/constants';

export default function ClientDashboardScreen({ navigation }) {
  const { logout } = useAuth();
  const [profile, setProfile]               = useState(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  // Watcher de posición — ref para no crear múltiples watchers
  const watcherRef = useRef(null);
  // Durante la carga inicial del perfil el Switch NO debe reaccionar al cambio
  // de valor (bug de Android: onValueChange se dispara aunque sea programático)
  const blockToggle = useRef(true);

  useEffect(() => {
    load();
    return () => watcherRef.current?.remove();
  }, []);

  async function load() {
    blockToggle.current = true;
    try {
      const { data } = await getClientProfile();
      setProfile(data);

      if (data.locationSharingEnabled) {
        await startWatcher();
      }
      setLocationSharing(data.locationSharingEnabled);
    } catch {}
    finally {
      setRefreshing(false);
      // Permitir toggles manuales recién después del próximo frame
      // (cuando el Switch ya renderizó con el valor correcto)
      requestAnimationFrame(() => { blockToggle.current = false; });
    }
  }

  async function startWatcher() {
    if (watcherRef.current) return;           // ya activo
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    watcherRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 10000, distanceInterval: 30 },
      (loc) => updateLocation(loc.coords.latitude, loc.coords.longitude),
    );
  }

  function stopWatcher() {
    watcherRef.current?.remove();
    watcherRef.current = null;
  }

  async function handleToggleLocation(val) {
    if (blockToggle.current) return;   // ignorar cambios programáticos
    setLocationSharing(val);
    try {
      await toggleLocationSharing(val);
      if (val) await startWatcher();
      else stopWatcher();
    } catch {
      setLocationSharing(!val);
    }
  }

  const fullName     = profile ? `${profile.firstName} ${profile.lastName}` : '';
  const neighborhood = profile?.neighborhood?.name || 'Sin barrio asignado';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(); }}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hola,</Text>
          <Text style={styles.name}>{fullName}</Text>
          <View style={styles.neighborhoodRow}>
            <Ionicons name="location" size={13} color={COLORS.accent} />
            <Text style={styles.neighborhoodText}>{neighborhood}</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={() =>
            Alert.alert('Cerrar sesión', '¿Querés salir?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: logout },
            ])
          }
        >
          <Ionicons name="log-out-outline" size={22} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>
      </View>

      {/* Botón emergencia */}
      <TouchableOpacity
        style={styles.emergencyBtn}
        onPress={() => navigation.navigate('ClientEmergency')}
        activeOpacity={0.9}
      >
        <View style={styles.emergencyPulse}>
          <View style={styles.emergencyInner}>
            <Ionicons name="warning" size={36} color={COLORS.primary} />
          </View>
        </View>
        <View>
          <Text style={styles.emergencyTitle}>EMERGENCIA</Text>
          <Text style={styles.emergencySub}>Presioná para alertar a seguridad</Text>
        </View>
      </TouchableOpacity>

      {/* Compartir ubicación */}
      <View style={styles.locationCard}>
        <View style={styles.locationLeft}>
          <View style={[styles.locationIcon, locationSharing && styles.locationIconActive]}>
            <Ionicons
              name={locationSharing ? 'location' : 'location-outline'}
              size={20}
              color={locationSharing ? COLORS.primary : COLORS.textSecondary}
            />
          </View>
          <View>
            <Text style={styles.locationTitle}>Compartir ubicación</Text>
            <Text style={styles.locationSub}>
              {locationSharing ? 'La seguridad puede verte' : 'Desactivado'}
            </Text>
          </View>
        </View>
        <Switch
          value={locationSharing}
          onValueChange={handleToggleLocation}
          trackColor={{ false: COLORS.border, true: COLORS.accent }}
          thumbColor={locationSharing ? COLORS.primary : COLORS.white}
        />
      </View>

      {/* Acciones */}
      <View style={styles.actionsSection}>
        <Text style={styles.sectionTitle}>Opciones</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ClientChat')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.infoLight }]}>
              <Ionicons name="chatbubbles-outline" size={26} color={COLORS.info} />
            </View>
            <Text style={styles.actionLabel}>Chat con seguridad</Text>
            <Text style={styles.actionDesc}>Comunicación directa con administración</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ClientEmergency')}
          >
            <View style={[styles.actionIcon, { backgroundColor: COLORS.dangerLight }]}>
              <Ionicons name="alert-circle-outline" size={26} color={COLORS.danger} />
            </View>
            <Text style={styles.actionLabel}>Alerta de emergencia</Text>
            <Text style={styles.actionDesc}>Notificá a los administradores</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary, padding: 20, paddingTop: 54,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  greeting:         { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  name:             { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  neighborhoodRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  neighborhoodText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },

  emergencyBtn: {
    margin: 16, backgroundColor: COLORS.accent, borderRadius: 18,
    padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 16, elevation: 10,
  },
  emergencyPulse: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.12)',
    justifyContent: 'center', alignItems: 'center',
  },
  emergencyInner: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  emergencyTitle: { fontSize: 22, fontWeight: '900', color: COLORS.primary, letterSpacing: 2 },
  emergencySub:   { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 3 },

  locationCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    marginHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  locationLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  locationIcon:       { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  locationIconActive: { backgroundColor: COLORS.accent },
  locationTitle:      { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  locationSub:        { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  actionsSection: { padding: 16, paddingTop: 20 },
  sectionTitle:   { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  actionsGrid:    { gap: 10 },
  actionCard: {
    backgroundColor: COLORS.cardBg, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  actionIcon:  { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  actionDesc:  { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
});
