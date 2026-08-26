import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../../config/constants';
import {
  getPatrolRoutes, startPatrol, getActivePatrol,
  registerCheckpointVisit, endPatrol,
} from '../../services/api';
import Button from '../../components/Button';

/**
 * Selección, inicio y seguimiento de una ronda para el guardia.
 *
 * Dos estados:
 *  - Sin ronda activa: lista de PatrolRoute disponibles en su barrio,
 *    selección y botón "Iniciar ronda" (POST /security/patrol/start).
 *  - Con ronda activa: estado de la ronda en curso (GET /security/patrol/active).
 *    Cada checkpoint pendiente se puede tocar para intentar registrarlo
 *    (POST /security/patrol/checkpoint) — el resultado (incluida la
 *    validación GPS del backend) se muestra tal cual viene del servidor.
 *    Sin mapa todavía (fuera de alcance de esta etapa).
 */
export default function PatrolScreen({ navigation }) {
  const isFocused = useIsFocused();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [activePatrol, setActivePatrol] = useState(null); // respuesta completa de GET /patrol/active si active:true
  const [routes, setRoutes] = useState([]);
  const [neighborhoodAssigned, setNeighborhoodAssigned] = useState(true); // false = el guardia todavía no tiene barrio asignado
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [starting, setStarting] = useState(false);

  // Checkpoint que se está intentando registrar ahora mismo (id o null) y
  // finalización de ronda en curso — controlan los loading states puntuales
  // sin bloquear el resto de la pantalla.
  const [registeringCheckpointId, setRegisteringCheckpointId] = useState(null);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (isFocused) loadData();
  }, [isFocused]);

  // Consulta real al backend y decide qué mostrar — usada tanto en la carga
  // inicial como después de registrar un checkpoint o finalizar la ronda,
  // para no armar nunca el estado a mano en el cliente.
  async function fetchStatus() {
    const { data } = await getActivePatrol();
    if (data.active) {
      setActivePatrol(data);
    } else {
      setActivePatrol(null);
      await loadRoutes();
    }
  }

  async function loadData() {
    setError('');
    try {
      await fetchStatus();
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo consultar el estado de la ronda');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadRoutes() {
    try {
      const { data } = await getPatrolRoutes();
      setNeighborhoodAssigned(data.neighborhoodAssigned);
      setRoutes(data.routes);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron cargar las rutas de ronda');
    }
  }

  async function handleStart() {
    if (!selectedRouteId) {
      Alert.alert('Seleccioná una ruta', 'Elegí una ruta de ronda antes de iniciar.');
      return;
    }
    setStarting(true);
    try {
      await startPatrol(selectedRouteId);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo iniciar la ronda');
      setStarting(false);
      return;
    }
    // La ronda ya se inició en el backend en este punto — si esta consulta
    // falla (ej. corte de red), no se debe mostrar como si iniciar hubiese
    // fallado: se deja la pantalla como está, el usuario puede refrescar.
    try {
      const { data } = await getActivePatrol();
      if (data.active) setActivePatrol(data);
    } catch {}
    setStarting(false);
  }

  // El backend valida ronda activa, pertenencia del checkpoint a la ruta,
  // no-repetición y radio GPS — acá solo se muestra tal cual el mensaje que
  // devuelve (éxito o rechazo), sin duplicar ninguna de esas reglas.
  async function handleRegisterCheckpoint(checkpointId) {
    setRegisteringCheckpointId(checkpointId);
    let data;
    try {
      ({ data } = await registerCheckpointVisit(checkpointId));
    } catch (err) {
      Alert.alert('No se pudo registrar', err.response?.data?.error || 'No se pudo registrar el checkpoint');
      setRegisteringCheckpointId(null);
      return;
    }
    Alert.alert('Checkpoint registrado', data.message || 'Checkpoint registrado correctamente.');
    // El checkpoint ya quedó registrado en el backend — si el refresco de
    // estado falla, no corresponde mostrarlo como un error de registro.
    try {
      await fetchStatus();
    } catch {}
    setRegisteringCheckpointId(null);
  }

  function handleEndPatrol() {
    Alert.alert(
      'Finalizar ronda',
      '¿Confirmás que terminaste el recorrido?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Finalizar', style: 'destructive', onPress: doEndPatrol },
      ]
    );
  }

  async function doEndPatrol() {
    setEnding(true);
    try {
      await endPatrol();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo finalizar la ronda');
      setEnding(false);
      return;
    }
    // La ronda ya quedó finalizada en el backend — un fallo acá es solo de
    // refresco, no de la finalización en sí.
    try {
      await fetchStatus();
    } catch {}
    setEnding(false);
  }

  function onRefresh() {
    setRefreshing(true);
    loadData();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  // ── Ronda activa: estado + registro de checkpoints, sin mapa todavía ──
  if (activePatrol) {
    const { session, route, checkpoints } = activePatrol;
    const visitedCount = checkpoints.filter((c) => c.visited).length;

    return (
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
      >
        <View style={styles.activeBanner}>
          <Ionicons name="walk" size={22} color={COLORS.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Ronda en curso</Text>
            <Text style={styles.activeBannerSub}>
              Iniciada a las {new Date(session.startedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ruta</Text>
          <View style={styles.routeCard}>
            <Text style={styles.routeName}>{route.name}</Text>
            {!!route.neighborhood?.name && (
              <View style={styles.routeNeighborhoodRow}>
                <Ionicons name="location-outline" size={13} color={COLORS.accent} />
                <Text style={styles.routeNeighborhoodText}>{route.neighborhood.name}</Text>
              </View>
            )}
            {!!route.description && <Text style={styles.routeDesc}>{route.description}</Text>}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Checkpoints</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{visitedCount}/{checkpoints.length}</Text>
            </View>
          </View>

          {checkpoints.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Esta ruta no tiene checkpoints cargados</Text>
            </View>
          ) : (
            checkpoints.map((cp) => {
              const isRegistering = registeringCheckpointId === cp.id;
              const disabled = cp.visited || isRegistering || registeringCheckpointId !== null;

              return (
                <TouchableOpacity
                  key={cp.id}
                  style={styles.checkpointRow}
                  activeOpacity={cp.visited ? 1 : 0.7}
                  disabled={disabled}
                  onPress={() => handleRegisterCheckpoint(cp.id)}
                >
                  {isRegistering ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <Ionicons
                      name={cp.visited ? 'checkmark-circle' : 'ellipse-outline'}
                      size={20}
                      color={cp.visited ? COLORS.success : 'rgba(255,255,255,0.3)'}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.checkpointName}>{cp.name}</Text>
                    {cp.visited && !!cp.visitedAt ? (
                      <Text style={styles.checkpointTime}>
                        Visitado {new Date(cp.visitedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    ) : (
                      <Text style={styles.checkpointHint}>
                        {isRegistering ? 'Registrando...' : 'Tocá para registrar'}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        <Button
          title="Finalizar ronda"
          variant="danger"
          onPress={handleEndPatrol}
          loading={ending}
          disabled={registeringCheckpointId !== null}
          style={{ marginTop: 4 }}
        />
      </ScrollView>
    );
  }

  // ── Sin ronda activa: selección e inicio ──
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      <View style={styles.titleRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Iniciar ronda</Text>
          <Text style={styles.subtitle}>Elegí una ruta para empezar tu recorrido</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('PatrolHistory')}>
          <Text style={styles.historyLink}>Historial</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {!neighborhoodAssigned ? (
        <View style={styles.emptyCard}>
          <Ionicons name="alert-circle-outline" size={32} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>
            Todavía no fuiste asignado a un barrio. Un administrador tiene que asignarte antes de que puedas iniciar una ronda.
          </Text>
        </View>
      ) : routes.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="map-outline" size={32} color="rgba(255,255,255,0.3)" />
          <Text style={styles.emptyText}>No hay rutas de ronda disponibles para tu barrio</Text>
        </View>
      ) : (
        routes.map((r) => {
          const selected = r.id === selectedRouteId;
          return (
            <TouchableOpacity
              key={r.id}
              style={[styles.routeOption, selected && styles.routeOptionSelected]}
              onPress={() => setSelectedRouteId(r.id)}
              activeOpacity={0.8}
            >
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected && <View style={styles.radioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeOptionName}>{r.name}</Text>
                {!!r.neighborhood?.name && (
                  <Text style={styles.routeOptionNeighborhood}>{r.neighborhood.name}</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })
      )}

      <Button
        title="Iniciar ronda"
        onPress={handleStart}
        loading={starting}
        disabled={!neighborhoodAssigned || !selectedRouteId || routes.length === 0}
        style={{ marginTop: 20 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryDark },

  titleRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, marginBottom: 20 },
  historyLink: { fontSize: 13, fontWeight: '700', color: COLORS.accent, marginTop: 4 },
  errorText: { fontSize: 13, color: COLORS.danger, marginBottom: 14 },

  // Selección de ruta
  routeOption: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
    marginBottom: 10,
  },
  routeOptionSelected: { borderColor: COLORS.accent },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.surfaceBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  radioSelected: { borderColor: COLORS.accent },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent },
  routeOptionName: { fontSize: 15, fontWeight: '700', color: COLORS.white },
  routeOptionNeighborhood: { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  emptyCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 24,
    alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  emptyText: { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' },

  // Ronda activa
  activeBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.accent, borderRadius: 14, padding: 16,
    marginBottom: 20,
  },
  activeBannerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.primary },
  activeBannerSub: { fontSize: 12, color: 'rgba(0,0,0,0.6)', marginTop: 2 },

  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  countBadge: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  routeCard: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  routeName: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  routeNeighborhoodRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  routeNeighborhoodText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  routeDesc: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, lineHeight: 18 },

  checkpointRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  checkpointName: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  checkpointTime: { fontSize: 11, color: COLORS.success, marginTop: 2 },
  checkpointHint: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
});
