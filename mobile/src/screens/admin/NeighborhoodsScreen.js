import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Alert, RefreshControl, Dimensions,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { getNeighborhoods, createNeighborhood, updateNeighborhood } from '../../services/api';
import Button from '../../components/Button';
import Input from '../../components/Input';
import { COLORS } from '../../config/constants';

const SCREEN_H = Dimensions.get('window').height;

// Coordenadas por defecto: Buenos Aires
const DEFAULT_REGION = {
  latitude: -34.6037,
  longitude: -58.3816,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export default function NeighborhoodsScreen() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ name: '', address: '', description: '', latitude: null, longitude: null });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const mapRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await getNeighborhoods();
      setNeighborhoods(data);
    } catch {} finally { setRefreshing(false); }
  }

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  function openEdit(n) {
    setEditingId(n.id);
    setForm({
      name: n.name,
      address: n.address || '',
      description: n.description || '',
      latitude: n.latitude || null,
      longitude: n.longitude || null,
    });
    setShowModal(true);
  }

  function openNew() {
    setEditingId(null);
    setForm({ name: '', address: '', description: '', latitude: null, longitude: null });
    setShowModal(true);
  }

  async function openMapPicker() {
    // Intentar centrar en la ubicación actual del dispositivo
    let region = DEFAULT_REGION;
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        region = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        };
      }
    } catch {}

    // Si ya tiene coordenadas, centrar en ellas
    if (form.latitude && form.longitude) {
      region = {
        latitude: form.latitude,
        longitude: form.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };
    }

    setMapRegion(region);
    setShowMapPicker(true);
  }

  function handleMapPress(e) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setForm((p) => ({ ...p, latitude, longitude }));
  }

  function confirmMapLocation() {
    if (!form.latitude || !form.longitude) {
      Alert.alert('Sin ubicación', 'Tocá el mapa para marcar la ubicación del barrio');
      return;
    }
    setShowMapPicker(false);
  }

  async function handleSave() {
    if (!form.name.trim()) return Alert.alert('Error', 'El nombre es obligatorio');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        address: form.address.trim(),
        description: form.description.trim(),
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
      };
      if (editingId) {
        await updateNeighborhood(editingId, payload);
      } else {
        await createNeighborhood(payload);
      }
      setShowModal(false);
      load();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  }

  const hasCoords = form.latitude && form.longitude;

  return (
    <View style={styles.container}>
      <FlatList
        data={neighborhoods}
        keyExtractor={(i) => String(i.id)}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.accent}
          />
        }
        ListEmptyComponent={<Text style={styles.empty}>No hay barrios registrados</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardIcon}>
              <Ionicons name="business" size={22} color={COLORS.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardName}>{item.name}</Text>
              {item.address ? <Text style={styles.cardAddress}>{item.address}</Text> : null}
              {item.latitude && item.longitude ? (
                <View style={styles.coordRow}>
                  <Ionicons name="location" size={11} color={COLORS.accent} />
                  <Text style={styles.coordText}>
                    {item.latitude.toFixed(5)}, {item.longitude.toFixed(5)}
                  </Text>
                </View>
              ) : (
                <View style={styles.coordRow}>
                  <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.2)" />
                  <Text style={styles.coordTextMissing}>Sin coordenadas</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => openEdit(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="create-outline" size={20} color={COLORS.accent} />
            </TouchableOpacity>
          </View>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={openNew} activeOpacity={0.85}>
        <Ionicons name="add" size={28} color={COLORS.primary} />
      </TouchableOpacity>

      {/* ── Modal formulario ── */}
      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingId ? 'Editar barrio' : 'Nuevo barrio'}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={COLORS.white} />
              </TouchableOpacity>
            </View>

            <Input dark label="Nombre *"    value={form.name}        onChangeText={set('name')}        placeholder="Nombre del barrio"   icon="business-outline" />
            <Input dark label="Dirección"   value={form.address}     onChangeText={set('address')}     placeholder="Dirección principal" icon="location-outline" />
            <Input dark label="Descripción" value={form.description} onChangeText={set('description')} placeholder="Info adicional"      icon="document-text-outline" multiline />

            {/* Selector de ubicación */}
            <Text style={styles.locationLabel}>Ubicación en el mapa</Text>
            <TouchableOpacity style={styles.mapPickerBtn} onPress={openMapPicker} activeOpacity={0.8}>
              {hasCoords ? (
                <View style={styles.mapPickerContent}>
                  <View style={styles.coordBadge}>
                    <Ionicons name="location" size={14} color={COLORS.accent} />
                    <Text style={styles.coordBadgeText}>
                      {form.latitude.toFixed(5)}, {form.longitude.toFixed(5)}
                    </Text>
                  </View>
                  <Text style={styles.mapPickerChange}>Cambiar</Text>
                </View>
              ) : (
                <View style={styles.mapPickerContent}>
                  <Ionicons name="map-outline" size={20} color="rgba(255,255,255,0.4)" />
                  <Text style={styles.mapPickerPlaceholder}>Tocar para marcar en el mapa</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.3)" />
            </TouchableOpacity>

            <Button
              title={editingId ? 'Guardar cambios' : 'Crear barrio'}
              onPress={handleSave}
              loading={saving}
              style={{ marginTop: 14 }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Modal selector de mapa ── */}
      <Modal visible={showMapPicker} animationType="slide">
        <View style={{ flex: 1, backgroundColor: COLORS.primary }}>
          {/* Header */}
          <View style={styles.mapHeader}>
            <TouchableOpacity onPress={() => setShowMapPicker(false)} style={styles.mapBackBtn}>
              <Ionicons name="arrow-back" size={22} color={COLORS.white} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.mapHeaderTitle}>Ubicar barrio</Text>
              <Text style={styles.mapHeaderSub}>Tocá en el mapa para marcar la ubicación</Text>
            </View>
            {hasCoords && (
              <TouchableOpacity style={styles.mapConfirmBtn} onPress={confirmMapLocation}>
                <Text style={styles.mapConfirmText}>Confirmar</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Mapa */}
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            initialRegion={mapRegion}
            onPress={handleMapPress}
            showsUserLocation
            showsMyLocationButton
          >
            {hasCoords && (
              <Marker
                coordinate={{ latitude: form.latitude, longitude: form.longitude }}
                draggable
                onDragEnd={handleMapPress}
                pinColor={COLORS.accent}
              >
                <View style={styles.mapMarker}>
                  <Ionicons name="business" size={18} color={COLORS.primary} />
                </View>
              </Marker>
            )}
          </MapView>

          {/* Footer con coordenadas */}
          <View style={styles.mapFooter}>
            {hasCoords ? (
              <>
                <Ionicons name="location" size={16} color={COLORS.accent} />
                <Text style={styles.mapFooterCoords}>
                  {form.latitude.toFixed(6)},  {form.longitude.toFixed(6)}
                </Text>
                <TouchableOpacity style={styles.mapConfirmBtnBottom} onPress={confirmMapLocation}>
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                  <Text style={styles.mapConfirmBottomText}>Confirmar ubicación</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="finger-print-outline" size={16} color="rgba(255,255,255,0.4)" />
                <Text style={styles.mapFooterHint}>Tocá en el mapa para marcar el barrio</Text>
              </>
            )}
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
  cardName:    { fontSize: 15, fontWeight: '700', color: COLORS.white },
  cardAddress: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },
  coordRow:    { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  coordText:       { fontSize: 11, color: COLORS.accent, fontWeight: '600' },
  coordTextMissing:{ fontSize: 11, color: 'rgba(255,255,255,0.2)' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    elevation: 8,
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },

  // Modal formulario
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: {
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 36,
    borderTopWidth: 1, borderColor: COLORS.surfaceBorder,
    maxHeight: SCREEN_H * 0.92,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.white },

  locationLabel: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 4,
  },
  mapPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  mapPickerContent:    { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  mapPickerPlaceholder:{ fontSize: 14, color: 'rgba(255,255,255,0.35)' },
  mapPickerChange:     { fontSize: 12, color: COLORS.accent, fontWeight: '600' },
  coordBadge:          { flexDirection: 'row', alignItems: 'center', gap: 6 },
  coordBadgeText:      { fontSize: 13, color: COLORS.accent, fontWeight: '700' },

  // Modal mapa
  mapHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBorder,
  },
  mapBackBtn:      { padding: 4 },
  mapHeaderTitle:  { fontSize: 16, fontWeight: '800', color: COLORS.white },
  mapHeaderSub:    { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  mapConfirmBtn: {
    backgroundColor: COLORS.accent, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7,
  },
  mapConfirmText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  mapMarker: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: COLORS.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 5, elevation: 6,
  },

  mapFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.primary, padding: 16,
    borderTopWidth: 1, borderTopColor: COLORS.surfaceBorder,
    flexWrap: 'wrap',
  },
  mapFooterCoords:  { flex: 1, fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  mapFooterHint:    { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.4)' },
  mapConfirmBtnBottom: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.accent, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 9,
  },
  mapConfirmBottomText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
