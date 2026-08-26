import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMyPatrolHistory } from '../../services/api';
import { COLORS } from '../../config/constants';

const STATUS_LABEL = { in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
const STATUS_COLOR = { in_progress: COLORS.info, completed: COLORS.success, cancelled: COLORS.danger };

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Historial de rondas del guardia autenticado — mismo patrón de paginación
 * (limit/offset + scroll infinito) que MyAttendanceScreen.
 */
export default function PatrolHistoryScreen({ navigation }) {
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
      const { data } = await getMyPatrolHistory({ limit: PAGE, offset });
      if (reset) setRecords(data.rows);
      else setRecords((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi historial de rondas</Text>
        <Text style={styles.headerCount}>{total} ronda{total === 1 ? '' : 's'}</Text>
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
        ListEmptyComponent={<Text style={styles.empty}>Todavía no hiciste ninguna ronda</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.record}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('PatrolHistoryDetail', { patrolSessionId: item.id })}
          >
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] || COLORS.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.routeName}>{item.route?.name || 'Ruta'}</Text>
              {!!item.route?.neighborhood?.name && (
                <Text style={styles.neighborhood}>{item.route.neighborhood.name}</Text>
              )}
              <Text style={styles.time}>{formatDate(item.startedAt)}</Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={[styles.statusText, { color: STATUS_COLOR[item.status] || COLORS.accent }]}>
                {STATUS_LABEL[item.status] || item.status}
              </Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </View>
          </TouchableOpacity>
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14, gap: 12,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  routeName:    { fontSize: 14, fontWeight: '700', color: COLORS.white },
  neighborhood: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
  time:         { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
  rightCol:     { alignItems: 'flex-end', gap: 4 },
  statusText:   { fontSize: 11, fontWeight: '700' },
});
