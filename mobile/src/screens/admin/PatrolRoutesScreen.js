import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, RefreshControl, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getPatrolAdminRoutes, createPatrolRoute, updatePatrolRoute, deactivatePatrolRoute,
  getNeighborhoods,
} from '../../services/api';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { COLORS } from '../../config/constants';

/**
 * Gestión de rutas de ronda (admin): crear/editar/desactivar. Cada ruta
 * navega a PatrolRouteCheckpoints para gestionar sus checkpoints.
 *
 * Mismo patrón de modal que NeighborhoodsScreen.js (lista + FAB + modal de
 * formulario), cambiando el selector de mapa por chips de barrio — una ruta
 * no tiene coordenadas propias, solo pertenece a un barrio.
 */
export default function PatrolRoutesScreen({ navigation }) {
  const [routes, setRoutes] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', neighborhoodId: null });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { load(); loadNeighborhoods(); }, []);

  async function load() {
    try {
      const { data } = await getPatrolAdminRoutes();
      setRoutes(data);
    } catch {} finally { setRefreshing(false); }
  }

  async function loadNeighborhoods() {
    try {
      const { data } = await getNeighborhoods();
      setNeighborhoods(data);
    } catch {}
  }

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  function openNew() {
    setEditingId(null);
    setForm({ name: '', description: '', neighborhoodId: neighborhoods[0]?.id || null });
    setShowModal(true);
  }

  function openEdit(route) {
    setEditingId(route.id);
    setForm({
      name: route.name,
      description: route.description || '',
      neighborhoodId: route.neighborhoodId,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return Alert.alert('Error', 'El nombre es obligatorio');
    if (!form.neighborhoodId) return Alert.alert('Error', 'Elegí un barrio para la ruta');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        neighborhoodId: form.neighborhoodId,
      };
      if (editingId) await updatePatrolRoute(editingId, payload);
      else await createPatrolRoute(payload);
      setShowModal(false);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDeactivate(route) {
    Alert.alert(
      'Desactivar ruta',
      `"${route.name}" ya no va a estar disponible para que los guardias inicien una ronda. ¿Continuar?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desactivar', style: 'destructive',
          onPress: async () => {
            try {
              await deactivatePatrolRoute(route.id);
              load();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || err.message);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={routes}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={<Text style={styles.empty}>No hay rutas de ronda registradas</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.75}
            onPress={() => navigation.navigate('PatrolRouteCheckpoints', { patrolRouteId: item.id, routeName: item.name })}
          >
            <View style={styles.cardIcon}>
              <Ionicons name="walk" size={22} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              {!!item.neighborhood?.name && (
                <View style={styles.rowGap}>
                  <Ionicons name="location-outline" size={11} color={COLORS.accent} />
                  <Text style={styles.cardSub}>{item.neighborhood.name}</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="create-outline" size={20} color={COLORS.accent} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDeactivate(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 14 }}>
              <Ionicons name="power-outline" size={20} color={COLORS.danger} />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Editar ruta' : 'Nueva ruta'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <Input dark label="Nombre *" value={form.name} onChangeText={set('name')} placeholder="Ej: Recorrido perimetral" icon="walk-outline" />
            <Input dark label="Descripción" value={form.description} onChangeText={set('description')} placeholder="Info adicional" icon="document-text-outline" multiline />

            <Text style={styles.fieldLabel}>Barrio *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {neighborhoods.map((n) => {
                const active = form.neighborhoodId === n.id;
                return (
                  <TouchableOpacity
                    key={n.id}
                    style={[styles.chip, active && styles.chipActive]}
                    onPress={() => set('neighborhoodId')(n.id)}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{n.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Button
              title={editingId ? 'Guardar cambios' : 'Crear ruta'}
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  list: { padding: 16, paddingBottom: 90, gap: 10 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 60, fontSize: 14 },

  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  cardIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(252,211,77,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  cardName: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  cardSub:  { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  rowGap:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },

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
  chipRow: { gap: 8, paddingBottom: 4 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 8, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },
});
