import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNeighborhoods, updateClient } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS, UPLOADS_URL } from '../../config/constants';

/**
 * Detalle + edición de un cliente — mismo criterio que EditSecurityScreen:
 * el formulario precargado con los datos actuales cumple el rol de "ver
 * detalle", sin una pantalla de solo-lectura separada. username y foto no
 * son editables acá (mismo criterio que un guardia: la foto se carga solo
 * al registrar, y la credencial de login es un cambio aparte que esta etapa
 * no cubre).
 */
export default function EditClientScreen({ navigation, route }) {
  const { client } = route.params;

  const [form, setForm] = useState({
    firstName:      client.firstName || '',
    lastName:       client.lastName  || '',
    age:            String(client.age ?? ''),
    contact:        client.contact   || '',
    neighborhoodId: client.neighborhoodId || '',
  });
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getNeighborhoods().then((r) => setNeighborhoods(r.data)).catch(() => {});
  }, []);

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  async function handleSave() {
    if (!form.firstName.trim() || !form.lastName.trim()) {
      return Alert.alert('Error', 'Nombre y apellido son obligatorios');
    }
    setLoading(true);
    try {
      const payload = {
        ...form,
        age: form.age ? parseInt(form.age, 10) : null,
      };
      await updateClient(client.id, payload);
      Alert.alert('Guardado', 'Datos actualizados correctamente');
      navigation.goBack();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.primaryDark }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          {client.profilePhoto ? (
            <Image source={{ uri: `${UPLOADS_URL}/${client.profilePhoto}` }} style={styles.photo} />
          ) : (
            <View style={[styles.photo, styles.photoPlaceholder]}>
              <Ionicons name="person" size={30} color={COLORS.accent} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Editar cliente</Text>
            <Text style={styles.username}>@{client.username}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Datos personales</Text>
        <Input dark label="Nombre"   value={form.firstName} onChangeText={set('firstName')} icon="person-outline" />
        <Input dark label="Apellido" value={form.lastName}  onChangeText={set('lastName')}  icon="person-outline" />
        <Input dark label="Edad"     value={form.age}       onChangeText={set('age')}       icon="calendar-outline" keyboardType="numeric" />
        <Input dark label="Contacto (celular)" value={form.contact} onChangeText={set('contact')} icon="call-outline" keyboardType="phone-pad" placeholder="Número de teléfono" />

        <Text style={styles.sectionLabel}>Barrio</Text>
        <View style={styles.neighborhoodList}>
          {neighborhoods.map((n) => {
            const active = form.neighborhoodId === n.id;
            return (
              <TouchableOpacity
                key={n.id}
                style={[styles.neighborhoodItem, active && styles.neighborhoodItemActive]}
                onPress={() => set('neighborhoodId')(active ? '' : n.id)}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active ? COLORS.accent : 'rgba(255,255,255,0.3)'}
                />
                <Text style={[styles.neighborhoodName, active && styles.neighborhoodNameActive]}>
                  {n.name}
                </Text>
              </TouchableOpacity>
            );
          })}
          {!form.neighborhoodId && (
            <Text style={styles.noNeighborhoodHint}>Sin barrio asignado</Text>
          )}
        </View>

        <Button title="Guardar cambios" onPress={handleSave} loading={loading} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },

  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 22 },
  photo:  { width: 56, height: 56, borderRadius: 28 },
  photoPlaceholder: {
    backgroundColor: 'rgba(252,211,77,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  title:    { fontSize: 20, fontWeight: '800', color: COLORS.white },
  username: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 2 },

  sectionLabel: {
    fontSize: 11, fontWeight: '700',
    color: 'rgba(255,255,255,0.35)',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 10, marginTop: 6,
  },

  neighborhoodList: { gap: 8, marginBottom: 16 },
  neighborhoodItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  neighborhoodItemActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(252,211,77,0.08)' },
  neighborhoodName:       { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  neighborhoodNameActive: { color: COLORS.accent, fontWeight: '700' },
  noNeighborhoodHint:     { fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: 8 },
});
