import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import MapView, { Marker, Callout, Circle } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { getNeighborhoods, getGuardsLocations, getClientsLocations, getAlerts } from '../../services/api';
import { getSocket } from '../../services/socket';
import { COLORS } from '../../config/constants';

const DEFAULT_REGION = {
  latitude: -34.6037, longitude: -58.3816,
  latitudeDelta: 0.1,  longitudeDelta: 0.1,
};

export default function AdminMapScreen() {
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [selectedNeighborhood, setSelectedNeighborhood] = useState(null);
  const [guards,  setGuards]  = useState([]);
  const [clients, setClients] = useState([]);
  const [activeAlerts, setActiveAlerts] = useState([]); // alertas sin resolver con coords
  const [showNeighborhoods, setShowNeighborhoods] = useState(true);
  const [showGuards,  setShowGuards]  = useState(true);
  const [showClients, setShowClients] = useState(true);
  const [showAlerts,  setShowAlerts]  = useState(true);
  const mapRef = useRef(null);

  useEffect(() => { loadNeighborhoods(); }, []);

  useEffect(() => {
    loadLocations();
    const interval = setInterval(loadLocations, 10000);
    return () => clearInterval(interval);
  }, [selectedNeighborhood]);

  // Recargar alertas cada 15s y al montar
  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('guard_location_update', ({ guardId, latitude, longitude, neighborhoodId }) => {
      if (selectedNeighborhood && neighborhoodId !== selectedNeighborhood) return;
      setGuards((prev) =>
        prev.map((g) => g.id === guardId ? { ...g, lastLatitude: latitude, lastLongitude: longitude } : g)
      );
    });

    socket.on('client_location_update', ({ clientId, latitude, longitude }) => {
      setClients((prev) =>
        prev.map((c) => c.id === clientId ? { ...c, lastLatitude: latitude, lastLongitude: longitude } : c)
      );
    });

    // Nueva alerta de emergencia → agregar al mapa inmediatamente
    socket.on('emergency_alert', (alert) => {
      if (alert.clientLatitude && alert.clientLongitude) {
        setActiveAlerts((prev) => {
          const exists = prev.find((a) => a.id === alert.id);
          return exists ? prev : [alert, ...prev];
        });
      }
    });

    // Alerta resuelta → quitarla del mapa
    socket.on('alert_resolved', ({ id }) => {
      setActiveAlerts((prev) => prev.filter((a) => a.id !== id));
    });

    return () => {
      socket.off('guard_location_update');
      socket.off('client_location_update');
      socket.off('emergency_alert');
      socket.off('alert_resolved');
    };
  }, [selectedNeighborhood]);

  async function loadNeighborhoods() {
    try {
      const { data } = await getNeighborhoods();
      setNeighborhoods(data);
    } catch {}
  }

  async function loadLocations() {
    try {
      const [guardsRes, clientsRes] = await Promise.all([
        getGuardsLocations(selectedNeighborhood),
        getClientsLocations(selectedNeighborhood),
      ]);
      setGuards(guardsRes.data.filter((g) => g.lastLatitude && g.lastLongitude));
      setClients(clientsRes.data.filter((c) => c.lastLatitude && c.lastLongitude));
    } catch {}
  }

  async function loadAlerts() {
    try {
      const { data } = await getAlerts();
      setActiveAlerts(
        data.filter((a) => !a.isRead && a.clientLatitude && a.clientLongitude)
      );
    } catch {}
  }

  function handleSelectNeighborhood(id) {
    setSelectedNeighborhood(id);
    if (!mapRef.current) return;
    if (id === null) {
      mapRef.current.animateToRegion(getGeneralRegion(), 600);
    } else {
      const n = neighborhoods.find((x) => x.id === id);
      if (n?.latitude && n?.longitude) {
        mapRef.current.animateToRegion(
          { latitude: n.latitude, longitude: n.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600,
        );
      }
    }
  }

  function getGeneralRegion() {
    const withCoords = neighborhoods.filter((n) => n.latitude && n.longitude);
    if (!withCoords.length) return DEFAULT_REGION;
    if (withCoords.length === 1)
      return { latitude: withCoords[0].latitude, longitude: withCoords[0].longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
    const lats = withCoords.map((n) => n.latitude);
    const lngs = withCoords.map((n) => n.longitude);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    return {
      latitude:  (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta:  (maxLat - minLat) * 1.6 + 0.01,
      longitudeDelta: (maxLng - minLng) * 1.6 + 0.01,
    };
  }

  // IDs de clientes con alerta activa (para pin rojo)
  const alertClientIds = new Set(activeAlerts.map((a) => a.senderId).filter(Boolean));

  const neighborhoodsWithCoords = neighborhoods.filter((n) => n.latitude && n.longitude);

  const initialRegion = guards.length > 0
    ? { latitude: guards[0].lastLatitude, longitude: guards[0].lastLongitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : getGeneralRegion();

  const noContent = !neighborhoodsWithCoords.length && !guards.length && !clients.length && !activeAlerts.length;

  return (
    <View style={styles.container}>
      {/* ── Controles ── */}
      <View style={styles.controls}>
        {/* Filtro barrios */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipList}
        >
          {[{ id: null, name: 'Todos' }, ...neighborhoods].map((item) => {
            const active = selectedNeighborhood === item.id;
            return (
              <TouchableOpacity
                key={String(item.id)}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => handleSelectNeighborhood(item.id)}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Toggles capas */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.toggleList}
        >
          <Toggle
            icon="business"
            label={`Barrios (${neighborhoodsWithCoords.length})`}
            active={showNeighborhoods}
            color={COLORS.accent}
            textColor={COLORS.primary}
            onPress={() => setShowNeighborhoods((v) => !v)}
          />
          <Toggle
            icon="shield"
            label={`Guardias (${guards.length})`}
            active={showGuards}
            color={COLORS.info}
            textColor={COLORS.white}
            onPress={() => setShowGuards((v) => !v)}
          />
          <Toggle
            icon="person"
            label={`Clientes (${clients.length})`}
            active={showClients}
            color={COLORS.success}
            textColor={COLORS.white}
            onPress={() => setShowClients((v) => !v)}
          />
          <Toggle
            icon="warning"
            label={`Alertas (${activeAlerts.length})`}
            active={showAlerts}
            color={COLORS.danger}
            textColor={COLORS.white}
            onPress={() => setShowAlerts((v) => !v)}
            badge={activeAlerts.length > 0}
          />
        </ScrollView>
      </View>

      {/* ── Mapa ── */}
      <MapView ref={mapRef} style={styles.map} initialRegion={initialRegion}>

        {/* Barrios */}
        {showNeighborhoods && neighborhoodsWithCoords.map((n) => (
          <React.Fragment key={`n-${n.id}`}>
            <Circle
              center={{ latitude: n.latitude, longitude: n.longitude }}
              radius={400}
              fillColor="rgba(252,211,77,0.08)"
              strokeColor="rgba(252,211,77,0.35)"
              strokeWidth={1.5}
            />
            <Marker
              coordinate={{ latitude: n.latitude, longitude: n.longitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={styles.pinNeighborhood}>
                <Ionicons name="business" size={16} color={COLORS.primary} />
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{n.name}</Text>
                  {n.address ? <Text style={styles.calloutSub}>{n.address}</Text> : null}
                  <Text style={styles.calloutCoords}>
                    {n.latitude.toFixed(5)}, {n.longitude.toFixed(5)}
                  </Text>
                </View>
              </Callout>
            </Marker>
          </React.Fragment>
        ))}

        {/* Guardias */}
        {showGuards && guards.map((g) => (
          <Marker
            key={`g-${g.id}`}
            coordinate={{ latitude: g.lastLatitude, longitude: g.lastLongitude }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.pinGuard}>
              <Ionicons name="shield" size={15} color={COLORS.white} />
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutName}>{g.firstName} {g.lastName}</Text>
                <Text style={styles.calloutSub}>Guardia</Text>
                {g.lastLocationUpdate && (
                  <Text style={styles.calloutTime}>
                    {new Date(g.lastLocationUpdate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            </Callout>
          </Marker>
        ))}

        {/* Clientes — rojo si tiene alerta activa, verde si no */}
        {showClients && clients.map((c) => {
          const hasAlert = alertClientIds.has(c.id);
          return (
            <Marker
              key={`c-${c.id}`}
              coordinate={{ latitude: c.lastLatitude, longitude: c.lastLongitude }}
              anchor={{ x: 0.5, y: 0.5 }}
            >
              <View style={[styles.pinClient, hasAlert && styles.pinClientAlert]}>
                <Ionicons name="person" size={15} color={hasAlert ? COLORS.white : COLORS.primary} />
              </View>
              <Callout tooltip>
                <View style={styles.callout}>
                  <Text style={styles.calloutName}>{c.firstName} {c.lastName}</Text>
                  <Text style={[styles.calloutSub, hasAlert && { color: COLORS.danger }]}>
                    {hasAlert ? '🚨 Alerta activa' : 'Cliente'}
                  </Text>
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* Alertas de emergencia — pin rojo en la ubicación donde se envió */}
        {showAlerts && activeAlerts.map((a) => (
          <Marker
            key={`alert-${a.id}`}
            coordinate={{ latitude: a.clientLatitude, longitude: a.clientLongitude }}
            anchor={{ x: 0.5, y: 1 }}
          >
            <View style={styles.pinAlert}>
              <Ionicons name="warning" size={18} color={COLORS.white} />
            </View>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={[styles.calloutName, { color: COLORS.danger }]}>🚨 {a.title}</Text>
                <Text style={styles.calloutSub}>{a.message}</Text>
                <Text style={styles.calloutTime}>
                  {new Date(a.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {noContent && (
        <View style={styles.emptyOverlay}>
          <Ionicons name="map-outline" size={36} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>Sin ubicaciones activas</Text>
          <Text style={styles.emptyHint}>
            Agregá coordenadas a los barrios o esperá que clientes/guardias compartan ubicación
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Componente Toggle ─────────────────────────────────────────────────────
function Toggle({ icon, label, active, color, textColor, onPress, badge }) {
  return (
    <TouchableOpacity
      style={[styles.toggle, active && { backgroundColor: color, borderColor: color }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {badge && active && (
        <View style={styles.toggleBadge} />
      )}
      <Ionicons name={icon} size={13} color={active ? textColor : 'rgba(255,255,255,0.4)'} />
      <Text style={[styles.toggleText, active && { color: textColor }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// React necesita importarse para JSX en React Native (aunque no siempre visible)
import React from 'react';

const styles = StyleSheet.create({
  container: { flex: 1 },

  controls: {
    backgroundColor: COLORS.primary,
    paddingTop: 12, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.surfaceBorder,
  },
  chipList: { paddingHorizontal: 16, gap: 8, alignItems: 'center', paddingBottom: 2 },
  chip: {
    paddingHorizontal: 13, paddingVertical: 5, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  chipActive:     { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText:       { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  chipTextActive: { color: COLORS.primary },

  toggleList: { paddingHorizontal: 16, paddingTop: 10, gap: 8, alignItems: 'center' },
  toggle: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
    backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.surfaceBorder,
    position: 'relative',
  },
  toggleBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.danger,
  },
  toggleText: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },

  map: { flex: 1 },

  // Pins
  pinNeighborhood: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: COLORS.white,
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3,
  },
  pinGuard: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.info,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white, elevation: 4,
  },
  pinClient: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.success,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white, elevation: 4,
  },
  pinClientAlert: {
    backgroundColor: COLORS.danger,   // rojo si tiene alerta activa
  },
  pinAlert: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.danger,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: COLORS.white,
    elevation: 6, shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.5,
  },

  // Callout
  callout: {
    backgroundColor: COLORS.primary, borderRadius: 10, padding: 10, minWidth: 130,
    borderWidth: 1, borderColor: COLORS.surfaceBorder, elevation: 6,
  },
  calloutName:   { fontWeight: '700', fontSize: 13, color: COLORS.white },
  calloutSub:    { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  calloutCoords: { fontSize: 10, color: COLORS.accent, marginTop: 4 },
  calloutTime:   { fontSize: 11, color: COLORS.accent, marginTop: 4 },

  emptyOverlay: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 14,
    padding: 20, alignItems: 'center', gap: 6,
  },
  emptyText: { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  emptyHint: { fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 220 },
});
