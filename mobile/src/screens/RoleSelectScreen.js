import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config/constants';

const roles = [
  {
    id: 'admin',
    label: 'Administrador',
    icon: 'shield-checkmark',
    description: 'Gestión completa del sistema',
    nav: 'AdminLogin',
  },
  {
    id: 'security',
    label: 'Seguridad',
    icon: 'person-circle',
    description: 'Control de ingresos y comunicación',
    nav: 'SecurityLogin',
  },
  {
    id: 'client',
    label: 'Cliente / Vecino',
    icon: 'home',
    description: 'Alertas y comunicación',
    nav: 'ClientLogin',
  },
];

export default function RoleSelectScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.primary} />

      {/* Logo / Header */}
      <View style={styles.header}>
        <View style={styles.logoCircle}>
          {/* Águila - símbolo de la empresa */}
          <Ionicons name="shield" size={38} color={COLORS.primary} />
        </View>
        <Text style={styles.brand}>SEGURIDAD</Text>
        <Text style={styles.tagline}>BARRIOS PRIVADOS</Text>
        <View style={styles.divider} />
        <Text style={styles.selectLabel}>Seleccioná tu perfil</Text>
      </View>

      {/* Role cards */}
      <View style={styles.rolesContainer}>
        {roles.map((role, idx) => (
          <TouchableOpacity
            key={role.id}
            style={styles.roleCard}
            onPress={() => navigation.navigate(role.nav)}
            activeOpacity={0.85}
          >
            <View style={styles.roleIconWrap}>
              <Ionicons name={role.icon} size={26} color={COLORS.accent} />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleName}>{role.label}</Text>
              <Text style={styles.roleDesc}>{role.description}</Text>
            </View>
            <View style={styles.arrow}>
              <Ionicons name="chevron-forward" size={18} color={COLORS.accent} />
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.version}>v1.0.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 30,
  },
  header: {
    alignItems: 'center',
    marginBottom: 42,
  },
  logoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
  },
  brand: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.white,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.accent,
    letterSpacing: 5,
    marginTop: 4,
  },
  divider: {
    width: 40,
    height: 2,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
    marginVertical: 20,
    opacity: 0.6,
  },
  selectLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  rolesContainer: { gap: 12 },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.surfaceBorder,
    gap: 14,
  },
  roleIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(252,211,77,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.2)',
  },
  roleInfo:  { flex: 1 },
  roleName:  { fontSize: 16, fontWeight: '700', color: COLORS.white },
  roleDesc:  { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 },
  arrow: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(252,211,77,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  version: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.15)',
    fontSize: 11,
    marginTop: 28,
    letterSpacing: 1,
  },
});
