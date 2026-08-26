import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  Alert, ActivityIndicator, RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/constants';
import { createVisitInvitation, getVisitInvitations } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Invitación de visita por QR: el cliente genera un código que el guardia
 * escanea en la puerta para registrar el ingreso automáticamente, sin que
 * el guardia tenga que tipear los datos a mano. Válida 24hs, de un solo
 * uso — el servidor es quien valida todo (vencimiento, uso, barrio) al
 * escanearla; el QR en sí solo es una referencia opaca al registro.
 */
export default function VisitInvitationScreen() {
  const [visitorName, setVisitorName] = useState('');
  const [creating, setCreating] = useState(false);
  const [current, setCurrent] = useState(null); // última invitación recién creada (para mostrarla grande)

  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await getVisitInvitations();
      setInvitations(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  async function handleCreate() {
    if (!visitorName.trim()) return Alert.alert('Error', 'Ingresá el nombre del visitante');
    setCreating(true);
    try {
      const { data } = await createVisitInvitation(visitorName.trim());
      setCurrent(data);
      setVisitorName('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo generar la invitación');
      setCreating(false);
      return;
    }
    setCreating(false);
    load();
  }

  function statusOf(inv) {
    if (inv.usedAt) return { label: 'Utilizada', color: 'rgba(255,255,255,0.35)' };
    if (new Date(inv.expiresAt) < new Date()) return { label: 'Vencida', color: COLORS.danger };
    return { label: 'Vigente', color: COLORS.success };
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      <Text style={styles.title}>Invitar visita</Text>
      <Text style={styles.subtitle}>
        Generá un código QR para que el guardia registre el ingreso más rápido, sin tener que anotar los datos a mano.
      </Text>

      <Input
        dark
        label="Nombre del visitante"
        value={visitorName}
        onChangeText={setVisitorName}
        placeholder="Ej: Juan Pérez"
        icon="person-outline"
      />
      <Button title="Generar QR" onPress={handleCreate} loading={creating} style={{ marginBottom: 20 }} />

      {current && (
        <View style={styles.qrCard}>
          <Image source={{ uri: current.qrDataUrl }} style={styles.qrImage} />
          <Text style={styles.qrName}>{current.visitorName}</Text>
          <Text style={styles.qrExpiry}>Válido hasta {formatDateTime(current.expiresAt)}</Text>
          <Text style={styles.qrHint}>Mostrale este código al guardia en la puerta</Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Mis invitaciones recientes</Text>
      {loading ? (
        <ActivityIndicator color={COLORS.accent} style={{ marginTop: 20 }} />
      ) : invitations.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="qr-code-outline" size={28} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Todavía no generaste ninguna invitación</Text>
        </View>
      ) : (
        invitations.map((inv) => {
          const s = statusOf(inv);
          return (
            <View key={inv.id} style={styles.invRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.invName}>{inv.visitorName}</Text>
                <Text style={styles.invMeta}>Vence: {formatDateTime(inv.expiresAt)}</Text>
              </View>
              <Text style={[styles.invStatus, { color: s.color }]}>{s.label}</Text>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content: { padding: 20, paddingBottom: 40 },

  title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 20, lineHeight: 19 },

  qrCard: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 6, marginBottom: 24,
    borderWidth: 1.5, borderColor: COLORS.accent,
  },
  qrImage: { width: 220, height: 220, borderRadius: 8, backgroundColor: COLORS.white },
  qrName: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginTop: 8 },
  qrExpiry: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  qrHint: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4, textAlign: 'center' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 24,
    alignItems: 'center', gap: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  invRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  invName: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  invMeta: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  invStatus: { fontSize: 12, fontWeight: '700' },
});
