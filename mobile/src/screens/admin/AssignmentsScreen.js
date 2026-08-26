import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
  ScrollView, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getAssignments, createAssignment, cancelAssignment, getSecurityStaff,
} from '../../services/api';
import { getSocket } from '../../services/socket';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { COLORS } from '../../config/constants';

const STATUS_LABEL = { pending: 'Pendiente', completed: 'Completada', cancelled: 'Cancelada' };
const STATUS_COLOR = { pending: COLORS.info, completed: COLORS.success, cancelled: COLORS.danger };

function formatDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Tareas puntuales asignadas por el admin a un guardia específico
 * (distinto de "Alertas", que son notificaciones sin estado de
 * cumplimiento). Mismo patrón que AdminVisitsScreen: filtros por chips +
 * FAB para crear + cancelar pendientes.
 */
export default function AssignmentsScreen() {
  const [assignments, setAssignments] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const PAGE = 20;

  const [guards, setGuards] = useState([]);
  const [selectedGuardId, setSelectedGuardId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [formGuardId, setFormGuardId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadGuards(); }, []);
  useEffect(() => { load(0, true); }, [selectedGuardId, selectedStatus]);

  // Actualiza en vivo cuando el guardia completa/se cancela una asignación
  // (mismo patrón que AdminAlertsScreen con guard_alert_resolved).
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('assignment_completed', ({ id, completedAt }) => {
      setAssignments((prev) =>
        prev.map((a) => a.id === id ? { ...a, status: 'completed', completedAt } : a)
      );
    });

    // Si otro admin crea/cancela una asignación mientras esta pantalla está
    // abierta (ahora que assignmentController emite también a role:admin).
    socket.on('assignment_created', (a) => {
      setAssignments((prev) => [a, ...prev]);
    });
    socket.on('assignment_cancelled', ({ id }) => {
      setAssignments((prev) => prev.map((a) => a.id === id ? { ...a, status: 'cancelled' } : a));
    });

    return () => {
      socket.off('assignment_completed');
      socket.off('assignment_created');
      socket.off('assignment_cancelled');
    };
  }, []);

  async function loadGuards() {
    try {
      const { data } = await getSecurityStaff();
      setGuards(data);
    } catch {}
  }

  function buildParams(offset) {
    const params = { limit: PAGE, offset };
    if (selectedGuardId) params.securityStaffId = selectedGuardId;
    if (selectedStatus) params.status = selectedStatus;
    return params;
  }

  async function load(offset = 0, reset = false) {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await getAssignments(buildParams(offset));
      if (reset) setAssignments(data.rows);
      else setAssignments((p) => [...p, ...data.rows]);
      setTotal(data.count);
      setPage(offset / PAGE);
    } catch {} finally { setLoading(false); setRefreshing(false); }
  }

  function onRefresh() { setRefreshing(true); load(0, true); }

  function openNew() {
    setFormGuardId(guards[0]?.id || null);
    setFormTitle('');
    setFormDescription('');
    setShowModal(true);
  }

  async function handleSave() {
    if (!formGuardId) return Alert.alert('Error', 'Elegí un guardia');
    if (!formTitle.trim()) return Alert.alert('Error', 'El título es obligatorio');

    setSaving(true);
    try {
      await createAssignment({
        securityStaffId: formGuardId,
        title: formTitle.trim(),
        description: formDescription.trim() || undefined,
      });
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo crear la asignación');
      setSaving(false);
      return;
    }
    setSaving(false);
    setShowModal(false);
    load(0, true);
  }

  function confirmCancel(item) {
    Alert.alert(
      'Cancelar asignación',
      `¿Cancelar "${item.title}"?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Sí, cancelar', style: 'destructive', onPress: () => handleCancel(item.id) },
      ]
    );
  }

  async function handleCancel(id) {
    try {
      await cancelAssignment(id);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo cancelar');
      return;
    }
    load(0, true);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Asignaciones</Text>
        <Text style={styles.headerCount}>{total} asignación{total === 1 ? '' : 'es'}</Text>
      </View>

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {[
          { value: null, label: 'Todas' },
          { value: 'pending', label: 'Pendientes' },
          { value: 'completed', label: 'Completadas' },
          { value: 'cancelled', label: 'Canceladas' },
        ].map((s) => {
          const active = selectedStatus === s.value;
          return (
            <TouchableOpacity
              key={String(s.value)}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setSelectedStatus(s.value)}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={assignments}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
        onEndReached={() => { if ((page + 1) * PAGE < total) load((page + 1) * PAGE); }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<Text style={styles.empty}>No hay asignaciones con estos filtros</Text>}
        renderItem={({ item }) => (
          <View style={styles.record}>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.status] }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{item.title}</Text>
              {!!item.description && <Text style={styles.description}>{item.description}</Text>}
              <Text style={styles.meta}>
                {item.staff ? `${item.staff.firstName} ${item.staff.lastName}` : 'Guardia'}
                {item.neighborhood?.name ? ` · ${item.neighborhood.name}` : ''}
              </Text>
              <Text style={styles.time}>Creada: {formatDate(item.createdAt)}</Text>
              {item.status === 'completed' && item.completedAt && (
                <Text style={styles.time}>Completada: {formatDate(item.completedAt)}</Text>
              )}
            </View>
            <View style={styles.rightCol}>
              <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] + '22' }]}>
                <Text style={[styles.statusBadgeText, { color: STATUS_COLOR[item.status] }]}>
                  {STATUS_LABEL[item.status]}
                </Text>
              </View>
              {item.status === 'pending' && (
                <TouchableOpacity onPress={() => confirmCancel(item)} style={{ marginTop: 8 }}>
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.danger} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva asignación</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Guardia *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRowModal}>
              {guards.map((g) => {
                const active = formGuardId === g.id;
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => setFormGuardId(g.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{g.firstName} {g.lastName}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Input dark label="Título *" value={formTitle} onChangeText={setFormTitle} placeholder="Ej: Revisar portón trasero" icon="clipboard-outline" />
            <Input dark label="Descripción" value={formDescription} onChangeText={setFormDescription} placeholder="Detalle adicional (opcional)" icon="document-text-outline" multiline />

            <Button title="Crear asignación" onPress={handleSave} loading={saving} style={{ marginTop: 14 }} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: COLORS.primaryDark },
  header:      { backgroundColor: COLORS.primary, padding: 20 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white },
  headerCount: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 2 },

  chipRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  chipRowModal: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 6, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },

  list:  { padding: 16, gap: 8, paddingBottom: 30 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40 },
  record: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  title:       { fontSize: 14, fontWeight: '700', color: COLORS.white },
  description: { fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  meta:        { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 3 },
  time:        { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },

  rightCol: { alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },

  fieldLabel: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4,
  },
});
