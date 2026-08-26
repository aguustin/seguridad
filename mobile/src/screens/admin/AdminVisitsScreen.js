import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAdminVisits, getNeighborhoods, getSecurityStaff } from '../../services/api';
import Input from '../../components/Input';
import { COLORS } from '../../config/constants';

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Vista administrativa de visitas (solo lectura) — mismos filtros simples
 * que PatrolSessionsScreen: barrio y guardia por chips, fecha con botón
 * "Filtrar" (no un request por tecla).
 */
export default function AdminVisitsScreen() {
  const [visits, setVisits] = useState([]);
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
      const { data } = await getAdminVisits(buildParams(offset));
      if (reset) setVisits(data.rows);
      else setVisits((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  function applyDateFilter() { load(0, true); }
  function onRefresh() { setRefreshing(true); load(0, true); }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Visitas</Text>
        <Text style={styles.headerCount}>{total} visita{total === 1 ? '' : 's'}</Text>
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
        <Input dark style={styles.dateInput} label="Desde" placeholder="AAAA-MM-DD" value={from} onChangeText={setFrom} autoCapitalize="none" />
        <Input dark style={styles.dateInput} label="Hasta" placeholder="AAAA-MM-DD" value={to} onChangeText={setTo} autoCapitalize="none" />
        <TouchableOpacity style={styles.filterBtn} onPress={applyDateFilter}>
          <Ionicons name="search" size={18} color={COLORS.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={visits}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        onEndReached={() => { if ((page + 1) * PAGE < total) load((page + 1) * PAGE); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>No hay visitas registradas con estos filtros</Text>}
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
              <Text style={styles.meta}>
                {item.neighborhood?.name}
                {item.registeredBy ? ` · Registró: ${item.registeredBy.firstName} ${item.registeredBy.lastName}` : ''}
              </Text>
              <Text style={styles.time}>Ingreso: {formatDate(item.entryAt)}</Text>
              <Text style={styles.time}>
                {item.exitAt ? `Salida: ${formatDate(item.exitAt)}` : 'Todavía adentro'}
              </Text>
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

  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },

  dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  dateInput: { flex: 1, marginBottom: 0 },
  filterBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    width: 52, height: 52, justifyContent: 'center', alignItems: 'center',
  },

  list:  { padding: 16, gap: 8, paddingBottom: 30 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40 },
  record: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  statusDot:  { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  visitorName:{ fontSize: 14, fontWeight: '700', color: COLORS.white },
  dest:       { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  meta:       { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
  time:       { fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
});
