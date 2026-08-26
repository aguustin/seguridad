import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPatrolSessions, getNeighborhoods, getSecurityStaff } from '../../services/api';
import Input from '../../components/Input';
import { COLORS } from '../../config/constants';

const STATUS_LABEL = { in_progress: 'En curso', completed: 'Completada', cancelled: 'Cancelada' };
const STATUS_COLOR = { in_progress: COLORS.info, completed: COLORS.success, cancelled: COLORS.danger };

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Vista administrativa de rondas realizadas, con filtros simples:
 * barrio y guardia (chips, igual que AdminMapScreen), y rango de fecha
 * sobre startedAt (aplicado con un botón, no en cada tecla).
 */
export default function PatrolSessionsScreen({ navigation }) {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE = 20;

  const [neighborhoods, setNeighborhoods] = useState([]);
  const [guards, setGuards] = useState([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState(null);
  const [selectedGuardId, setSelectedGuardId] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { loadFilters(); }, []);

  // Los chips filtran al instante; la fecha se aplica con el botón "Filtrar"
  // (ver applyDateFilter) para no disparar un request por cada tecla.
  useEffect(() => { load(0, true); }, [selectedNeighborhoodId, selectedGuardId]);

  async function loadFilters() {
    try {
      const [nRes, gRes] = await Promise.all([getNeighborhoods(), getSecurityStaff()]);
      setNeighborhoods(nRes.data);
      setGuards(gRes.data);
    } catch {}
  }

  function buildParams(offset) {
    const params = { limit: PAGE, offset };
    if (selectedNeighborhoodId) params.neighborhoodId = selectedNeighborhoodId;
    if (selectedGuardId) params.securityStaffId = selectedGuardId;
    if (from.trim()) params.from = from.trim();
    if (to.trim()) params.to = to.trim();
    return params;
  }

  async function load(offset = 0, reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await getPatrolSessions(buildParams(offset));
      if (reset) setSessions(data.rows);
      else setSessions((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  function applyDateFilter() {
    load(0, true);
  }

  function onRefresh() {
    setRefreshing(true);
    load(0, true);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rondas realizadas</Text>
        <Text style={styles.headerCount}>{total} ronda{total === 1 ? '' : 's'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {[{ id: null, name: 'Todos los barrios' }, ...neighborhoods].map((n) => {
          const active = selectedNeighborhoodId === n.id;
          return (
            <TouchableOpacity
              key={String(n.id)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedNeighborhoodId(n.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{n.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {[{ id: null, firstName: 'Todos', lastName: 'los guardias' }, ...guards].map((g) => {
          const active = selectedGuardId === g.id;
          const label = g.id === null ? 'Todos los guardias' : `${g.firstName} ${g.lastName}`;
          return (
            <TouchableOpacity
              key={String(g.id)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedGuardId(g.id)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.dateRow}>
        <Input
          dark
          style={styles.dateInput}
          label="Desde"
          placeholder="AAAA-MM-DD"
          value={from}
          onChangeText={setFrom}
          autoCapitalize="none"
        />
        <Input
          dark
          style={styles.dateInput}
          label="Hasta"
          placeholder="AAAA-MM-DD"
          value={to}
          onChangeText={setTo}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.filterBtn} onPress={applyDateFilter}>
          <Ionicons name="search" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        onEndReached={() => { if ((page + 1) * PAGE < total) load((page + 1) * PAGE); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>No hay rondas registradas con estos filtros</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.record}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('PatrolSessionDetail', { patrolSessionId: item.id })}
          >
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] || COLORS.accent }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.guardName}>
                {item.staff ? `${item.staff.firstName} ${item.staff.lastName}` : 'Guardia'}
              </Text>
              <Text style={styles.routeName}>
                {item.route?.name}{item.route?.neighborhood?.name ? ` · ${item.route.neighborhood.name}` : ''}
              </Text>
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

  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },

  dateRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  dateInput: { flex: 1, marginBottom: 0 },
  filterBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    width: 52, height: 52, justifyContent: 'center', alignItems: 'center',
  },

  list:  { padding: 16, gap: 8, paddingBottom: 30 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40 },
  record: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14, gap: 12,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  statusDot:    { width: 10, height: 10, borderRadius: 5 },
  guardName:    { fontSize: 14, fontWeight: '700', color: COLORS.white },
  routeName:    { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  time:         { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 },
  rightCol:     { alignItems: 'flex-end', gap: 4 },
  statusText:   { fontSize: 11, fontWeight: '700' },
});
