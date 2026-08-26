import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';

/**
 * Tarjeta numérica compacta (ícono + valor + etiqueta), usada en grillas de
 * resumen. Extraída de AdminDashboardScreen (donde vivía como componente
 * local) para reutilizarla también en ControlCenterScreen sin duplicar el
 * mismo JSX/estilos dos veces.
 */
export default function StatCard({ icon, label, value, accent, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.statCard, accent && styles.statCardAccent]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <Ionicons name={icon} size={20} color={accent ? COLORS.primary : COLORS.accent} />
      <Text style={[styles.statValue, accent && styles.statValueAccent]}>{value}</Text>
      <Text style={[styles.statLabel, accent && styles.statLabelAccent]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: COLORS.surface,
    borderRadius: 14, padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
    gap: 6,
  },
  statCardAccent:  { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  statValue:       { fontSize: 30, fontWeight: '900', color: COLORS.white },
  statValueAccent: { color: COLORS.primary },
  statLabel:       { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500' },
  statLabelAccent: { color: 'rgba(0,0,0,0.6)' },
});
