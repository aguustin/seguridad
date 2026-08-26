import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';

const STATUS_LABEL = {
  in_progress: 'En curso',
  completed: 'Completada',
  cancelled: 'Cancelada',
};
const STATUS_COLOR = {
  in_progress: COLORS.info,
  completed: COLORS.success,
  cancelled: COLORS.danger,
};

function formatDateTime(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Detalle de una PatrolSession (activa o del historial): ruta, barrio,
 * inicio/fin/estado, y checkpoints con su estado de visita.
 *
 * De solo lectura — no registra checkpoints ni finaliza rondas (eso es
 * responsabilidad de PatrolScreen para la ronda EN CURSO del propio
 * guardia). Se usa tanto desde el historial del guardia como desde la
 * vista administrativa, recibiendo siempre la misma forma de datos
 * (ver backend/src/services/patrolService.js → serializeSession).
 */
export default function PatrolSessionDetailView({ data, showStaff = false }) {
  const { session, route, staff, checkpoints } = data;
  const visitedCount = checkpoints.filter((c) => c.visited).length;
  const statusLabel = STATUS_LABEL[session.status] || session.status;
  const statusColor = STATUS_COLOR[session.status] || COLORS.accent;

  return (
    <View>
      <View style={[styles.statusBanner, { backgroundColor: statusColor }]}>
        <Ionicons name="walk" size={20} color={COLORS.white} />
        <Text style={styles.statusBannerText}>{statusLabel}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Ruta</Text>
        <View style={styles.card}>
          <Text style={styles.routeName}>{route.name}</Text>
          {!!route.neighborhood?.name && (
            <View style={styles.rowGap}>
              <Ionicons name="location-outline" size={13} color={COLORS.accent} />
              <Text style={styles.mutedText}>{route.neighborhood.name}</Text>
            </View>
          )}
          {!!route.description && <Text style={styles.description}>{route.description}</Text>}
          {showStaff && staff && (
            <View style={[styles.rowGap, { marginTop: 6 }]}>
              <Ionicons name="person-outline" size={13} color="rgba(255,255,255,0.45)" />
              <Text style={styles.mutedText}>{staff.firstName} {staff.lastName}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Horario</Text>
        <View style={styles.card}>
          <View style={styles.timeRow}>
            <Ionicons name="play-outline" size={16} color={COLORS.success} />
            <Text style={styles.timeLabel}>Inicio</Text>
            <Text style={styles.timeValue}>{formatDateTime(session.startedAt)}</Text>
          </View>
          <View style={styles.timeRow}>
            <Ionicons name="stop-outline" size={16} color={session.endedAt ? COLORS.danger : 'rgba(255,255,255,0.3)'} />
            <Text style={styles.timeLabel}>Fin</Text>
            <Text style={styles.timeValue}>{session.endedAt ? formatDateTime(session.endedAt) : '—'}</Text>
          </View>
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
          <View style={styles.card}>
            <Text style={styles.mutedText}>Esta ruta no tiene checkpoints cargados</Text>
          </View>
        ) : (
          checkpoints.map((cp) => (
            <View key={cp.id} style={styles.checkpointRow}>
              <Ionicons
                name={cp.visited ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={cp.visited ? COLORS.success : 'rgba(255,255,255,0.3)'}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.checkpointName}>{cp.name}</Text>
                <Text style={cp.visited ? styles.checkpointVisited : styles.checkpointPending}>
                  {cp.visited && cp.visitedAt ? `Visitado ${formatDateTime(cp.visitedAt)}` : 'No visitado'}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, padding: 14, marginBottom: 20,
  },
  statusBannerText: { fontSize: 14, fontWeight: '800', color: COLORS.white },

  section: { marginBottom: 22 },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  countBadge: { backgroundColor: COLORS.accent, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countText: { fontSize: 12, fontWeight: '800', color: COLORS.primary },

  card: {
    backgroundColor: COLORS.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  routeName: { fontSize: 16, fontWeight: '700', color: COLORS.white },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  mutedText: { fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  description: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 6, lineHeight: 18 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  timeLabel: { fontSize: 12, color: 'rgba(255,255,255,0.45)', width: 46 },
  timeValue: { fontSize: 13, color: COLORS.white, fontWeight: '600', marginLeft: 'auto' },

  checkpointRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  checkpointName: { fontSize: 14, fontWeight: '600', color: COLORS.white },
  checkpointVisited: { fontSize: 11, color: COLORS.success, marginTop: 2 },
  checkpointPending: { fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 },
});
