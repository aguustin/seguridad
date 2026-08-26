import { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../config/constants';
import { useQRScanner } from '../../hooks/useQRScanner';
import { SCAN_STATUS } from '../../hooks/useFaceScanner';
import QRScannerCamera from '../../components/QRScannerCamera';
import { scanCheckpointQR } from '../../services/api';

// El QR de un checkpoint solo codifica su id — ver
// patrolController.getCheckpointQR y securityController.scanCheckpointQR.
// A diferencia del QR de invitación de visita, este no vence ni es de un
// solo uso: es un marcador fijo pegado en el lugar.
const QR_PREFIX = 'patrol-checkpoint:';

/**
 * Escanea el QR físico de un checkpoint de ronda y lo registra sin
 * depender del GPS — alternativa para checkpoints donde la señal es poco
 * confiable (interiores, garitas). El registro por GPS en PatrolScreen
 * sigue existiendo sin cambios; esto es un camino adicional, no un
 * reemplazo.
 */
export default function ScanCheckpointQRScreen({ navigation }) {
  const { device, hasPermission, requestPermission, codeScanner, status, result, reset } = useQRScanner({
    prefix: QR_PREFIX,
    mismatchMessage: 'Este QR no corresponde a un checkpoint de ronda',
    scan: scanCheckpointQR,
  });

  useEffect(() => {
    if (!hasPermission) requestPermission();
  }, []);

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
  const isSuccess = result?.ok;
  const isError = !!result && !result.ok;

  let headline = 'Apuntá al QR del checkpoint';
  if (isProcessing) headline = 'Procesando...';
  else if (isSuccess) headline = result.data?.message || 'Checkpoint registrado';
  else if (isError) headline = result.message || 'QR inválido';

  const accent = isSuccess ? COLORS.success : isError ? COLORS.danger : COLORS.accent;

  return (
    <View style={styles.container}>
      <QRScannerCamera
        device={device}
        isActive={status === SCAN_STATUS.WAITING}
        codeScanner={codeScanner}
      />

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Escanear checkpoint</Text>
        </View>

        <View style={styles.center} pointerEvents="none">
          <View style={[styles.frame, { borderColor: accent }]}>
            {isProcessing
              ? <ActivityIndicator color={accent} size="large" />
              : <Ionicons
                  name={isSuccess ? 'checkmark-circle' : isError ? 'alert-circle' : 'qr-code-outline'}
                  size={64}
                  color={accent}
                />}
          </View>
          <Text style={styles.headline}>{headline}</Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {status === SCAN_STATUS.WAITING ? 'Escaneando automáticamente...' : ' '}
          </Text>
        </View>
      </View>
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
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backBtn: { padding: 4 },
  topTitle: { fontSize: 16, fontWeight: '800', color: COLORS.white },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24, paddingHorizontal: 32 },
  frame: {
    width: 220, height: 220, borderRadius: 20, borderWidth: 3,
    justifyContent: 'center', alignItems: 'center',
  },
  headline: { fontSize: 18, fontWeight: '800', color: COLORS.white, textAlign: 'center' },

  footer: {
    alignItems: 'center', paddingBottom: 40, paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  footerText: { fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5 },
});
