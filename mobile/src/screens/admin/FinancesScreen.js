import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, ScrollView, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getFinancialRecords, createFinancialRecord, deleteFinancialRecord
} from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

const FREQUENCIES = [
  { value: 'unique', label: 'Único' },
  { value: 'monthly', label: 'Mensual' },
  { value: 'annual', label: 'Anual' },
  { value: 'biweekly', label: 'Quincenal' },
];

export default function FinancesScreen({ navigation }) {
  const [records, setRecords] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [filter, setFilter] = useState(null); // 'income' | 'expense'
  const [form, setForm] = useState({
    type: 'income',
    category: '',
    description: '',
    amount: '',
    frequency: 'unique',
    startDate: new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadRecords();
  }, [filter]);

  async function loadRecords() {
    try {
      const { data } = await getFinancialRecords({ type: filter });
      setRecords(data);
    } catch (err) {
      console.error(err);
    }
  }

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  async function handleSave() {
    if (!form.description || !form.amount) {
      return Alert.alert('Error', 'Completá descripción e importe');
    }
    setSaving(true);
    try {
      await createFinancialRecord(form);
      setShowModal(false);
      loadRecords();
      setForm({ type: 'income', category: '', description: '', amount: '', frequency: 'unique', startDate: new Date().toISOString().split('T')[0] });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    Alert.alert('Eliminar', '¿Eliminar este registro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await deleteFinancialRecord(id);
        loadRecords();
      }},
    ]);
  }

  const totals = records.reduce((acc, r) => {
    if (r.type === 'income') acc.income += parseFloat(r.amount);
    else acc.expense += parseFloat(r.amount);
    return acc;
  }, { income: 0, expense: 0 });

  return (
    <View style={styles.container}>
      {/* Summary */}
      <View style={styles.summary}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Ingresos</Text>
          <Text style={[styles.summaryAmount, { color: COLORS.success }]}>
            ${totals.income.toLocaleString('es-AR')}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Gastos</Text>
          <Text style={[styles.summaryAmount, { color: COLORS.danger }]}>
            ${totals.expense.toLocaleString('es-AR')}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Balance</Text>
          <Text style={[styles.summaryAmount, { color: totals.income - totals.expense >= 0 ? COLORS.success : COLORS.danger }]}>
            ${(totals.income - totals.expense).toLocaleString('es-AR')}
          </Text>
        </View>
      </View>

      {/* Filtros */}
      <View style={styles.filters}>
        {[null, 'income', 'expense'].map((f) => (
          <TouchableOpacity
            key={String(f)}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === null ? 'Todos' : f === 'income' ? 'Ingresos' : 'Gastos'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={styles.statsBtn}
          onPress={() => navigation.navigate('Statistics')}
        >
          <Ionicons name="bar-chart-outline" size={18} color={COLORS.accentBlue} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>Sin registros</Text>}
        renderItem={({ item }) => (
          <View style={styles.record}>
            <View style={[styles.recordIcon, { backgroundColor: item.type === 'income' ? '#d4edda' : '#fde8e8' }]}>
              <Ionicons
                name={item.type === 'income' ? 'trending-up' : 'trending-down'}
                size={20}
                color={item.type === 'income' ? COLORS.success : COLORS.danger}
              />
            </View>
            <View style={styles.recordInfo}>
              <Text style={styles.recordDesc} numberOfLines={1}>{item.description}</Text>
              <Text style={styles.recordMeta}>
                {item.category && `${item.category} · `}
                {FREQUENCIES.find((f) => f.value === item.frequency)?.label}
              </Text>
            </View>
            <View style={styles.recordRight}>
              <Text style={[styles.recordAmount, { color: item.type === 'income' ? COLORS.success : COLORS.danger }]}>
                {item.type === 'income' ? '+' : '-'}${parseFloat(item.amount).toLocaleString('es-AR')}
              </Text>
              <TouchableOpacity onPress={() => handleDelete(item.id)}>
                <Ionicons name="trash-outline" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowModal(true)}>
        <Ionicons name="add" size={28} color={COLORS.white} />
      </TouchableOpacity>

      {/* Modal nuevo registro */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nuevo registro</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.darkGray} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Tipo */}
              <View style={styles.typeToggle}>
                {['income', 'expense'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeBtn, form.type === t && (t === 'income' ? styles.typeBtnIncome : styles.typeBtnExpense)]}
                    onPress={() => set('type')(t)}
                  >
                    <Text style={[styles.typeBtnText, form.type === t && styles.typeBtnTextActive]}>
                      {t === 'income' ? 'Ingreso' : 'Gasto'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Input label="Descripción" value={form.description} onChangeText={set('description')} placeholder="Descripción del registro" />
              <Input label="Categoría (opcional)" value={form.category} onChangeText={set('category')} placeholder="Ej: Salarios, Equipamiento" />
              <Input label="Importe ($)" value={form.amount} onChangeText={set('amount')} keyboardType="decimal-pad" placeholder="0.00" />
              <Input label="Fecha inicio" value={form.startDate} onChangeText={set('startDate')} placeholder="YYYY-MM-DD" />

              {/* Frecuencia */}
              <Text style={styles.freqLabel}>Frecuencia</Text>
              <View style={styles.freqRow}>
                {FREQUENCIES.map((f) => (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.freqChip, form.frequency === f.value && styles.freqChipActive]}
                    onPress={() => set('frequency')(f.value)}
                  >
                    <Text style={[styles.freqText, form.frequency === f.value && styles.freqTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button title="Guardar" onPress={handleSave} loading={saving} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  summary: {
    flexDirection: 'row',
    backgroundColor: COLORS.primary,
    padding: 20,
    paddingTop: 16,
  },
  summaryCard: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  summaryLabel: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 4 },
  summaryAmount: { fontSize: 16, fontWeight: '800' },
  filters: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, backgroundColor: '#f0f0f0' },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.gray },
  filterTextActive: { color: COLORS.white, fontWeight: '600' },
  statsBtn: { marginLeft: 'auto', padding: 6 },
  list: { padding: 16, paddingBottom: 80 },
  empty: { textAlign: 'center', color: COLORS.gray, marginTop: 40 },
  record: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    elevation: 1,
  },
  recordIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  recordInfo: { flex: 1 },
  recordDesc: { fontSize: 14, fontWeight: '600', color: COLORS.darkGray },
  recordMeta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  recordRight: { alignItems: 'flex-end', gap: 4 },
  recordAmount: { fontSize: 14, fontWeight: '700' },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    elevation: 8,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.darkGray },
  typeToggle: { flexDirection: 'row', marginBottom: 16, borderRadius: 10, overflow: 'hidden', borderWidth: 1.5, borderColor: '#e0e0e0' },
  typeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#f8f9fa' },
  typeBtnIncome: { backgroundColor: COLORS.success },
  typeBtnExpense: { backgroundColor: COLORS.danger },
  typeBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.gray },
  typeBtnTextActive: { color: COLORS.white },
  freqLabel: { fontSize: 13, fontWeight: '600', color: COLORS.darkGray, marginBottom: 8 },
  freqRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  freqChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: '#f0f0f0', borderWidth: 1.5, borderColor: '#e0e0e0' },
  freqChipActive: { backgroundColor: COLORS.accentBlue, borderColor: COLORS.accentBlue },
  freqText: { fontSize: 13, color: COLORS.gray },
  freqTextActive: { color: COLORS.white, fontWeight: '600' },
});
