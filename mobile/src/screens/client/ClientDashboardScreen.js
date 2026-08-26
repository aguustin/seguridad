import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Switch, Alert, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getClientProfile, toggleLocationSharing, updateClientContact } from '../../services/api';
import { updateLocation } from '../../services/socket';
import * as Location from 'expo-location';
import { COLORS } from '../../config/constants';
import Input from '../../components/Input';
import Button from '../../components/Button';
import ChangePasswordModal from '../../components/ChangePasswordModal';

export default function ClientDashboardScreen({ navigation }) {
  const { logout } = useAuth();
  const [profile, setProfile]               = useState(null);
  const [locationSharing, setLocationSharing] = useState(false);
  const [refreshing, setRefreshing]         = useState(false);

  const watcherRef  = useRef(null);
  const blockToggle = useRef(true);

  const [showContactModal, setShowContactModal] = useState(false);
  const [contactInput, setContactInput] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    load();
    return () => watcherRef.current?.remove();
  }, []);

  async function load() {
    blockToggle.current = true;
    try {
      const { data } = await getClientProfile();
      setProfile(data);
      if (data.locationSharingEnabled) await startWatcher();
      setLocationSharing(data.locationSharingEnabled);
    } catch {}
    finally {
      setRefreshing(false);
      requestAnimationFrame(() => { blockToggle.current = false; });
    }
  }

  async function startWatcher() {
    if (watcherRef.current) return;
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
    if (blockToggle.current) return;
    setLocationSharing(val);
    try {
      await toggleLocationSharing(val);
      if (val) await startWatcher();
      else stopWatcher();
    } catch {
      setLocationSharing(!val);
    }
  }

  function openContactModal() {
    setContactInput(profile?.contact || '');
    setShowContactModal(true);
  }

  async function handleSaveContact() {
    setSavingContact(true);
    try {
      const { data } = await updateClientContact(contactInput.trim());
      setProfile((p) => ({ ...p, contact: data.contact }));
      setShowContactModal(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo guardar el teléfono');
    } finally {
      setSavingContact(false);
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
          <TouchableOpacity style={styles.contactRow} onPress={openContactModal}>
            <Ionicons name="call-outline" size={13} color={profile?.contact ? COLORS.accent : 'rgba(255,255,255,0.35)'} />
            <Text style={[styles.contactText, !profile?.contact && styles.contactTextEmpty]}>
              {profile?.contact || 'Agregar teléfono de contacto'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => setShowChangePassword(true)}>
            <Ionicons name="key-outline" size={22} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
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
      </View>

      <ChangePasswordModal visible={showChangePassword} onClose={() => setShowChangePassword(false)} />

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
              color={locationSharing ? COLORS.primary : 'rgba(255,255,255,0.45)'}
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
          trackColor={{ false: COLORS.surfaceBorder, true: COLORS.accent }}
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
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(59,130,246,0.15)' }]}>
              <Ionicons name="chatbubbles-outline" size={26} color={COLORS.info} />
            </View>
            <Text style={styles.actionLabel}>Chat con seguridad</Text>
            <Text style={styles.actionDesc}>Comunicación directa con administración</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ClientEmergency')}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(239,68,68,0.15)' }]}>
              <Ionicons name="alert-circle-outline" size={26} color={COLORS.danger} />
            </View>
            <Text style={styles.actionLabel}>Alerta de emergencia</Text>
            <Text style={styles.actionDesc}>Notificá a los administradores</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('VisitInvitation')}
          >
            <View style={[styles.actionIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
              <Ionicons name="qr-code-outline" size={26} color={COLORS.success} />
            </View>
            <Text style={styles.actionLabel}>Invitar visita</Text>
            <Text style={styles.actionDesc}>Generá un QR para agilizar el ingreso</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Teléfono de contacto: lo usa el admin para poder llamar si mandás
          una emergencia (ver AdminAlertsScreen) y el guardia si tu visita
          llega sin invitación QR (ver VisitsScreen). */}
      <Modal visible={showContactModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Teléfono de contacto</Text>
              <TouchableOpacity onPress={() => setShowContactModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Lo ve un administrador si mandás una alerta de emergencia, y un guardia si te llega una visita.
            </Text>
            <Input
              dark
              label="Teléfono"
              value={contactInput}
              onChangeText={setContactInput}
              icon="call-outline"
              keyboardType="phone-pad"
              placeholder="Número de teléfono"
            />
            <Button title="Guardar" onPress={handleSaveContact} loading={savingContact} style={{ marginTop: 14 }} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  header: {
    backgroundColor: COLORS.primary, padding: 20, paddingTop: 54,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  headerActions:    { flexDirection: 'row', alignItems: 'center', gap: 14 },
  greeting:         { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  name:             { fontSize: 22, fontWeight: '800', color: COLORS.white, marginTop: 2 },
  neighborhoodRow:  { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  neighborhoodText: { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  contactRow:       { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  contactText:      { fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  contactTextEmpty: { color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle:  { fontSize: 18, fontWeight: '800', color: COLORS.white },
  modalHint:   { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16, lineHeight: 17 },

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
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    marginHorizontal: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  locationLeft:       { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  locationIcon:       { width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center' },
  locationIconActive: { backgroundColor: COLORS.accent },
  locationTitle:      { fontSize: 15, fontWeight: '700', color: COLORS.white },
  locationSub:        { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  actionsSection: { padding: 16, paddingTop: 20 },
  sectionTitle:   { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 },
  actionsGrid:    { gap: 10 },
  actionCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  actionIcon:  { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  actionDesc:  { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
});
