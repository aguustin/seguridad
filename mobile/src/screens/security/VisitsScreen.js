import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../config/constants';
import { getActiveVisits, registerVisit, registerVisitExit } from '../../services/api';
import Button from '../../components/Button';
import Input from '../../components/Input';

/**
 * Visitantes actualmente dentro del barrio + registro de ingreso/egreso.
 * Cualquier guardia en turno puede registrar el ingreso de un visitante y
 * marcar la salida de cualquiera (no solo la de quien la registró — mismo
 * criterio que "compañeros activos": es una operación del barrio, no
 * personal del guardia).
 */
export default function VisitsScreen({ navigation }) {
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [neighborhoodAssigned, setNeighborhoodAssigned] = useState(true);
  const [visits, setVisits] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    visitorName: '', visitorDocument: '', destinationDescription: '',
    vehiclePlate: '', authorizedBy: '',
  });
  const [saving, setSaving] = useState(false);
  const [exitingId, setExitingId] = useState(null);

  useEffect(() => {
    if (isFocused) load();
  }, [isFocused]);

  async function load() {
    setError('');
    try {
      const { data } = await getActiveVisits();
      setNeighborhoodAssigned(data.neighborhoodAssigned);
      setVisits(data.visits);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las visitas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  function openNew() {
    setForm({ visitorName: '', visitorDocument: '', destinationDescription: '', vehiclePlate: '', authorizedBy: '' });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.visitorName.trim()) return Alert.alert('Error', 'El nombre del visitante es obligatorio');
    if (!form.destinationDescription.trim()) return Alert.alert('Error', 'Indicá a dónde va el visitante');

    setSaving(true);
    try {
      await registerVisit({
        visitorName: form.visitorName.trim(),
        visitorDocument: form.visitorDocument.trim() || undefined,
        destinationDescription: form.destinationDescription.trim(),
        vehiclePlate: form.vehiclePlate.trim() || undefined,
        authorizedBy: form.authorizedBy.trim() || undefined,
      });
      setShowModal(false);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo registrar la visita');
      setSaving(false);
      return;
    }
    setSaving(false);
    load();
  }

  function confirmExit(visit) {
    Alert.alert(
      'Registrar salida',
      `¿Confirmás la salida de "${visit.visitorName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => handleExit(visit.id) },
      ]
    );
  }

  async function handleExit(id) {
    setExitingId(id);
    try {
      await registerVisitExit(id);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo registrar la salida');
      setExitingId(null);
      return;
    }
    setExitingId(null);
    load();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        <View style={styles.titleRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Visitas</Text>
            <Text style={styles.subtitle}>
              {visits.length} visitante{visits.length === 1 ? '' : 's'} adentro
            </Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('VisitHistory')}>
            <Text style={styles.historyLink}>Historial</Text>
          </TouchableOpacity>
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}

        {!neighborhoodAssigned ? (
          <View style={styles.emptyCard}>
            <Ionicons name="alert-circle-outline" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>
              Todavía no fuiste asignado a un barrio. Un administrador tiene que asignarte antes de poder registrar visitas.
            </Text>
          </View>
        ) : visits.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No hay visitantes dentro del barrio</Text>
          </View>
        ) : (
          visits.map((v) => (
            <View key={v.id} style={styles.visitCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.visitorName}>{v.visitorName}</Text>
                <Text style={styles.visitorDest}>
                  {v.destinationClient
                    ? `${v.destinationClient.firstName} ${v.destinationClient.lastName}`
                    : v.destinationDescription}
                </Text>
                {!!v.vehiclePlate && <Text style={styles.visitorMeta}>Patente: {v.vehiclePlate}</Text>}
                {!!v.destinationClient?.contact && (
                  <Text style={styles.visitorMeta}>Tel. {v.destinationClient.firstName}: {v.destinationClient.contact}</Text>
                )}
                <Text style={styles.visitorTime}>
                  Ingresó {new Date(v.entryAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.exitBtn}
                onPress={() => confirmExit(v)}
                disabled={exitingId === v.id}
              >
                {exitingId === v.id
                  ? <ActivityIndicator size="small" color={COLORS.primary} />
                  : <Text style={styles.exitBtnText}>Salida</Text>}
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {neighborhoodAssigned && (
        <>
          <TouchableOpacity
            style={[styles.fab, styles.fabScan]}
            onPress={() => navigation.navigate('ScanVisitorQR')}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={24} color={COLORS.white} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
            <Ionicons name="person-add" size={26} color={COLORS.primary} />
          </TouchableOpacity>
        </>
      )}

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva visita</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <Input dark label="Nombre del visitante *" value={form.visitorName} onChangeText={set('visitorName')} icon="person-outline" />
            <Input dark label="DNI" value={form.visitorDocument} onChangeText={set('visitorDocument')} icon="card-outline" keyboardType="numeric" />
            <Input dark label="Destino *" value={form.destinationDescription} onChangeText={set('destinationDescription')} placeholder="Ej: Casa 24 - Familia Pérez" icon="location-outline" />
            <Input dark label="Patente" value={form.vehiclePlate} onChangeText={set('vehiclePlate')} icon="car-outline" autoCapitalize="characters" />
            <Input dark label="Autorizado por" value={form.authorizedBy} onChangeText={set('authorizedBy')} icon="checkmark-done-outline" />

            <Button title="Registrar ingreso" onPress={handleSave} loading={saving} style={{ marginTop: 14 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content: { padding: 20, paddingBottom: 90 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryDark },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4 },
  historyLink: { fontSize: 13, fontWeight: '700', color: COLORS.accent, marginTop: 4 },
  errorText: { fontSize: 13, color: COLORS.danger, marginBottom: 14 },

  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 24,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  visitCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    marginBottom: 10,
  },
  visitorName: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  visitorDest: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  visitorMeta: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  visitorTime: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 },

  exitBtn: {
    backgroundColor: COLORS.danger, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10,
    minWidth: 72, alignItems: 'center',
  },
  exitBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.white },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
  fabScan: {
    right: 90, backgroundColor: COLORS.info,
    shadowColor: COLORS.info,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },
});
