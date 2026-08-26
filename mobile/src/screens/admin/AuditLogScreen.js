import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getAuditLogs } from '../../services/api';
import Input from '../../components/Input';
import { COLORS } from '../../config/constants';

// Mismas 9 acciones que efectivamente audita el backend (ver auditService.log
// llamado desde adminController/patrolController/assignmentController) —
// nada de "por completitud": si se agrega una acción auditada nueva, se
// suma acá también.
const ACTIONS = [
  { value: null, label: 'Todas' },
  { value: 'admin.create', label: 'Admin creado', icon: 'shield-checkmark-outline' },
  { value: 'security_staff.deactivate', label: 'Guardia dado de baja', icon: 'person-remove-outline' },
  { value: 'patrol_route.deactivate', label: 'Ruta desactivada', icon: 'walk-outline' },
  { value: 'patrol_checkpoint.delete', label: 'Checkpoint eliminado', icon: 'flag-outline' },
  { value: 'financial_record.create', label: 'Registro financiero creado', icon: 'wallet-outline' },
  { value: 'financial_record.update', label: 'Registro financiero editado', icon: 'wallet-outline' },
  { value: 'financial_record.delete', label: 'Registro financiero eliminado', icon: 'wallet-outline' },
  { value: 'assignment.cancel', label: 'Asignación cancelada', icon: 'clipboard-outline' },
  { value: 'alert.resolve', label: 'Alerta resuelta', icon: 'checkmark-circle-outline' },
];
const ACTION_META = Object.fromEntries(ACTIONS.filter((a) => a.value).map((a) => [a.value, a]));

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Resumen corto según la acción — usa lo mínimo relevante de `metadata`,
// sin volcar el objeto entero en la pantalla.
function summarize(log) {
  const m = log.metadata || {};
  switch (log.action) {
    case 'financial_record.create':
    case 'financial_record.delete':
      return `${m.type === 'income' ? 'Ingreso' : 'Egreso'}${m.amount != null ? ` · $${m.amount}` : ''}${m.description ? ` — ${m.description}` : ''}`;
    case 'financial_record.update': {
      const fields = m.changes ? Object.keys(m.changes) : [];
      return fields.length > 0 ? `Campos editados: ${fields.join(', ')}` : '';
    }
    case 'admin.create':
      return m.username || '';
    case 'security_staff.deactivate':
      return m.firstName ? `${m.firstName} ${m.lastName}` : '';
    case 'patrol_route.deactivate':
      return m.name || '';
    case 'patrol_checkpoint.delete':
      return m.name || '';
    case 'assignment.cancel':
      return m.title || '';
    default:
      return '';
  }
}

/**
 * Auditoría de acciones administrativas de alto impacto — solo lectura.
 * Mismo esqueleto que AdminVisitsScreen/AssignmentsScreen: chips de acción +
 * rango de fecha con botón "Filtrar" + lista paginada.
 */
export default function AuditLogScreen() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE = 20;

  const [selectedAction, setSelectedAction] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => { load(0, true); }, [selectedAction]);

  function buildParams(offset) {
    const params = { limit: PAGE, offset };
    if (selectedAction) params.action = selectedAction;
    if (from.trim()) params.from = from.trim();
    if (to.trim()) params.to = to.trim();
    return params;
  }

  async function load(offset = 0, reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await getAuditLogs(buildParams(offset));
      if (reset) setLogs(data.rows);
      else setLogs((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  function applyDateFilter() { load(0, true); }
  function onRefresh() { setRefreshing(true); load(0, true); }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Auditoría</Text>
        <Text style={styles.headerCount}>{total} registro{total === 1 ? '' : 's'}</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {ACTIONS.map((a) => {
          const active = selectedAction === a.value;
          return (
            <TouchableOpacity
              key={String(a.value)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedAction(a.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.label}</Text>
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
        data={logs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        onEndReached={() => { if ((page + 1) * PAGE < total) load((page + 1) * PAGE); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>No hay registros de auditoría con estos filtros</Text>}
        renderItem={({ item }) => {
          const meta = ACTION_META[item.action];
          const summary = summarize(item);
          return (
            <View style={styles.record}>
              <View style={styles.iconWrap}>
                <Ionicons name={meta?.icon || 'time-outline'} size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.actionLabel}>{meta?.label || item.action}</Text>
                {!!summary && <Text style={styles.summary}>{summary}</Text>}
                <Text style={styles.meta}>
                  {item.actor?.name || 'Admin'} · {formatDate(item.createdAt)}
                </Text>
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
  iconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(252,211,77,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  summary:     { fontSize: 12, color: COLORS.accent, marginTop: 2 },
  meta:        { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 3 },
});
