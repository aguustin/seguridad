import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { securityRegister } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

export default function SecurityRegisterScreen({ navigation }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', documentNumber: '', age: ''
  });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  async function pickPhoto() {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (perm.status !== 'granted') {
      return Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara');
    }

    Alert.alert('Foto de perfil', 'Elegí cómo tomar la foto', [
      {
        text: 'Cámara',
        onPress: async () => {
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true, aspect: [1, 1], quality: 0.9,
          });
          if (!result.canceled) setPhoto(result.assets[0]);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true, aspect: [1, 1], quality: 0.9,
          });
          if (!result.canceled) setPhoto(result.assets[0]);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  async function handleRegister() {
    const { firstName, lastName, documentNumber, age } = form;
    if (!firstName || !lastName || !documentNumber || !age) {
      return Alert.alert('Error', 'Completá todos los campos');
    }
    if (!photo) {
      return Alert.alert('Error', 'Se requiere una foto de perfil para el reconocimiento facial');
    }

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => formData.append(k, v));
    const filename = photo.uri.split('/').pop();
    const ext = filename.split('.').pop();
    formData.append('profilePhoto', { uri: photo.uri, name: filename, type: `image/${ext}` });

    setLoading(true);
    try {
      const { data } = await securityRegister(formData);
      Alert.alert(
        'Registro exitoso',
        'Tu cuenta fue creada. Un administrador debe asignarte a un barrio antes de que puedas ingresar.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={22} color={COLORS.darkGray} />
      </TouchableOpacity>

      <Text style={styles.title}>Registro Guardia</Text>
      <Text style={styles.subtitle}>
        Usá una foto clara de frente para el reconocimiento facial
      </Text>

      {/* Foto */}
      <TouchableOpacity style={styles.photoArea} onPress={pickPhoto}>
        {photo ? (
          <>
            <Image source={{ uri: photo.uri }} style={styles.photo} />
            <View style={styles.photoOverlay}>
              <Ionicons name="camera" size={20} color={COLORS.white} />
            </View>
          </>
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="camera" size={40} color={COLORS.gray} />
            <Text style={styles.photoHint}>Tomar foto de frente</Text>
            <Text style={styles.photoSubHint}>Se usará para reconocimiento facial</Text>
          </View>
        )}
      </TouchableOpacity>

      <Input label="Nombre" value={form.firstName} onChangeText={set('firstName')} icon="person-outline" />
      <Input label="Apellido" value={form.lastName} onChangeText={set('lastName')} icon="person-outline" />
      <Input label="DNI / Documento" value={form.documentNumber} onChangeText={set('documentNumber')} icon="card-outline" keyboardType="numeric" />
      <Input label="Edad" value={form.age} onChangeText={set('age')} icon="calendar-outline" keyboardType="numeric" />

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={18} color={COLORS.accentBlue} />
        <Text style={styles.infoText}>
          Tu ingreso y salida de turno se verificará con reconocimiento facial.
          Asegurate de que la foto sea clara y de frente.
        </Text>
      </View>

      <Button title="Registrarme" onPress={handleRegister} loading={loading} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 24, paddingBottom: 40 },
  back: { marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.darkGray },
  subtitle: { fontSize: 14, color: COLORS.gray, marginTop: 6, marginBottom: 24 },
  photoArea: {
    alignSelf: 'center',
    marginBottom: 28,
    position: 'relative',
  },
  photo: { width: 130, height: 130, borderRadius: 65, borderWidth: 3, borderColor: COLORS.accent },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.accent,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  photoPlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderStyle: 'dashed',
  },
  photoHint: { fontSize: 12, fontWeight: '600', color: COLORS.gray, marginTop: 6 },
  photoSubHint: { fontSize: 10, color: COLORS.gray, textAlign: 'center', paddingHorizontal: 10, marginTop: 2 },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#e8f0fe',
    borderRadius: 10,
    padding: 14,
    gap: 10,
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 13, color: COLORS.accentBlue, lineHeight: 18 },
});
