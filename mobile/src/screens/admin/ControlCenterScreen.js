import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getGuardsLocations, getPatrolSessions, getAdminVisits, getAssignments,
  getAlerts, getGuardAlerts,
} from '../../services/api';
import { getSocket } from '../../services/socket';
import StatCard from '../../components/StatCard';
import { COLORS } from '../../config/constants';

function timeAgo(d) {
  if (!d) return '';
  const mins = Math.max(0, Math.round((Date.now() - new Date(d).getTime()) / 60000));
  if (mins < 1) return 'recién';
  if (mins < 60) return `hace ${mins}m`;
  const hours = Math.floor(mins / 60);
  return `hace ${hours}h ${mins % 60}m`;
}

// Cualquier evento operativo relevante dispara un refresco (debounced, para
// no disparar 6 requests si llegan varios eventos juntos) en vez de fusionar
// cada uno a mano en 6 listas distintas — alcanza y sobra para una pantalla
// de "estado actual", que no necesita animaciones de entrada/salida por item.
const REFRESH_DEBOUNCE_MS = 800;
const SOCKET_EVENTS = [
  'guard_status_change',
  'patrol_started', 'patrol_ended',
  'visit_registered', 'visit_exited',
  'assignment_created', 'assignment_completed', 'assignment_cancelled',
  'emergency_alert', 'alert_resolved',
  'guard_alert', 'guard_alert_resolved',
];

/**
 * Centro de Control: consolida en una sola pantalla el estado operativo
 * actual — guardias en turno, rondas activas, visitas dentro del barrio,
 * tareas pendientes y alertas sin resolver. Todo sale de endpoints admin ya
 * existentes (nada de modelos ni endpoints de agregación nuevos); lo único
 * agregado en el backend fueron unos pocos emits de socket puramente
 * aditivos para que esta pantalla no dependa de polling.
 *
 * Sin filtro de barrio a propósito: 4 de las 5 categorías lo soportan, pero
 * las alertas de clientes no tienen neighborhoodId en el modelo Alert (ver
 * decisión histórica documentada ahí) — un filtro parcial que aplica a 4
 * secciones y no a la quinta generaría más confusión que claridad. Para un
 * recorte por barrio ya existen las pantallas específicas (el link "Ver
 * todas"/"Ver mapa" de cada sección).
 */
export default function ControlCenterScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [guards, setGuards] = useState([]);
  const [patrols, setPatrols] = useState([]);
  const [visits, setVisits] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [emergencyAlerts, setEmergencyAlerts] = useState([]);
  const [guardAlerts, setGuardAlerts] = useState([]);

  const debounceRef = useRef(null);

  useEffect(() => {
    load();
    const cleanup = setupSocket();
    return () => {
      cleanup?.();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleRefresh() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(load, REFRESH_DEBOUNCE_MS);
  }

  function setupSocket() {
    const socket = getSocket();
    if (!socket) return () => {};
    SOCKET_EVENTS.forEach((e) => socket.on(e, scheduleRefresh));
    return () => SOCKET_EVENTS.forEach((e) => socket.off(e, scheduleRefresh));
  }

  async function load() {
    try {
      const [g, p, v, a, ce, ga] = await Promise.all([
        getGuardsLocations(),
        getPatrolSessions({ status: 'in_progress', limit: 50 }),
        getAdminVisits({ active: 'true', limit: 50 }),
        getAssignments({ status: 'pending', limit: 50 }),
        getAlerts(),
        getGuardAlerts({ limit: 50 }),
      ]);
      setGuards(g.data);
      setPatrols(p.data.rows);
      setVisits(v.data.rows);
      setAssignments(a.data.rows);
      setEmergencyAlerts(ce.data.filter((x) => !x.isRead));
      setGuardAlerts(ga.data.rows.filter((x) => !x.isRead));
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={COLORS.accent} size="large" />
      </View>
    );
  }

  const totalUrgent = emergencyAlerts.length + guardAlerts.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />}
    >
      {/* ── Lo más urgente, arriba de todo ── */}
      {totalUrgent > 0 && (
        <TouchableOpacity
          style={styles.urgentBanner}
          onPress={() => navigation.navigate('AdminAlerts')}
          activeOpacity={0.85}
        >
          <Ionicons name="warning" size={20} color={COLORS.white} />
          <Text style={styles.urgentBannerText}>
            {totalUrgent} situaci{totalUrgent > 1 ? 'ones' : 'ón'} sin resolver
          </Text>
          <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
        </TouchableOpacity>
      )}

      {/* ── Resumen numérico ── */}
      <View style={styles.statsGrid}>
        <StatCard icon="shield-checkmark" label="En turno" value={guards.length} />
        <StatCard icon="walk" label="Rondas activas" value={patrols.length} />
        <StatCard icon="people" label="Visitas dentro" value={visits.length} />
        <StatCard icon="clipboard" label="Tareas pendientes" value={assignments.length} />
      </View>

      {/* ── Guardias en turno ── */}
      <Section
        title="Guardias en turno"
        linkLabel="Ver mapa"
        onLink={() => navigation.navigate('AdminMap')}
        emptyText="No hay guardias en turno"
        items={guards}
        renderItem={(g) => (
          <View key={g.id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
            <Text style={styles.rowTitle}>{g.firstName} {g.lastName}</Text>
            <Text style={styles.rowMeta}>{g.neighborhood?.name}</Text>
          </View>
        )}
      />

      {/* ── Rondas activas ── */}
      <Section
        title="Rondas activas"
        linkLabel="Ver todas"
        onLink={() => navigation.navigate('PatrolSessions')}
        emptyText="No hay rondas en curso"
        items={patrols}
        renderItem={(p) => (
          <TouchableOpacity
            key={p.id}
            style={styles.row}
            onPress={() => navigation.navigate('PatrolSessionDetail', { patrolSessionId: p.id })}
          >
            <View style={[styles.dot, { backgroundColor: COLORS.info }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{p.staff ? `${p.staff.firstName} ${p.staff.lastName}` : 'Guardia'}</Text>
              <Text style={styles.rowSub}>
                {p.route?.name}{p.route?.neighborhood?.name ? ` · ${p.route.neighborhood.name}` : ''}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{timeAgo(p.startedAt)}</Text>
          </TouchableOpacity>
        )}
      />

      {/* ── Visitas dentro del barrio ── */}
      <Section
        title="Visitas dentro del barrio"
        linkLabel="Ver todas"
        onLink={() => navigation.navigate('AdminVisits')}
        emptyText="No hay visitantes dentro"
        items={visits}
        renderItem={(v) => (
          <View key={v.id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: COLORS.success }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{v.visitorName}</Text>
              <Text style={styles.rowSub}>
                {v.destinationClient ? `${v.destinationClient.firstName} ${v.destinationClient.lastName}` : v.destinationDescription}
                {v.neighborhood?.name ? ` · ${v.neighborhood.name}` : ''}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{timeAgo(v.entryAt)}</Text>
          </View>
        )}
      />

      {/* ── Tareas pendientes ── */}
      <Section
        title="Tareas pendientes"
        linkLabel="Ver todas"
        onLink={() => navigation.navigate('Assignments')}
        emptyText="No hay tareas pendientes"
        items={assignments}
        last
        renderItem={(a) => (
          <View key={a.id} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: COLORS.warning }]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{a.title}</Text>
              <Text style={styles.rowSub}>
                {a.staff ? `${a.staff.firstName} ${a.staff.lastName}` : 'Guardia'}
                {a.neighborhood?.name ? ` · ${a.neighborhood.name}` : ''}
              </Text>
            </View>
            <Text style={styles.rowMeta}>{timeAgo(a.createdAt)}</Text>
          </View>
        )}
      />
    </ScrollView>
  );
}

function Section({ title, linkLabel, onLink, emptyText, items, renderItem, last }) {
  return (
    <View style={[styles.section, last && { paddingBottom: 40 }]}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={onLink}>
          <Text style={styles.linkText}>{linkLabel}</Text>
        </TouchableOpacity>
      </View>
      {items.length === 0 ? (
        <View style={styles.emptyRow}>
          <Ionicons name="checkmark-circle-outline" size={18} color="rgba(255,255,255,0.25)" />
          <Text style={styles.emptyRowText}>{emptyText}</Text>
        </View>
      ) : (
        items.map(renderItem)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.primaryDark },
  content: { padding: 16, paddingBottom: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primaryDark },

  urgentBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.danger,
    borderRadius: 12, padding: 14, marginBottom: 16,
  },
  urgentBannerText: { flex: 1, fontWeight: '700', color: COLORS.white, fontSize: 14 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },

  section: { marginTop: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  linkText: { fontSize: 12, fontWeight: '700', color: COLORS.accent },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  rowTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  rowSub:   { fontSize: 11, color: COLORS.accent, fontWeight: '600', marginTop: 2 },
  rowMeta:  { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 'auto' },

  emptyRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  emptyRowText: { fontSize: 13, color: 'rgba(255,255,255,0.35)' },
});
