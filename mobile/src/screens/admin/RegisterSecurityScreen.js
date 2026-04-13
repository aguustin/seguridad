import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  Image, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { securityRegister, getNeighborhoods } from '../../services/api';
import { updateSecurityStaff } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

export default function RegisterSecurityScreen({ navigation }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    documentNumber: '',
    age: '',
    contact: '',
    neighborhoodId: '',
    shiftStart: '',
    shiftEnd: '',
    paymentDay: '',
    salary: '',
  });
  const [photo, setPhoto] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    getNeighborhoods().then((r) => setNeighborhoods(r.data)).catch(() => {});
  }, []);

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  async function pickPhoto() {
    Alert.alert('Foto del guardia', 'Se usará para reconocimiento facial', [
      {
        text: 'Cámara',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.status !== 'granted') return;
          const r = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!r.canceled) setPhoto(r.assets[0]);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const r = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.7 });
          if (!r.canceled) setPhoto(r.assets[0]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function validateStep1() {
    const { firstName, lastName, documentNumber, age } = form;
    if (!firstName.trim()) return 'Ingresá el nombre';
    if (!lastName.trim())  return 'Ingresá el apellido';
    if (!documentNumber.trim()) return 'Ingresá el documento';
    if (!age || isNaN(age)) return 'Ingresá una edad válida';
    if (!photo) return 'Se requiere foto de perfil para el reconocimiento facial';
    return null;
  }

  async function handleRegister() {
    const { neighborhoodId, shiftStart, shiftEnd, paymentDay, salary } = form;

    const formData = new FormData();
    formData.append('firstName',      form.firstName.trim());
    formData.append('lastName',       form.lastName.trim());
    formData.append('documentNumber', form.documentNumber.trim());
    formData.append('age',            form.age);

    const filename = photo.uri.split('/').pop();
    const ext = filename.split('.').pop() || 'jpg';
    formData.append('profilePhoto', { uri: photo.uri, name: filename, type: `image/${ext}` });

    setLoading(true);
    try {
      const { data } = await securityRegister(formData);

      if (neighborhoodId || shiftStart || salary || form.contact) {
        const updates = {};
        if (neighborhoodId)  updates.neighborhoodId = neighborhoodId;
        if (shiftStart)      updates.shiftStart     = shiftStart;
        if (shiftEnd)        updates.shiftEnd       = shiftEnd;
        if (paymentDay)      updates.paymentDay     = parseInt(paymentDay);
        if (salary)          updates.salary         = parseFloat(salary);
        if (form.contact)    updates.contact        = form.contact.trim();
        await updateSecurityStaff(data.staff.id, updates);
      }

      Alert.alert(
        'Guardia registrado',
        `${form.firstName} ${form.lastName} fue registrado correctamente.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  function goToStep2() {
    const error = validateStep1();
    if (error) return Alert.alert('Datos incompletos', error);
    setStep(2);
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.primaryDark }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Indicador de pasos */}
        <View style={styles.stepsIndicator}>
          {[1, 2].map((s) => (
            <View key={s} style={styles.stepRow}>
              <View style={[styles.stepDot, step >= s && styles.stepDotActive]}>
                {step > s
                  ? <Ionicons name="checkmark" size={12} color={COLORS.primary} />
                  : <Text style={[styles.stepNum, step >= s && styles.stepNumActive]}>{s}</Text>
                }
              </View>
              {s < 2 && <View style={[styles.stepLine, step > s && styles.stepLineActive]} />}
            </View>
          ))}
        </View>

        {/* ── STEP 1: Datos personales ── */}
        {step === 1 && (
          <>
            <Text style={styles.stepTitle}>Datos personales</Text>

            <TouchableOpacity style={styles.photoArea} onPress={pickPhoto} activeOpacity={0.8}>
              {photo ? (
                <>
                  <Image source={{ uri: photo.uri }} style={styles.photo} />
                  <View style={styles.photoEdit}>
                    <Ionicons name="camera" size={16} color={COLORS.primary} />
                  </View>
                </>
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={36} color={COLORS.accent} />
                  <Text style={styles.photoLabel}>Foto de perfil</Text>
                  <Text style={styles.photoSub}>Requerida para reconocimiento facial</Text>
                </View>
              )}
            </TouchableOpacity>

            <Input dark label="Nombre *"    value={form.firstName}      onChangeText={set('firstName')}      icon="person-outline"   placeholder="Nombre del guardia" />
            <Input dark label="Apellido *"  value={form.lastName}       onChangeText={set('lastName')}       icon="person-outline"   placeholder="Apellido" />
            <Input dark label="DNI / Documento *" value={form.documentNumber} onChangeText={set('documentNumber')} icon="card-outline" keyboardType="numeric" placeholder="Número de documento" />
            <Input dark label="Edad *"      value={form.age}            onChangeText={set('age')}            icon="calendar-outline" keyboardType="numeric" placeholder="Edad" />
            <Input dark label="Contacto (celular)" value={form.contact} onChangeText={set('contact')} icon="call-outline" keyboardType="phone-pad" placeholder="Número de teléfono" />

            <Button title="Continuar" onPress={goToStep2} style={styles.btn} />
          </>
        )}

        {/* ── STEP 2: Asignación ── */}
        {step === 2 && (
          <>
            <Text style={styles.stepTitle}>Asignación y turno</Text>
            <Text style={styles.stepSub}>Podés completarlo ahora o editarlo después</Text>

            <Text style={styles.fieldLabel}>Barrio</Text>
            <View style={styles.neighborhoodList}>
              {neighborhoods.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.neighborhoodItem, form.neighborhoodId === n.id && styles.neighborhoodItemActive]}
                  onPress={() => set('neighborhoodId')(form.neighborhoodId === n.id ? '' : n.id)}
                >
                  <Ionicons
                    name={form.neighborhoodId === n.id ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={form.neighborhoodId === n.id ? COLORS.accent : 'rgba(255,255,255,0.3)'}
                  />
                  <Text style={[styles.neighborhoodName, form.neighborhoodId === n.id && styles.neighborhoodNameActive]}>
                    {n.name}
                  </Text>
                </TouchableOpacity>
              ))}
              {neighborhoods.length === 0 && (
                <Text style={styles.noNeighborhoods}>Sin barrios registrados aún</Text>
              )}
            </View>

            <Text style={styles.fieldLabel}>Turno</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input dark label="Entrada (HH:MM)" value={form.shiftStart} onChangeText={set('shiftStart')} placeholder="08:00" icon="log-in-outline" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Input dark label="Salida (HH:MM)"  value={form.shiftEnd}   onChangeText={set('shiftEnd')}   placeholder="16:00" icon="log-out-outline" />
              </View>
            </View>

            <Text style={styles.fieldLabel}>Pago</Text>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input dark label="Día de pago" value={form.paymentDay} onChangeText={set('paymentDay')} keyboardType="numeric" placeholder="15" icon="calendar-outline" />
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Input dark label="Salario ($)"  value={form.salary}     onChangeText={set('salary')}     keyboardType="decimal-pad" placeholder="0.00" icon="cash-outline" />
              </View>
            </View>

            <View style={styles.row}>
              <Button title="Atrás" onPress={() => setStep(1)} variant="outline" style={[styles.btn, { flex: 1 }]} />
              <View style={{ width: 12 }} />
              <Button title="Registrar guardia" onPress={handleRegister} loading={loading} style={[styles.btn, { flex: 2 }]} />
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },

  stepsIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28, gap: 0 },
  stepRow:        { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
    justifyContent: 'center', alignItems: 'center',
  },
  stepDotActive:  { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  stepNum:        { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  stepNumActive:  { color: COLORS.primary },
  stepLine:       { width: 48, height: 2, backgroundColor: COLORS.surfaceBorder, marginHorizontal: 4 },
  stepLineActive: { backgroundColor: COLORS.accent },

  stepTitle: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  stepSub:   { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },

  photoArea:        { alignSelf: 'center', marginBottom: 26, position: 'relative' },
  photo:            { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: COLORS.accent },
  photoEdit: {
    position: 'absolute', bottom: 2, right: 2,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primaryDark,
  },
  photoPlaceholder: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.surfaceBorder,
    borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoLabel: { fontSize: 12, fontWeight: '600', color: COLORS.accent },
  photoSub:   { fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center', paddingHorizontal: 10 },

  fieldLabel:        { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  neighborhoodList:  { gap: 8, marginBottom: 16 },
  neighborhoodItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  neighborhoodItemActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(252,211,77,0.08)' },
  neighborhoodName:       { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  neighborhoodNameActive: { color: COLORS.accent, fontWeight: '700' },
  noNeighborhoods:        { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 12 },

  row: { flexDirection: 'row', alignItems: 'flex-start' },
  btn: { marginTop: 10 },
});
