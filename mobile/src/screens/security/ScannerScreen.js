import { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  BackHandler, Modal, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/constants';
import { useFaceScanner, SCAN_STATUS } from '../../hooks/useFaceScanner';
import FaceScannerCamera from '../../components/FaceScannerCamera';
import { useKiosk } from '../../context/KioskContext';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/Input';
import Button from '../../components/Button';

/**
 * "Modo Escáner": pantalla fija para el dispositivo de la puerta de entrada.
 *
 * A diferencia de FaceScanScreen (login personal del guardia en su propio
 * celular), acá un match NUNCA inicia sesión — solo muestra el resultado
 * del check-in/check-out y vuelve a esperar. No hay forma de salir de esta
 * pantalla sin la contraseña de un administrador.
 */
export default function ScannerScreen() {
  const { device, format, hasPermission, requestPermission, cameraRef, onFacesDetected, status, result } = useFaceScanner();
  const { deactivateKiosk } = useKiosk();
  const { user, logout } = useAuth();

  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [exitError, setExitError] = useState('');
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

  // Bloquear el botón "atrás" de Android: en modo escáner no se sale de acá.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, []);

  async function handleExitSubmit() {
    if (!username || !password) {
      setExitError('Ingresá usuario y contraseña');
      return;
    }
    setExiting(true);
    setExitError('');
    try {
      await deactivateKiosk(username, password);
      // Siempre vuelve a la pantalla de login, sin importar qué sesión haya
      // quedado guardada en este dispositivo antes de activar el kiosco.
      if (user) await logout();
      // Al desactivarse el flag (y cerrar sesión), el navigator raíz saca
      // esta pantalla solo.
    } catch (err) {
      setExitError(err.response?.data?.error || 'Credenciales incorrectas');
    } finally {
      setExiting(false);
    }
  }

  function closeExitModal() {
    setExitModalVisible(false);
    setUsername('');
    setPassword('');
    setExitError('');
  }

  if (!hasPermission || !device) {
    return (
      <View style={styles.centeredView}>
        <ActivityIndicator color={COLORS.accent} size="large" />
        <Text style={styles.permTitle}>
          {!hasPermission ? 'Esperando permiso de cámara...' : 'Cámara no disponible'}
        </Text>
      </View>
    );
  }

  const isProcessing = status === SCAN_STATUS.PROCESSING;
  const isCheckIn  = result?.ok && result.action === 'check_in';
  const isCheckOut = result?.ok && result.action === 'check_out';
  const isError    = !!result && !result.ok;

  let headline = 'Acérquese para registrar su asistencia';
  let subline = '';
  if (isProcessing) {
    headline = 'Procesando...';
  } else if (isCheckIn) {
    headline = `Bienvenido ${result.staff.firstName} ${result.staff.lastName}`;
    subline = result.delayMinutes > 0 ? `+${result.delayMinutes} min tarde` : '';
  } else if (isCheckOut) {
    headline = result.staff
      ? `Hasta luego ${result.staff.firstName} ${result.staff.lastName}`
      : (result.message || 'Salida registrada');
  } else if (isError) {
    headline = result.message || 'Rostro no reconocido';
  }

  const accent = isCheckIn ? COLORS.success : isCheckOut ? COLORS.info : isError ? COLORS.danger : COLORS.accent;

  return (
    <View style={styles.container}>
      <FaceScannerCamera
        cameraRef={cameraRef}
        device={device}
        format={format}
        isActive
        paused={status !== SCAN_STATUS.WAITING}
        onFacesDetected={onFacesDetected}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.topBar}>
          <Text style={styles.title}>ESCÁNER FACIAL</Text>
          <TouchableOpacity
            style={styles.exitIcon}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            onPress={() => setExitModalVisible(true)}
          >
            <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.55)" />
          </TouchableOpacity>
        </View>

        <View style={styles.center} pointerEvents="none">
          <View style={[styles.frame, { borderColor: accent }]}>
            {isProcessing
              ? <ActivityIndicator color={accent} size="large" />
              : <Ionicons
                  name={isCheckIn ? 'checkmark-circle' : isCheckOut ? 'log-out-outline' : isError ? 'alert-circle' : 'scan-outline'}
                  size={64}
                  color={accent}
                />}
          </View>

          <Text style={styles.headline}>{headline}</Text>
          {!!subline && <Text style={styles.subline}>{subline}</Text>}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Dispositivo en modo escáner</Text>
        </View>
      </View>

      <Modal visible={exitModalVisible} transparent animationType="fade" onRequestClose={closeExitModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Salir del modo escáner</Text>
            <Text style={styles.modalSub}>Requiere usuario y contraseña de administrador</Text>

            <Input
              dark
              label="Usuario"
              icon="person-outline"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            <Input
              dark
              label="Contraseña"
              icon="lock-closed-outline"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {!!exitError && <Text style={styles.modalError}>{exitError}</Text>}

            <View style={styles.modalActions}>
              <Button title="Cancelar" variant="ghost" onPress={closeExitModal} style={{ flex: 1 }} />
              <Button title="Salir" loading={exiting} onPress={handleExitSubmit} style={{ flex: 1 }} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centeredView: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 14, backgroundColor: COLORS.primary, padding: 32,
  },
  permTitle: { fontSize: 15, fontWeight: '600', color: COLORS.white, textAlign: 'center' },

  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingTop: 56, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  title: { fontSize: 16, fontWeight: '900', color: COLORS.white, letterSpacing: 2 },
  exitIcon: { position: 'absolute', right: 20, top: 56, padding: 4 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, paddingHorizontal: 32 },
  frame: {
    width: 160, height: 160, borderRadius: 80, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  headline: { fontSize: 20, fontWeight: '800', color: COLORS.white, textAlign: 'center' },
  subline:  { fontSize: 14, fontWeight: '600', color: COLORS.accent, textAlign: 'center' },

  footer: {
    alignItems: 'center', paddingBottom: 40, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  footerText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  modalCard: {
    backgroundColor: COLORS.surface, borderRadius: 18, padding: 22,
    borderWidth: 1, borderColor: COLORS.surfaceBorder, gap: 4,
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: COLORS.white, marginBottom: 2 },
  modalSub:   { fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 16 },
  modalError: { fontSize: 12, color: COLORS.danger, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 6 },
});
