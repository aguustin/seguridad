import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, UPLOADS_URL } from '../config/constants';

/**
 * Tarjeta de cliente para la gestión administrativa — mismo patrón visual
 * que SecurityCard (foto + info + acciones dentro de la tarjeta), adaptado
 * a los campos que tiene Client (sin turno/salario/facial, que son propios
 * de un guardia).
 */
export default function ClientCard({ client, onPress, onEdit, onDeactivate }) {
  const fullName = `${client.firstName} ${client.lastName}`;
  const hasActions = onEdit || onDeactivate;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <View style={styles.row}>
        <View style={styles.photoWrap}>
          {client.profilePhoto ? (
            <Image
              source={{ uri: `${UPLOADS_URL}/${client.profilePhoto}` }}
              style={styles.photo}
            />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="person" size={26} color={COLORS.accent} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{fullName}</Text>
          <Text style={styles.username}>@{client.username}</Text>
          {client.contact ? (
            <View style={styles.metaRow}>
              <Ionicons name="call-outline" size={11} color="rgba(255,255,255,0.4)" />
              <Text style={styles.metaText}>{client.contact}</Text>
            </View>
          ) : null}
          {client.neighborhood && (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={11} color="rgba(255,255,255,0.4)" />
              <Text style={styles.metaText}>{client.neighborhood.name}</Text>
            </View>
          )}
        </View>
      </View>

      {hasActions && (
        <View style={styles.actionsRow}>
          {onEdit && (
            <TouchableOpacity style={[styles.actionBtn, styles.actionEdit]} onPress={onEdit}>
              <Ionicons name="create-outline" size={14} color={COLORS.info} />
              <Text style={[styles.actionText, { color: COLORS.info }]}>Editar</Text>
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

  photoWrap: { marginRight: 12 },
  photo: { width: 52, height: 52, borderRadius: 26 },
  photoPlaceholder: {
    backgroundColor: 'rgba(252,211,77,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },

  info:     { flex: 1, gap: 3 },
  name:     { fontSize: 15, fontWeight: '700', color: COLORS.white },
  username: { fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  metaRow:  { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 },
  metaText: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

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
  actionEdit:   { backgroundColor: 'rgba(59,130,246,0.12)' },
  actionDelete: { backgroundColor: 'rgba(239,68,68,0.12)' },
  actionText: { fontSize: 12, fontWeight: '600' },
});
