import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getVisitHistory } from '../../services/api';
import { COLORS } from '../../config/constants';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Historial de visitas del barrio (no personal del guardia — mismo criterio
 * que VisitsScreen). Mismo patrón de paginación que MyAttendanceScreen.
 */
export default function VisitHistoryScreen() {
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE = 20;

  useEffect(() => { load(0, true); }, []);

  async function load(offset = 0, reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await getVisitHistory({ limit: PAGE, offset });
      if (reset) setRecords(data.rows);
      else setRecords((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Historial de visitas</Text>
        <Text style={styles.headerCount}>{total} visita{total === 1 ? '' : 's'}</Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(0, true); }}
            tintColor={COLORS.accent}
          />
        }
        onEndReached={() => { if ((page + 1) * PAGE < total) load((page + 1) * PAGE); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>Todavía no hay visitas registradas</Text>}
        renderItem={({ item }) => (
          <View style={styles.record}>
            <View style={[styles.statusDot, { backgroundColor: item.exitAt ? 'rgba(255,255,255,0.2)' : COLORS.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.visitorName}>{item.visitorName}</Text>
              <Text style={styles.dest}>
                {item.destinationClient
                  ? `${item.destinationClient.firstName} ${item.destinationClient.lastName}`
                  : item.destinationDescription || '-'}
              </Text>
              <View style={styles.row}>
                <Ionicons name="log-in-outline" size={13} color={COLORS.success} />
                <Text style={styles.time}>{formatDate(item.entryAt)}</Text>
              </View>
              {item.exitAt ? (
                <View style={styles.row}>
                  <Ionicons name="log-out-outline" size={13} color={COLORS.danger} />
                  <Text style={styles.time}>{formatDate(item.exitAt)}</Text>
                </View>
              ) : (
                <Text style={styles.active}>Todavía adentro</Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.primaryDark },
  header:      { backgroundColor: COLORS.primary, padding: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  headerCount: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  list:        { padding: 16, gap: 8, paddingBottom: 30 },
  empty:       { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40 },
  record: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14, gap: 12,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  statusDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  visitorName:{ fontSize: 14, fontWeight: '700', color: COLORS.white },
  dest:       { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  row:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  time:       { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  active:     { fontSize: 12, color: COLORS.success, fontWeight: '600', marginTop: 3 },
});
