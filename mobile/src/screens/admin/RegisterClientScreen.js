import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Image,
  TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { registerClient, getNeighborhoods } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

export default function RegisterClientScreen({ navigation }) {
  const [form, setForm] = useState({
    username: '', password: '', firstName: '', lastName: '',
    age: '', neighborhoodId: '',
  });
  const [photo, setPhoto] = useState(null);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getNeighborhoods().then((r) => setNeighborhoods(r.data)).catch(() => {});
  }, []);

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  async function handleRegister() {
    const { username, password, firstName, lastName, neighborhoodId } = form;
    if (!username || !password || !firstName || !lastName || !neighborhoodId) {
      return Alert.alert('Error', 'Completá todos los campos obligatorios');
    }

    const formData = new FormData();
    Object.entries(form).forEach(([k, v]) => { if (v) formData.append(k, v); });
    if (photo) {
      const filename = photo.uri.split('/').pop();
      const ext = filename.split('.').pop() || 'jpg';
      formData.append('profilePhoto', { uri: photo.uri, name: filename, type: `image/${ext}` });
    }

    setLoading(true);
    try {
      await registerClient(formData);
      Alert.alert('Cliente registrado', `${firstName} ${lastName} fue registrado correctamente.`);
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
        <Text style={styles.title}>Registrar Cliente</Text>

        {/* Foto opcional */}
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
              <Ionicons name="camera-outline" size={32} color={COLORS.accent} />
              <Text style={styles.photoLabel}>Foto (opcional)</Text>
            </View>
          )}
        </TouchableOpacity>

        <Input dark label="Usuario *"     value={form.username}   onChangeText={set('username')}   icon="person-outline"   autoCapitalize="none" placeholder="Nombre de usuario" />
        <Input dark label="Contraseña *"  value={form.password}   onChangeText={set('password')}   icon="lock-closed-outline" secureTextEntry placeholder="Contraseña" />
        <Input dark label="Nombre *"      value={form.firstName}  onChangeText={set('firstName')}  icon="person-outline"   placeholder="Nombre" />
        <Input dark label="Apellido *"    value={form.lastName}   onChangeText={set('lastName')}   icon="person-outline"   placeholder="Apellido" />
        <Input dark label="Edad"          value={form.age}        onChangeText={set('age')}        icon="calendar-outline" keyboardType="numeric" placeholder="Edad" />

        <Text style={styles.fieldLabel}>Barrio *</Text>
        <View style={styles.neighborhoodList}>
          {neighborhoods.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.neighborhoodItem, form.neighborhoodId === n.id && styles.neighborhoodItemActive]}
              onPress={() => set('neighborhoodId')(n.id)}
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

        <Button title="Registrar cliente" onPress={handleRegister} loading={loading} style={{ marginTop: 20 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 24 },

  photoArea:        { alignSelf: 'center', marginBottom: 28, position: 'relative' },
  photo:            { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: COLORS.accent },
  photoEdit: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primaryDark,
  },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 2, borderColor: COLORS.surfaceBorder,
    borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  photoLabel: { fontSize: 11, fontWeight: '600', color: COLORS.accent },

  fieldLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4 },
  neighborhoodList: { gap: 8, marginBottom: 8 },
  neighborhoodItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.surface, borderRadius: 12, padding: 14,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
  },
  neighborhoodItemActive: { borderColor: COLORS.accent, backgroundColor: 'rgba(252,211,77,0.08)' },
  neighborhoodName:       { fontSize: 14, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },
  neighborhoodNameActive: { color: COLORS.accent, fontWeight: '700' },
  noNeighborhoods:        { color: 'rgba(255,255,255,0.3)', fontSize: 13, textAlign: 'center', padding: 12 },
});
