import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { clientLogin } from '../../services/api';
import { connectSocket, registerPushToken } from '../../services/socket';
import Input from '../../components/Input';
import Button from '../../components/Button';
import { COLORS } from '../../config/constants';
import * as Notifications from 'expo-notifications';
import Constants, { ExecutionEnvironment } from 'expo-constants';

export default function ClientLoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  async function handleLogin() {
    if (!username || !password) return Alert.alert('Campos requeridos', 'Ingresá usuario y contraseña');
    setLoading(true);
    try {
      const { data } = await clientLogin(username, password);
      await login(data.user, data.token);
      connectSocket(data.token);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo iniciar sesión');
      setLoading(false);
      return;
    }
    setLoading(false);

    // Registro de push token: best-effort, nunca debe hacer fallar el login
    // (ya se completó arriba). En Expo Go las notificaciones remotas en
    // Android no están disponibles desde el SDK 53 — ahí directamente ni se
    // intenta, para no tirar "runtime not ready". Fuera de Expo Go (build de
    // desarrollo/producción) sigue funcionando igual que antes.
    if (Constants.executionEnvironment !== ExecutionEnvironment.StoreClient) {
      try {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          const t = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig.extra.eas.projectId,
          });
          registerPushToken(t.data);
        }
      } catch {}
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.primary }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={22} color={COLORS.accent} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconCircle}>
            <Ionicons name="home" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.title}>Vecino</Text>
          <Text style={styles.subtitle}>Acceso seguro al barrio</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Iniciar sesión</Text>
          <Input
            dark
            label="Usuario"
            placeholder="Tu usuario"
            value={username}
            onChangeText={setUsername}
            icon="person-outline"
            autoCapitalize="none"
          />
          <Input
            dark
            label="Contraseña"
            placeholder="Tu contraseña"
            value={password}
            onChangeText={setPassword}
            icon="lock-closed-outline"
            secureTextEntry
          />
          <Button title="Ingresar" onPress={handleLogin} loading={loading} style={{ marginTop: 8 }} />
          <Text style={styles.note}>
            ¿No tenés acceso? Contactá al administrador del barrio.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content:    { padding: 24, paddingTop: 54, minHeight: '100%' },
  back:       { marginBottom: 24 },
  header:     { alignItems: 'center', marginBottom: 36 },
  iconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.accent,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 16,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 14, elevation: 10,
  },
  title:    { fontSize: 24, fontWeight: '800', color: COLORS.white },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.45)', marginTop: 4, letterSpacing: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: COLORS.surfaceBorder,
  },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.white, marginBottom: 20 },
  note: {
    fontSize: 12, color: 'rgba(255,255,255,0.35)',
    textAlign: 'center', marginTop: 16, lineHeight: 18,
  },
});
