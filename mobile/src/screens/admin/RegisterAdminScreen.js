import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { createAdmin } from '../../services/api';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';

/**
 * Alta de administradores adicionales — solo accesible desde el panel de un
 * admin ya autenticado (ver AdminDashboardScreen). El primer admin del
 * sistema se sigue creando por fuera de la app (POST /auth/admin/register,
 * público solo mientras no exista ninguno — ver README).
 */
export default function RegisterAdminScreen({ navigation }) {
  const [form, setForm] = useState({ name: '', username: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const set = (key) => (val) => setForm((p) => ({ ...p, [key]: val }));

  async function handleRegister() {
    const { name, username, password, confirmPassword } = form;
    if (!name.trim() || !username.trim() || !password) {
      return Alert.alert('Datos incompletos', 'Completá nombre, usuario y contraseña');
    }
    if (password.length < 6) {
      return Alert.alert('Contraseña débil', 'Usá al menos 6 caracteres');
    }
    if (password !== confirmPassword) {
      return Alert.alert('Error', 'Las contraseñas no coinciden');
    }

    setLoading(true);
    try {
      await createAdmin({ name: name.trim(), username: username.trim(), password });
      Alert.alert(
        'Administrador creado',
        `${name.trim()} ya puede iniciar sesión con el usuario "${username.trim()}".`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
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
        <Text style={styles.title}>Nuevo administrador</Text>
        <Text style={styles.subtitle}>
          Va a tener acceso completo al panel de administración.
        </Text>

        <Input dark label="Nombre completo" value={form.name} onChangeText={set('name')} icon="person-outline" placeholder="Nombre y apellido" />
        <Input dark label="Usuario" value={form.username} onChangeText={set('username')} icon="at-outline" placeholder="usuario" autoCapitalize="none" />
        <Input dark label="Contraseña" value={form.password} onChangeText={set('password')} icon="lock-closed-outline" placeholder="Mínimo 6 caracteres" secureTextEntry />
        <Input dark label="Confirmar contraseña" value={form.confirmPassword} onChangeText={set('confirmPassword')} icon="lock-closed-outline" placeholder="Repetir contraseña" secureTextEntry />

        <Button title="Crear administrador" onPress={handleRegister} loading={loading} style={{ marginTop: 10 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 20, fontWeight: '800', color: COLORS.white, marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 24 },
});
