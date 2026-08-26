import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, SectionList, TouchableOpacity,
  RefreshControl, Alert, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAlerts, resolveAlert, getGuardAlerts } from '../../services/api';
import { getSocket } from '../../services/socket';
import { COLORS } from '../../config/constants';

function formatDate(d) {
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

const TABS = ['Emergencias', 'Guardias'];

export default function AdminAlertsScreen({ route }) {
  // Permite abrir directamente en la pestaña de Guardias (ej. al tocar el
  // push de una guard_alert) — por default arranca en Emergencias, como
  // siempre.
  const [tab, setTab] = useState(route?.params?.initialTab ?? 0);

  // Tab Emergencias (clientes)
  const [alerts, setAlerts]       = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // Tab Guardias (historial)
  const [guardAlerts, setGuardAlerts] = useState([]);
  const [guardRefreshing, setGuardRefreshing] = useState(false);

  useEffect(() => {
    loadAlerts();
    loadGuardAlerts();
    const socket = getSocket();
    if (!socket) return;

    socket.on('emergency_alert', (alert) => {
      setAlerts((prev) => [alert, ...prev]);
    });

    socket.on('guard_alert', (alert) => {
      setGuardAlerts((prev) => [
        {
          ...alert,
          guardFirstName: alert.guardFirstName,
          guardLastName:  alert.guardLastName,
          guardContact:   alert.guardContact,
        },
        ...prev,
      ]);
    });

    socket.on('guard_alert_resolved', ({ id }) => {
      setGuardAlerts((prev) =>
        prev.map((a) => a.id === id ? { ...a, isRead: true, resolvedAt: new Date() } : a)
      );
    });

    return () => {
      socket.off('emergency_alert');
      socket.off('guard_alert');
      socket.off('guard_alert_resolved');
    };
  }, []);

  async function loadAlerts() {
    try {
      const { data } = await getAlerts();
      setAlerts(data);
    } catch {}
    finally { setRefreshing(false); }
  }

  async function loadGuardAlerts() {
    try {
      const { data } = await getGuardAlerts();
      setGuardAlerts(data.rows);
    } catch {}
    finally { setGuardRefreshing(false); }
  }

  async function handleResolve(id) {
    try {
      await resolveAlert(id);
      setAlerts((prev) =>
        prev.map((a) => a.id === id ? { ...a, isRead: true, resolvedAt: new Date() } : a)
      );
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  }

  // Secciones tab Emergencias
  const pending  = alerts.filter((a) => !a.isRead);
  const resolved = alerts.filter((a) =>  a.isRead);
  const emergencySections = [
    ...(pending.length  > 0 ? [{ title: 'Sin resolver', data: pending,  key: 'pending'  }] : []),
    ...(resolved.length > 0 ? [{ title: 'Resueltas',    data: resolved, key: 'resolved' }] : []),
  ];

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((label, i) => (
          <TouchableOpacity
            key={label}
            style={[styles.tab, tab === i && styles.tabActive]}
            onPress={() => setTab(i)}
          >
            <Text style={[styles.tabText, tab === i && styles.tabTextActive]}>{label}</Text>
            {i === 0 && pending.length > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{pending.length}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab 0: Emergencias de clientes ── */}
      {tab === 0 && (
        <SectionList
          sections={emergencySections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadAlerts(); }}
              tintColor={COLORS.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={52} color={COLORS.success} />
              <Text style={styles.emptyTitle}>Sin emergencias</Text>
              <Text style={styles.emptySubtitle}>No hay alertas de emergencia registradas</Text>
            </View>
          }
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionDot, { backgroundColor: section.key === 'pending' ? COLORS.danger : COLORS.success }]} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <View style={[styles.sectionCount, { backgroundColor: section.key === 'pending' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)' }]}>
                <Text style={[styles.sectionCountText, { color: section.key === 'pending' ? COLORS.danger : COLORS.success }]}>
                  {section.data.length}
                </Text>
              </View>
            </View>
          )}
          renderItem={({ item, section }) => (
            <ClientAlertCard
              item={item}
              isPending={section.key === 'pending'}
              onResolve={() => handleResolve(item.id)}
            />
          )}
        />
      )}

      {/* ── Tab 1: Historial alertas de guardias ── */}
      {tab === 1 && (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={guardRefreshing}
              onRefresh={() => { setGuardRefreshing(true); loadGuardAlerts(); }}
              tintColor={COLORS.accent}
            />
          }
        >
          {guardAlerts.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="shield-checkmark-outline" size={52} color={COLORS.success} />
              <Text style={styles.emptyTitle}>Sin alertas de guardias</Text>
              <Text style={styles.emptySubtitle}>No hubo alertas enviadas por guardias</Text>
            </View>
          ) : (
            guardAlerts.map((a) => (
              <GuardAlertCard key={a.id} item={a} />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ── Tarjeta emergencia de cliente ──────────────────────────────────────────
function ClientAlertCard({ item, isPending, onResolve }) {
  return (
    <View style={[styles.card, isPending ? styles.cardPending : styles.cardResolved]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: isPending ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)' }]}>
          <Ionicons name={isPending ? 'warning' : 'checkmark-circle'} size={20} color={isPending ? COLORS.danger : COLORS.success} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, !isPending && styles.cardTitleResolved]}>{item.title}</Text>
          <Text style={styles.cardTime}>{formatDate(item.createdAt)}</Text>
        </View>
        {isPending
          ? <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>Pendiente</Text></View>
          : <View style={styles.resolvedBadge}><Text style={styles.resolvedBadgeText}>Resuelta</Text></View>
        }
      </View>
      {!!item.clientName && (
        <View style={styles.contactRow}>
          <Ionicons name="person-outline" size={13} color={COLORS.accent} />
          <Text style={styles.contactText}>
            {item.clientName}{item.clientNeighborhood ? ` · ${item.clientNeighborhood}` : ''}
          </Text>
        </View>
      )}
      {!!item.clientContact && (
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color={COLORS.accent} />
          <Text style={styles.contactText}>{item.clientContact}</Text>
        </View>
      )}
      <Text style={[styles.cardMsg, !isPending && styles.cardMsgResolved]}>{item.message}</Text>
      {item.clientLatitude ? (
        <View style={styles.locationRow}>
          <Ionicons name="location" size={13} color={COLORS.info} />
          <Text style={styles.locationText}>{item.clientLatitude.toFixed(5)}, {item.clientLongitude.toFixed(5)}</Text>
        </View>
      ) : null}
      {!isPending && item.resolvedAt && (
        <View style={styles.resolvedAtRow}>
          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.25)" />
          <Text style={styles.resolvedAtText}>Resuelta el {formatDate(item.resolvedAt)}</Text>
        </View>
      )}
      {isPending && (
        <TouchableOpacity style={styles.resolveBtn} onPress={onResolve} activeOpacity={0.8}>
          <Ionicons name="checkmark" size={15} color={COLORS.white} />
          <Text style={styles.resolveBtnText}>Marcar como resuelta</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Tarjeta alerta de guardia ──────────────────────────────────────────────
function GuardAlertCard({ item }) {
  const isResolved = item.isRead;
  const guardName  = item.guardFirstName
    ? `${item.guardFirstName} ${item.guardLastName}`
    : 'Guardia desconocido';

  return (
    <View style={[styles.card, isResolved ? styles.cardResolved : styles.cardGuardAlert]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: isResolved ? 'rgba(255,255,255,0.06)' : 'rgba(234,179,8,0.15)' }]}>
          <Ionicons name="shield" size={20} color={isResolved ? 'rgba(255,255,255,0.3)' : COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.cardTitle, isResolved && styles.cardTitleResolved]}>{guardName}</Text>
          <Text style={styles.cardTime}>{formatDate(item.createdAt)}</Text>
        </View>
        {isResolved
          ? <View style={styles.resolvedBadge}><Text style={styles.resolvedBadgeText}>Resuelta</Text></View>
          : <View style={styles.guardAlertBadge}><Text style={styles.guardAlertBadgeText}>Activa</Text></View>
        }
      </View>

      {/* Contacto */}
      {item.guardContact ? (
        <View style={styles.contactRow}>
          <Ionicons name="call-outline" size={13} color={COLORS.accent} />
          <Text style={styles.contactText}>{item.guardContact}</Text>
        </View>
      ) : null}

      {/* Razón */}
      <Text style={[styles.cardMsg, isResolved && styles.cardMsgResolved]}>
        {item.reason || item.message}
      </Text>

      {/* Fecha resolución */}
      {isResolved && item.resolvedAt && (
        <View style={styles.resolvedAtRow}>
          <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.25)" />
          <Text style={styles.resolvedAtText}>Resuelta el {formatDate(item.resolvedAt)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBorder,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 14,
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.accent },
  tabText:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: COLORS.white, fontWeight: '700' },
  tabBadge: {
    backgroundColor: COLORS.danger, borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 1,
    minWidth: 18, alignItems: 'center',
  },
  tabBadgeText: { fontSize: 10, fontWeight: '800', color: COLORS.white },

  list: { padding: 16, paddingBottom: 40 },

  // Empty
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: COLORS.white },
  emptySubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 6 },
  sectionDot:    { width: 8, height: 8, borderRadius: 4 },
  sectionTitle:  { fontSize: 11, fontWeight: '700', flex: 1, color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase' },
  sectionCount:  { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  sectionCountText: { fontSize: 11, fontWeight: '800' },

  // Card
  card: { borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1 },
  cardPending:    { backgroundColor: COLORS.surface, borderColor: COLORS.danger + '55', borderLeftWidth: 3, borderLeftColor: COLORS.danger },
  cardResolved:   { backgroundColor: COLORS.surface, borderColor: COLORS.surfaceBorder, opacity: 0.7 },
  cardGuardAlert: { backgroundColor: COLORS.surface, borderColor: COLORS.accent + '55', borderLeftWidth: 3, borderLeftColor: COLORS.accent },

  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  iconWrap:   { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  cardTitle:         { fontSize: 14, fontWeight: '700', color: COLORS.white },
  cardTitleResolved: { color: 'rgba(255,255,255,0.5)' },
  cardTime:          { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },

  pendingBadge:   { backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pendingBadgeText: { fontSize: 11, color: COLORS.danger, fontWeight: '700' },
  resolvedBadge:  { backgroundColor: 'rgba(34,197,94,0.12)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  resolvedBadgeText:{ fontSize: 11, color: COLORS.success, fontWeight: '700' },
  guardAlertBadge:{ backgroundColor: 'rgba(234,179,8,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  guardAlertBadgeText:{ fontSize: 11, color: COLORS.accent, fontWeight: '700' },

  cardMsg:         { fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 20, marginBottom: 8 },
  cardMsgResolved: { color: 'rgba(255,255,255,0.35)' },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  contactText:{ fontSize: 12, color: COLORS.accent, fontWeight: '600' },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  locationText:{ fontSize: 12, color: COLORS.info },

  resolvedAtRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  resolvedAtText:{ fontSize: 11, color: 'rgba(255,255,255,0.25)' },

  resolveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: COLORS.success,
    borderRadius: 10, paddingVertical: 10, marginTop: 4,
  },
  resolveBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
});
