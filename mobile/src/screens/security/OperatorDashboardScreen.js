import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getActiveGuardsStatus } from '../../services/api';
import { getSocket } from '../../services/socket';
import { COLORS, UPLOADS_URL } from '../../config/constants';

export default function OperatorDashboardScreen({ navigation }) {
  const [guards, setGuards]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  // Guardias que NO respondieron el último check-in
  const [missedGuards, setMissedGuards] = useState([]);
  // Guardias que enviaron alerta activa (guard_alert socket)
  const [alertingGuards, setAlertingGuards] = useState([]); // [{ id, name, reason, contact }]

  useEffect(() => {
    loadGuards();
    const cleanup = setupSocket();
    return cleanup;
  }, []);

  function setupSocket() {
    const socket = getSocket();
    if (!socket) return () => {};

    // Guardia que se conecta/desconecta
    socket.on('guard_status_change', ({ guardId, status }) => {
      if (status === 'online') {
        loadGuards();
        // Si se reconectó, quitarlo de missedGuards
        setMissedGuards((p) => p.filter((g) => g.id !== guardId));
      } else {
        setGuards((p) => p.filter((g) => g.id !== guardId));
      }
    });

    // Guardias que no respondieron el check-in
    socket.on('checkin_missed', ({ guards: missed }) => {
      setMissedGuards(missed);
    });

    // Alerta enviada por un guardia
    socket.on('guard_alert', (alert) => {
      setAlertingGuards((prev) => {
        const exists = prev.find((a) => a.senderId === alert.senderId);
        if (exists) return prev;
        return [
          {
            id: alert.id,
            senderId: alert.senderId,
            name: `${alert.guardFirstName} ${alert.guardLastName}`,
            contact: alert.guardContact,
            reason: alert.reason,
            createdAt: alert.createdAt,
          },
          ...prev,
        ];
      });
    });

    // Alerta del guardia resuelta
    socket.on('guard_alert_resolved', ({ id }) => {
      setAlertingGuards((p) => p.filter((a) => a.id !== id));
    });

    return () => {
      socket.off('guard_status_change');
      socket.off('checkin_missed');
      socket.off('guard_alert');
      socket.off('guard_alert_resolved');
    };
  }

  async function loadGuards() {
    try {
      const { data } = await getActiveGuardsStatus();
      setGuards(data);
    } catch {}
    finally { setRefreshing(false); }
  }

  const isMissed = (id) => missedGuards.some((g) => g.id === id);
  const hasAlert = (id) => alertingGuards.some((a) => a.senderId === id);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); loadGuards(); }}
          tintColor={COLORS.accent}
        />
      }
    >
      {/* Alertas activas de guardias */}
      {alertingGuards.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Alertas activas</Text>
          {alertingGuards.map((a) => (
            <View key={a.id} style={styles.alertCard}>
              <View style={styles.alertCardHeader}>
                <View style={styles.alertDot} />
                <Text style={styles.alertCardName}>{a.name}</Text>
                {a.contact ? (
                  <Text style={styles.alertCardContact}>{a.contact}</Text>
                ) : null}
              </View>
              <Text style={styles.alertCardReason}>{a.reason}</Text>
              <Text style={styles.alertCardTime}>
                {new Date(a.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Check-in perdido */}
      {missedGuards.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: COLORS.danger }]}>
            Sin respuesta check-in ({missedGuards.length})
          </Text>
          {missedGuards.map((g) => (
            <View key={g.id} style={styles.missedCard}>
              <Ionicons name="time" size={18} color={COLORS.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.missedName}>{g.firstName} {g.lastName}</Text>
                {g.contact ? (
                  <Text style={styles.missedContact}>{g.contact}</Text>
                ) : (
                  <Text style={styles.missedContact}>Sin contacto registrado</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Lista de guardias activos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Guardias en turno</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{guards.length}</Text>
          </View>
        </View>
        {guards.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="shield-outline" size={36} color="rgba(255,255,255,0.2)" />
            <Text style={styles.emptyText}>No hay guardias activos</Text>
          </View>
        ) : (
          guards.map((g) => {
            const missed = isMissed(g.id);
            const alerted = hasAlert(g.id);
            return (
              <View
                key={g.id}
                style={[
                  styles.guardRow,
                  alerted && styles.guardRowAlert,
                  missed   && styles.guardRowMissed,
                ]}
              >
                {g.profilePhoto
                  ? <Image source={{ uri: `${UPLOADS_URL}/${g.profilePhoto}` }} style={styles.avatar} />
                  : (
                    <View style={[styles.avatar, styles.avatarPlaceholder]}>
                      <Ionicons name="person" size={20} color={COLORS.textLight} />
                    </View>
                  )
                }
                <View style={{ flex: 1 }}>
                  <Text style={styles.guardName}>{g.firstName} {g.lastName}</Text>
                  {g.contact
                    ? <Text style={styles.guardContact}>{g.contact}</Text>
                    : <Text style={[styles.guardContact, { color: 'rgba(255,255,255,0.2)' }]}>Sin contacto</Text>
                  }
                  {g.neighborhood && (
                    <Text style={styles.guardNeighborhood}>{g.neighborhood.name}</Text>
                  )}
                </View>
                <View style={styles.statusBadges}>
                  {alerted && (
                    <View style={styles.badgeAlert}>
                      <Ionicons name="warning" size={11} color={COLORS.white} />
                      <Text style={styles.badgeAlertText}>Alerta</Text>
                    </View>
                  )}
                  {missed && !alerted && (
                    <View style={styles.badgeMissed}>
                      <Ionicons name="time-outline" size={11} color={COLORS.white} />
                      <Text style={styles.badgeMissedText}>No respondió</Text>
                    </View>
                  )}
                  {!alerted && !missed && (
                    <View style={styles.badgeOk}>
                      <Ionicons name="checkmark" size={11} color={COLORS.success} />
                      <Text style={styles.badgeOkText}>OK</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },

  section:       { padding: 16, paddingBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionTitle:  {
    fontSize: 12, fontWeight: '700', color: COLORS.textSecondary,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  countBadge: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText:  { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  // Alertas activas
  alertCard: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1.5, borderColor: COLORS.danger,
  },
  alertCardHeader:  { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  alertDot:         { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.danger },
  alertCardName:    { fontSize: 14, fontWeight: '700', color: COLORS.white, flex: 1 },
  alertCardContact: { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  alertCardReason:  { fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 18 },
  alertCardTime:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 },

  // Sin respuesta check-in
  missedCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: 'rgba(239,68,68,0.07)',
    borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
  },
  missedName:    { fontSize: 14, fontWeight: '700', color: COLORS.white },
  missedContact: { fontSize: 12, color: COLORS.accent, marginTop: 2 },

  // Guardia row
  guardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  guardRowAlert:  { borderColor: COLORS.danger,  backgroundColor: 'rgba(239,68,68,0.07)' },
  guardRowMissed: { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.04)' },
  avatar:            { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: COLORS.surfaceBorder },

  guardName:         { fontSize: 14, fontWeight: '700', color: COLORS.white },
  guardContact:      { fontSize: 12, color: COLORS.accent, marginTop: 1 },
  guardNeighborhood: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },

  statusBadges: { alignItems: 'flex-end', gap: 4 },
  badgeAlert: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.danger, borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  badgeAlertText: { fontSize: 10, fontWeight: '700', color: COLORS.white },
  badgeMissed: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(239,68,68,0.4)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  badgeMissedText: { fontSize: 10, fontWeight: '700', color: COLORS.white },
  badgeOk: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  badgeOkText: { fontSize: 10, fontWeight: '700', color: COLORS.success },

  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 32,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  emptyText: { fontSize: 14, color: 'rgba(255,255,255,0.3)' },
});
