import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAttendanceHistory } from '../../services/api';
import { COLORS } from '../../config/constants';

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function calcDuration(checkIn, checkOut) {
  if (!checkIn || !checkOut) return null;
  const mins = Math.round((new Date(checkOut) - new Date(checkIn)) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export default function AttendanceHistoryScreen({ route }) {
  const { staffId, name } = route.params;
  const [records, setRecords] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE_SIZE = 20;

  useEffect(() => {
    loadRecords(0, true);
  }, []);

  async function loadRecords(offset = 0, reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await getAttendanceHistory(staffId, { limit: PAGE_SIZE, offset });
      if (reset) {
        setRecords(data.rows);
      } else {
        setRecords((prev) => [...prev, ...data.rows]);
      }
      setTotal(data.count);
      setPage(offset / PAGE_SIZE);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function loadMore() {
    const nextOffset = (page + 1) * PAGE_SIZE;
    if (nextOffset < total) loadRecords(nextOffset);
  }

  const renderItem = ({ item }) => {
    const duration = calcDuration(item.checkIn, item.checkOut);
    return (
      <View style={styles.record}>
        <View style={styles.recordLeft}>
          <View style={styles.dot} />
          <View style={styles.line} />
        </View>
        <View style={styles.recordContent}>
          <View style={styles.recordRow}>
            <Ionicons name="log-in-outline" size={16} color={COLORS.success} />
            <Text style={styles.recordTime}>{formatDate(item.checkIn)}</Text>
            {item.checkInDelayMinutes > 0 && (
              <View style={styles.lateBadge}>
                <Text style={styles.lateText}>+{item.checkInDelayMinutes}m tarde</Text>
              </View>
            )}
          </View>
          {item.checkOut ? (
            <View style={styles.recordRow}>
              <Ionicons name="log-out-outline" size={16} color={COLORS.danger} />
              <Text style={styles.recordTime}>{formatDate(item.checkOut)}</Text>
              {duration && <Text style={styles.duration}>{duration}</Text>}
            </View>
          ) : (
            <View style={[styles.recordRow, styles.activeRow]}>
              <Ionicons name="radio-button-on" size={14} color={COLORS.success} />
              <Text style={styles.activeText}>Turno activo</Text>
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.name}>{name}</Text>
        <Text style={styles.totalText}>{total} registros en total</Text>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRecords(0, true); }} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>Sin registros de asistencia</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 16,
  },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.white },
  totalText: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  list: { padding: 16, paddingBottom: 40 },
  empty: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },
  record: { flexDirection: 'row', marginBottom: 16 },
  recordLeft: { alignItems: 'center', marginRight: 14, width: 16 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.accentBlue, marginTop: 4 },
  line: { flex: 1, width: 2, backgroundColor: '#e0e0e0', marginTop: 4 },
  recordContent: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  recordRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  recordTime: { fontSize: 13, color: COLORS.darkGray },
  lateBadge: { backgroundColor: '#fde8e8', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  lateText: { fontSize: 11, color: COLORS.danger, fontWeight: '600' },
  duration: { fontSize: 12, color: COLORS.gray, marginLeft: 'auto' },
  activeRow: { backgroundColor: '#d4edda', borderRadius: 6, paddingHorizontal: 8, marginTop: 2 },
  activeText: { fontSize: 12, color: COLORS.success, fontWeight: '600' },
});
