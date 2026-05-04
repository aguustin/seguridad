import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
import { getFinancialStats } from '../../services/api';
import { COLORS } from '../../config/constants';

const PERIODS = [
  { value: 'day',   label: 'Hoy' },
  { value: 'week',  label: 'Semana' },
  { value: 'month', label: 'Mes' },
  { value: 'year',  label: 'Año' },
  { value: 'total', label: 'Total' },
];

const screenWidth = Dimensions.get('window').width;

export default function StatisticsScreen() {
  const [period, setPeriod] = useState('month');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadStats();
  }, [period]);

  async function loadStats() {
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Selector de período */}
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
          {/* Cards resumen */}
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

          {/* Gráfico */}
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

          {/* Detalle de registros */}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content:   { padding: 20, paddingBottom: 40 },

  periodRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  periodChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  periodChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  periodText:       { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.55)' },
  periodTextActive: { color: COLORS.primary, fontWeight: '700' },

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

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.white, marginBottom: 12 },
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
