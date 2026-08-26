import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import {
  getFinancialStats, getOperationalStats, getNeighborhoods, getSecurityStaff,
} from '../../services/api';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../config/constants';

const PERIODS = [
  { value: 'day',   label: 'Hoy' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year',  label: 'Año' },
  { value: 'total', label: 'Total' },
];

const TABS = ['Financiero', 'Operativo'];

const screenWidth = Dimensions.get('window').width;

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.statsGrid}>{children}</View>
    </View>
  );
}

/**
 * Financiero (sin cambios de esta etapa) + Operativo (nuevo): dos dominios
 * distintos en dos tabs, mismo patrón que AdminAlertsScreen (Emergencias/
 * Guardias). El financiero sigue usando su propio selector de período,
 * ajeno a barrio/guardia (FinancialRecord no se tocó en esta etapa).
 */
export default function StatisticsScreen({ navigation }) {
  const [tab, setTab] = useState(0);

  // ── Financiero ───────────────────────────────────────────────────────────
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === 0) loadFinancialStats();
  }, [period, tab]);

  async function loadFinancialStats() {
    setLoading(true);
    try {
      const { data } = await getFinancialStats(period);
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  const chartData = stats ? {
    labels: ['Ingresos', 'Gastos', 'Balance'],
    datasets: [{
      data: [
        Math.abs(stats.totalIncome),
        Math.abs(stats.totalExpense),
        Math.abs(stats.balance),
      ],
      colors: [
        () => COLORS.success,
        () => COLORS.danger,
        () => stats.balance >= 0 ? COLORS.success : COLORS.danger,
      ],
    }],
  } : null;

  // ── Operativo ────────────────────────────────────────────────────────────
  const [opPeriod, setOpPeriod] = useState('month');
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [guards, setGuards] = useState([]);
  const [selectedNeighborhoodId, setSelectedNeighborhoodId] = useState(null);
  const [selectedGuardId, setSelectedGuardId] = useState(null);
  const [opStats, setOpStats] = useState(null);
  const [opLoading, setOpLoading] = useState(false);
  const [opError, setOpError] = useState('');

  useEffect(() => {
    if (tab === 1 && neighborhoods.length === 0) loadFilters();
  }, [tab]);

  useEffect(() => {
    if (tab === 1) loadOperationalStats();
  }, [opPeriod, selectedNeighborhoodId, selectedGuardId, tab]);

  async function loadFilters() {
    try {
      const [nRes, gRes] = await Promise.all([getNeighborhoods(), getSecurityStaff()]);
      setNeighborhoods(nRes.data);
      setGuards(gRes.data);
    } catch {}
  }

  async function loadOperationalStats() {
    setOpLoading(true);
    setOpError('');
    try {
      const params = { period: opPeriod };
      if (selectedNeighborhoodId) params.neighborhoodId = selectedNeighborhoodId;
      if (selectedGuardId) params.securityStaffId = selectedGuardId;
      const { data } = await getOperationalStats(params);
      setOpStats(data);
    } catch (err) {
      setOpError(err.response?.data?.error || 'No se pudieron cargar las estadísticas');
    } finally {
      setOpLoading(false);
    }
  }

  function fmtMinutes(m) {
    if (m == null) return '—';
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

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
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Tab 0: Financiero (idéntico a antes) ── */}
      {tab === 0 && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.periodChip, period === p.value && styles.periodChipActive]}
                onPress={() => setPeriod(p.value)}
              >
                <Text style={[styles.periodText, period === p.value && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
          ) : stats ? (
            <>
              <View style={styles.cardsRow}>
                <View style={[styles.card, { borderTopColor: COLORS.success }]}>
                  <Text style={styles.cardLabel}>Ingresos</Text>
                  <Text style={[styles.cardAmount, { color: COLORS.success }]}>
                    ${stats.totalIncome.toLocaleString('es-AR')}
                  </Text>
                </View>
                <View style={[styles.card, { borderTopColor: COLORS.danger }]}>
                  <Text style={styles.cardLabel}>Gastos</Text>
                  <Text style={[styles.cardAmount, { color: COLORS.danger }]}>
                    ${stats.totalExpense.toLocaleString('es-AR')}
                  </Text>
                </View>
              </View>

              <View style={[
                styles.balanceCard,
                { backgroundColor: stats.balance >= 0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)' },
              ]}>
                <Text style={styles.balanceLabel}>Balance</Text>
                <Text style={[styles.balanceAmount, { color: stats.balance >= 0 ? COLORS.success : COLORS.danger }]}>
                  {stats.balance >= 0 ? '+' : ''}${stats.balance.toLocaleString('es-AR')}
                </Text>
              </View>

              {chartData && (
                <View style={styles.chartWrapper}>
                  <Text style={styles.chartTitle}>Resumen visual</Text>
                  <BarChart
                    data={chartData}
                    width={screenWidth - 40}
                    height={220}
                    chartConfig={{
                      backgroundGradientFrom: COLORS.surface,
                      backgroundGradientTo:   COLORS.surface,
                      decimalPlaces: 0,
                      color: (opacity = 1) => `rgba(252,211,77,${opacity})`,
                      labelColor: () => 'rgba(255,255,255,0.45)',
                    }}
                    style={{ borderRadius: 12 }}
                    withCustomBarColorFromData
                    flatColor
                  />
                </View>
              )}

              <Text style={styles.sectionTitle}>Detalle por registro</Text>
              {stats.records.slice(0, 15).map((r) => (
                <View key={r.id} style={styles.recordRow}>
                  <Text style={styles.recordDesc} numberOfLines={1}>{r.description}</Text>
                  <Text style={[styles.recordAmt, { color: r.type === 'income' ? COLORS.success : COLORS.danger }]}>
                    {r.type === 'income' ? '+' : '-'}${parseFloat(r.amount).toLocaleString('es-AR')}
                  </Text>
                </View>
              ))}
            </>
          ) : null}
        </ScrollView>
      )}

      {/* ── Tab 1: Operativo ── */}
      {tab === 1 && (
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.periodRow}>
            {PERIODS.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[styles.periodChip, opPeriod === p.value && styles.periodChipActive]}
                onPress={() => setOpPeriod(p.value)}
              >
                <Text style={[styles.periodText, opPeriod === p.value && styles.periodTextActive]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
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

          {opLoading ? (
            <ActivityIndicator size="large" color={COLORS.accent} style={{ marginTop: 40 }} />
          ) : opError ? (
            <Text style={styles.errorText}>{opError}</Text>
          ) : opStats ? (
            <>
              <Section title="Rondas">
                <StatCard icon="checkmark-done-outline" label="Completadas" value={opStats.patrol.completed}
                  onPress={() => navigation.navigate('PatrolSessions')} />
                <StatCard icon="close-circle-outline" label="Canceladas" value={opStats.patrol.cancelled}
                  onPress={() => navigation.navigate('PatrolSessions')} />
                <StatCard icon="walk-outline" label="En curso" value={opStats.patrol.inProgress}
                  onPress={() => navigation.navigate('PatrolSessions')} />
                <StatCard icon="navigate-outline" label="Checkpoints GPS" value={opStats.patrol.checkpoints.gps} />
                <StatCard icon="qr-code-outline" label="Checkpoints QR" value={opStats.patrol.checkpoints.qr} />
              </Section>

              <Section title="Visitas">
                <StatCard icon="people-outline" label="Registradas" value={opStats.visits.registered}
                  onPress={() => navigation.navigate('AdminVisits')} />
                <StatCard icon="enter-outline" label="Activas ahora" value={opStats.visits.activeNow}
                  onPress={() => navigation.navigate('AdminVisits')} />
                <StatCard icon="qr-code-outline" label="Por invitación QR" value={opStats.visits.viaQR}
                  onPress={() => navigation.navigate('AdminVisits')} />
              </Section>

              <Section title="Asignaciones">
                <StatCard icon="time-outline" label="Pendientes" value={opStats.assignments.pending}
                  onPress={() => navigation.navigate('Assignments')} />
                <StatCard icon="checkmark-done-outline" label="Completadas" value={opStats.assignments.completed}
                  onPress={() => navigation.navigate('Assignments')} />
                <StatCard icon="close-circle-outline" label="Canceladas" value={opStats.assignments.cancelled}
                  onPress={() => navigation.navigate('Assignments')} />
              </Section>

              <Section title="Emergencias de cliente">
                <StatCard icon="warning-outline" label="Generadas" value={opStats.alerts.clientEmergency.generated}
                  onPress={() => navigation.navigate('AdminAlerts', { initialTab: 0 })} />
                <StatCard icon="checkmark-circle-outline" label="Resueltas" value={opStats.alerts.clientEmergency.resolved}
                  onPress={() => navigation.navigate('AdminAlerts', { initialTab: 0 })} />
                <StatCard icon="hourglass-outline" label="Tiempo prom. resolución"
                  value={fmtMinutes(opStats.alerts.clientEmergency.avgResolutionMinutes)} />
              </Section>

              <Section title="Alertas de guardia">
                <StatCard icon="shield-outline" label="Generadas" value={opStats.alerts.guardAlert.generated}
                  onPress={() => navigation.navigate('AdminAlerts', { initialTab: 1 })} />
                <StatCard icon="checkmark-circle-outline" label="Resueltas" value={opStats.alerts.guardAlert.resolved}
                  onPress={() => navigation.navigate('AdminAlerts', { initialTab: 1 })} />
              </Section>

              <Section title="Clientes">
                <StatCard icon="person-circle-outline" label="Activos" value={opStats.clients.active}
                  onPress={() => navigation.navigate('ClientList')} />
                <StatCard icon="person-remove-outline" label="Dados de baja" value={opStats.clients.inactive} />
              </Section>

              <Section title="Asistencia de guardias">
                <StatCard icon="log-in-outline" label="Check-ins" value={opStats.attendance.checkIns} />
                <StatCard icon="alarm-outline" label="Llegadas tarde" value={opStats.attendance.lateCheckIns} />
              </Section>
            </>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content:   { padding: 20, paddingBottom: 40 },

  tabBar: {
    flexDirection: 'row', marginHorizontal: 20, marginTop: 16,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: COLORS.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)' },
  tabTextActive: { color: COLORS.primary, fontWeight: '800' },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  periodChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  periodChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  periodText:       { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  periodTextActive: { color: COLORS.primary, fontWeight: '700' },

  chipRow: { gap: 8, paddingBottom: 12 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },

  errorText: { fontSize: 13, color: COLORS.danger, textAlign: 'center', marginTop: 30 },

  section: { marginBottom: 8 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 8,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },

  cardsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  card: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    borderTopWidth: 4,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  cardLabel:  { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 6 },
  cardAmount: { fontSize: 22, fontWeight: '800' },

  balanceCard: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  balanceLabel:  { fontSize: 16, fontWeight: '700', color: COLORS.white },
  balanceAmount: { fontSize: 24, fontWeight: '800' },

  chartWrapper: {
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  chartTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white, marginBottom: 12 },

  recordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },
  recordDesc: { flex: 1, fontSize: 13, color: COLORS.white, marginRight: 12 },
  recordAmt:  { fontSize: 13, fontWeight: '700' },
});
