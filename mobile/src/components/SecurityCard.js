import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, UPLOADS_URL } from '../config/constants';

export default function SecurityCard({
  staff,
  onPress,
  onEdit,
  onHistory,
  onDeactivate,
  onAssignOperator,
}) {
  const fullName  = `${staff.firstName} ${staff.lastName}`;
  const isOnDuty  = staff.isOnDuty;
  const hasActions = onEdit || onHistory || onDeactivate || onAssignOperator;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      {/* ── Fila principal: foto + info + badge ── */}
      <View style={styles.row}>
        {/* Foto */}
        <View style={styles.photoWrap}>
          {staff.profilePhoto ? (
            <Image
              source={{ uri: `${UPLOADS_URL}/${staff.profilePhoto}` }}
              style={styles.photo}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="person" size={26} color={COLORS.accent} />
            </View>
          )}
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnDuty ? COLORS.success : COLORS.surfaceBorder },
            ]}
          />
        </View>

        {/* Info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
            {staff.isOperator && (
              <View style={styles.operatorBadge}>
                <Ionicons name="headset" size={10} color={COLORS.primary} />
                <Text style={styles.operatorBadgeText}>OPERADOR</Text>
              </View>
            )}
          </View>
          <Text style={styles.doc}>DNI: {staff.documentNumber}</Text>
          {staff.contact ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={11} color="rgba(255,255,255,0.4)" />
              <Text style={styles.metaText}>{staff.contact}</Text>
            </View>
          ) : null}
          <View style={styles.metaRow}>
            <Ionicons
              name={staff.faceDescriptor ? 'scan-circle' : 'scan-circle-outline'}
              size={11}
              color={staff.faceDescriptor ? COLORS.success : 'rgba(255,255,255,0.3)'}
            />
            <Text style={[styles.metaText, { color: staff.faceDescriptor ? COLORS.success : 'rgba(255,255,255,0.3)' }]}>
              {staff.faceDescriptor ? 'Facial listo' : 'Procesando facial...'}
            </Text>
          </View>
          {staff.neighborhood && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.4)" />
              <Text style={styles.metaText}>{staff.neighborhood.name}</Text>
            </View>
          )}
          {staff.shiftStart ? (
            <View style={styles.shiftBadge}>
              <Ionicons name="time-outline" size={11} color={COLORS.primary} />
              <Text style={styles.shiftText}>
                {staff.shiftStart} – {staff.shiftEnd || '?'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Estado: top-right */}
        <View style={[styles.badge, isOnDuty ? styles.badgeOn : styles.badgeOff]}>
          <View style={[styles.badgeDot, { backgroundColor: isOnDuty ? COLORS.success : COLORS.surfaceBorder }]} />
          <Text style={[styles.badgeText, { color: isOnDuty ? COLORS.success : 'rgba(255,255,255,0.35)' }]}>
            {isOnDuty ? 'Activo' : 'Inactivo'}
          </Text>
        </View>
      </View>

      {/* ── Acciones: dentro del card, bottom-right ── */}
      {hasActions && (
        <View style={styles.actionsRow}>
          {onAssignOperator && !staff.isOperator && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionOperator]} onPress={onAssignOperator}>
              <Ionicons name="headset-outline" size={14} color={COLORS.accent} />
              <Text style={[styles.actionText, { color: COLORS.accent }]}>Operador</Text>
            </TouchableOpacity>
          )}
          {onEdit && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionEdit]} onPress={onEdit}>
              <Ionicons name="create-outline" size={14} color={COLORS.info} />
              <Text style={[styles.actionText, { color: COLORS.info }]}>Editar</Text>
            </TouchableOpacity>
          )}
          {onHistory && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionHistory]} onPress={onHistory}>
              <Ionicons name="time-outline" size={14} color={COLORS.success} />
              <Text style={[styles.actionText, { color: COLORS.success }]}>Historial</Text>
            </TouchableOpacity>
          )}
          {onDeactivate && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionDelete]} onPress={onDeactivate}>
              <Ionicons name="person-remove-outline" size={14} color={COLORS.danger} />
              <Text style={[styles.actionText, { color: COLORS.danger }]}>Baja</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
  },

  row: { flexDirection: 'row', alignItems: 'flex-start' },

  // Foto
  photoWrap: { position: 'relative', marginRight: 12 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  photoPlaceholder: {
    backgroundColor: 'rgba(252,211,77,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  statusDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: COLORS.surface,
  },

  // Info
  info:     { flex: 1, gap: 3 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  name:     { fontSize: 15, fontWeight: '700', color: COLORS.white },
  doc:      { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },
  shiftBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.accent, borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
    alignSelf: 'flex-start', marginTop: 3,
  },
  shiftText: { fontSize: 11, color: COLORS.primary, fontWeight: '700' },

  operatorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: COLORS.accent, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  operatorBadgeText: { fontSize: 9, fontWeight: '900', color: COLORS.primary, letterSpacing: 0.5 },

  // Badge estado
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 20, alignSelf: 'flex-start',
  },
  badgeOn:  { backgroundColor: 'rgba(34,197,94,0.12)' },
  badgeOff: { backgroundColor: 'rgba(255,255,255,0.05)' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },

  // Acciones
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfaceBorder,
    flexWrap: 'wrap',
  },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8,
  },
  actionOperator: { backgroundColor: 'rgba(252,211,77,0.12)' },
  actionEdit:     { backgroundColor: 'rgba(59,130,246,0.12)' },
  actionHistory:  { backgroundColor: 'rgba(34,197,94,0.12)' },
  actionDelete:   { backgroundColor: 'rgba(239,68,68,0.12)' },
  actionText: { fontSize: 12, fontWeight: '600' },
});
