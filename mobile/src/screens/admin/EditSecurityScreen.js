import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getNeighborhoods, updateSecurityStaff } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

export default function EditSecurityScreen({ navigation, route }) {
  const { staff } = route.params;

  const [form, setForm] = useState({
    firstName:      staff.firstName      || '',
    lastName:       staff.lastName       || '',
    documentNumber: staff.documentNumber || '',
    age:            String(staff.age     ?? ''),
    contact:        staff.contact        || '',
    neighborhoodId: staff.neighborhoodId || '',
    shiftStart:     staff.shiftStart     || '',
    shiftEnd:       staff.shiftEnd       || '',
    paymentDay:     String(staff.paymentDay ?? ''),
    salary:         String(staff.salary  ?? ''),
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
        age:        form.age        ? parseInt(form.age)         : undefined,
        paymentDay: form.paymentDay ? parseInt(form.paymentDay)  : undefined,
        salary:     form.salary     ? parseFloat(form.salary)    : undefined,
      };
      await updateSecurityStaff(staff.id, payload);
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
        <Text style={styles.title}>Editar guardia</Text>

        {/* Datos personales */}
        <Text style={styles.sectionLabel}>Datos personales</Text>
        <Input dark label="Nombre"    value={form.firstName}      onChangeText={set('firstName')}      icon="person-outline" />
        <Input dark label="Apellido"  value={form.lastName}       onChangeText={set('lastName')}       icon="person-outline" />
        <Input dark label="DNI"       value={form.documentNumber} onChangeText={set('documentNumber')} icon="card-outline"   keyboardType="numeric" />
        <Input dark label="Edad"      value={form.age}            onChangeText={set('age')}            icon="calendar-outline" keyboardType="numeric" />
        <Input dark label="Contacto (celular)" value={form.contact} onChangeText={set('contact')} icon="call-outline" keyboardType="phone-pad" placeholder="Número de teléfono" />

        {/* Barrio */}
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

        {/* Turno */}
        <Text style={styles.sectionLabel}>Turno</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              dark
              label="Entrada (HH:MM)"
              value={form.shiftStart}
              onChangeText={set('shiftStart')}
              placeholder="08:00"
              icon="log-in-outline"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Input
              dark
              label="Salida (HH:MM)"
              value={form.shiftEnd}
              onChangeText={set('shiftEnd')}
              placeholder="16:00"
              icon="log-out-outline"
            />
          </View>
        </View>

        {/* Pago */}
        <Text style={styles.sectionLabel}>Pago</Text>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Input
              dark
              label="Día de pago"
              value={form.paymentDay}
              onChangeText={set('paymentDay')}
              placeholder="15"
              keyboardType="numeric"
              icon="calendar-outline"
            />
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Input
              dark
              label="Salario ($)"
              value={form.salary}
              onChangeText={set('salary')}
              placeholder="0.00"
              keyboardType="decimal-pad"
              icon="cash-outline"
            />
          </View>
        </View>

        <Button title="Guardar cambios" onPress={handleSave} loading={loading} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },

  title: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 22 },

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

  row: { flexDirection: 'row', alignItems: 'flex-start' },
});
