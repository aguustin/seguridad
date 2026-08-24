import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getMyAttendance } from '../../services/api';
import { COLORS } from '../../config/constants';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function calcDuration(checkIn, checkOut) {
  if (!checkOut) return null;
  const mins = Math.round((new Date(checkOut) - new Date(checkIn)) / 60000);
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function MyAttendanceScreen() {
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
      const { data } = await getMyAttendance({ limit: PAGE, offset });
      if (reset) setRecords(data.rows);
      else setRecords((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mi historial de asistencia</Text>
        <Text style={styles.headerCount}>{total} registros</Text>
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
        ListEmptyComponent={<Text style={styles.empty}>Sin registros aún</Text>}
        renderItem={({ item }) => {
          const duration = calcDuration(item.checkIn, item.checkOut);
          return (
            <View style={styles.record}>
              <View style={[styles.statusDot, { backgroundColor: item.checkOut ? 'rgba(255,255,255,0.2)' : COLORS.success }]} />
              <View style={{ flex: 1 }}>
                <View style={styles.row}>
                  <Ionicons name="log-in-outline" size={14} color={COLORS.success} />
                  <Text style={styles.time}>{formatDate(item.checkIn)}</Text>
                  {item.checkInDelayMinutes > 0 && (
                    <Text style={styles.late}>+{item.checkInDelayMinutes}m</Text>
                  )}
                </View>
                {item.checkOut ? (
                  <View style={styles.row}>
                    <Ionicons name="log-out-outline" size={14} color={COLORS.danger} />
                    <Text style={styles.time}>{formatDate(item.checkOut)}</Text>
                    {duration && <Text style={styles.duration}>{duration}</Text>}
                  </View>
                ) : (
                  <Text style={styles.active}>Turno activo</Text>
                )}
              </View>
            </View>
          );
        }}
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
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  time:      { fontSize: 13, color: COLORS.white },
  late:      { fontSize: 11, color: COLORS.danger, backgroundColor: 'rgba(239,68,68,0.15)', paddingHorizontal: 5, borderRadius: 6 },
  duration:  { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' },
  active:    { fontSize: 12, color: COLORS.success, fontWeight: '600' },
});
