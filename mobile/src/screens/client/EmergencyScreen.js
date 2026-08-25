import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  Alert, Animated, Vibration
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { sendEmergencyAlert } from '../../services/api';
import { COLORS } from '../../config/constants';

export default function EmergencyScreen({ navigation }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [location, setLocation] = useState(null);
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    getLocation();
    startPulse();
  }, []);

  function startPulse() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }

  async function getLocation() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setLocation(loc.coords);
      }
    } catch {}
  }

  async function handleSendEmergency() {
    Alert.alert(
      '🚨 Confirmar emergencia',
      'Se va a notificar a todos los administradores. ¿Confirmás?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Enviar alerta',
          style: 'destructive',
          onPress: async () => {
            Vibration.vibrate([0, 500, 200, 500]);
            setSending(true);
            try {
              // Único camino de creación: REST crea el Alert en DB y emite
              // 'emergency_alert' al admin (ver clientController). Antes
              // también se emitía por socket, duplicando el registro.
              await sendEmergencyAlert({
                message: message || undefined,
                latitude: location?.latitude,
                longitude: location?.longitude,
              });
              setSent(true);
            } catch {
              Alert.alert('Error', 'No se pudo enviar la alerta. Intentá de nuevo.');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  }

  if (sent) {
    return (
      <View style={styles.sentContainer}>
        <View style={styles.sentIcon}>
          <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
        </View>
        <Text style={styles.sentTitle}>Alerta enviada</Text>
        <Text style={styles.sentText}>
          Los administradores han sido notificados y están al tanto de tu situación.
          {location ? '\n\nTu ubicación fue compartida.' : ''}
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="close" size={26} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>

      <View style={styles.topSection}>
        <Animated.View style={[styles.pulseOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.emergencyCircle}>
            <Ionicons name="warning" size={50} color={COLORS.white} />
          </View>
        </Animated.View>
        <Text style={styles.title}>Alerta de emergencia</Text>
        <Text style={styles.subtitle}>
          Al presionar el botón, se notificará inmediatamente a los administradores con tu ubicación.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Mensaje adicional (opcional)</Text>
        <TextInput
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Describí brevemente la situación..."
          placeholderTextColor="rgba(255,255,255,0.3)"
          multiline
          numberOfLines={3}
          maxLength={200}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{message.length}/200</Text>

        {location && (
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={16} color={COLORS.success} />
            <Text style={styles.locationText}>Tu ubicación será compartida</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.sendBtn, sending && styles.sendBtnDisabled]}
        onPress={handleSendEmergency}
        disabled={sending}
        activeOpacity={0.8}
      >
        <Ionicons name={sending ? 'hourglass-outline' : 'send'} size={24} color={COLORS.white} />
        <Text style={styles.sendBtnText}>
          {sending ? 'Enviando...' : 'ENVIAR ALERTA'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: COLORS.primaryDark, padding: 24, paddingTop: 50 },
  closeBtn:     { alignSelf: 'flex-end', padding: 4, marginBottom: 10 },

  topSection:   { alignItems: 'center', marginBottom: 32 },
  pulseOuter: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: 'rgba(239,68,68,0.15)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  emergencyCircle: {
    width: 110, height: 110, borderRadius: 55,
    backgroundColor: COLORS.danger,
    justifyContent: 'center', alignItems: 'center',
  },
  title:    { fontSize: 22, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginTop: 8, lineHeight: 20, paddingHorizontal: 10 },

  form:  { marginBottom: 24 },
  label: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginBottom: 8 },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 12, padding: 14,
    fontSize: 14, color: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.surfaceBorder,
    minHeight: 80,
  },
  charCount: { textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4 },
  locationBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 8, padding: 10, marginTop: 12,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  locationText: { fontSize: 13, color: COLORS.success, fontWeight: '500' },

  sendBtn: {
    backgroundColor: COLORS.danger, borderRadius: 14, paddingVertical: 18,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10,
    shadowColor: COLORS.danger, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, elevation: 6,
  },
  sendBtnDisabled: { opacity: 0.7 },
  sendBtnText:     { color: COLORS.white, fontSize: 18, fontWeight: '900', letterSpacing: 1 },

  sentContainer: { flex: 1, backgroundColor: COLORS.primaryDark, justifyContent: 'center', alignItems: 'center', padding: 32 },
  sentIcon:      { marginBottom: 20 },
  sentTitle:     { fontSize: 24, fontWeight: '800', color: COLORS.white, marginBottom: 12 },
  sentText:      { fontSize: 15, color: 'rgba(255,255,255,0.55)', textAlign: 'center', lineHeight: 22 },
  backBtn:       { marginTop: 32, backgroundColor: COLORS.accent, paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  backBtnText:   { color: COLORS.primary, fontSize: 16, fontWeight: '700' },
});
