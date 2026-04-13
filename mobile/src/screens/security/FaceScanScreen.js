import { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { faceScan } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, registerPushToken } from '../../services/socket';
import { COLORS } from '../../config/constants';
import * as Notifications from 'expo-notifications';

// ── Constantes ────────────────────────────────────────────────────────────
const SCAN_INTERVAL_MS = 1500;  // ms entre capturas automáticas
const MAX_NO_FACE      = 4;     // intentos sin cara antes de mostrar hint

const OVAL_W = 220;
const OVAL_H = 280;

const STATUS = {
  IDLE:      'idle',
  MATCH:     'match',
  CHECKOUT:  'checkout',
  NOT_FOUND: 'not_found',
  NO_FACE:   'no_face',
  ERROR:     'error',
};

// ── Color del borde del óvalo según estado ────────────────────────────────
function ovalBorderColor(status) {
  switch (status) {
    case STATUS.MATCH:     return COLORS.success;
    case STATUS.CHECKOUT:  return COLORS.info;
    case STATUS.NOT_FOUND:
    case STATUS.NO_FACE:   return COLORS.danger;
    default:               return COLORS.accent;
  }
}

// ── Screen principal ──────────────────────────────────────────────────────
export default function FaceScanScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const { login } = useAuth();

  const [status,   setStatus]   = useState(STATUS.IDLE);
  const [result,   setResult]   = useState(null);

  // Refs — no causan re-render, evitan closures stale
  const scanningRef   = useRef(false);
  const intervalRef   = useRef(null);
  const noFaceCount   = useRef(0);
  const isMounted     = useRef(true);

  // Animaciones
  const scanLineY     = useRef(new Animated.Value(0)).current;
  const ovalScale     = useRef(new Animated.Value(1)).current;
  const ovalOpacity   = useRef(new Animated.Value(0.7)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  // ── Ciclo de vida ─────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    if (!permission?.granted) requestPermission();
    startAnimations();
    return () => {
      isMounted.current = false;
      clearAutoScan();
    };
  }, []);

  useEffect(() => {
    if (permission?.granted) {
      clearAutoScan();
      intervalRef.current = setInterval(captureAndScan, SCAN_INTERVAL_MS);
    }
  }, [permission?.granted]);

  useEffect(() => {
    if (result) {
      Animated.timing(resultOpacity, {
        toValue: 1, duration: 280, useNativeDriver: true,
      }).start();
    } else {
      resultOpacity.setValue(0);
    }
  }, [result]);

  // ── Animaciones ───────────────────────────────────────────────────────
  function startAnimations() {
    // Línea scan: baja y sube dentro del óvalo
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, {
          toValue: 1, duration: 1800,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
        Animated.timing(scanLineY, {
          toValue: 0, duration: 1800,
          easing: Easing.inOut(Easing.quad), useNativeDriver: true,
        }),
      ])
    ).start();

    // Pulso del borde del óvalo
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ovalScale,   { toValue: 1.02,  duration: 900, useNativeDriver: true }),
          Animated.timing(ovalOpacity, { toValue: 1,     duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ovalScale,   { toValue: 1,    duration: 900, useNativeDriver: true }),
          Animated.timing(ovalOpacity, { toValue: 0.65, duration: 900, useNativeDriver: true }),
        ]),
      ])
    ).start();
  }

  function clearAutoScan() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // ── Captura y envío al backend ────────────────────────────────────────
  const captureAndScan = useCallback(async () => {
    if (scanningRef.current || !cameraRef.current || !isMounted.current) return;
    scanningRef.current = true;

    try {
      const snap = await cameraRef.current.takePictureAsync({
        quality:         0.72,
        skipProcessing:  true,
      });

      const uri = snap.uri;

      const fd = new FormData();
      fd.append('faceImage', { uri, name: 'face.jpg', type: 'image/jpeg' });

      const { data } = await faceScan(fd);
      if (!isMounted.current) return;

      // ── Éxito ──────────────────────────────────────────────────────
      clearAutoScan();
      noFaceCount.current = 0;
      setResult(data);

      if (data.action === 'check_in') {
        setStatus(STATUS.MATCH);
        await login(data.staff, data.token);
        connectSocket(data.token);
        try {
          const { status: ns } = await Notifications.requestPermissionsAsync();
          if (ns === 'granted') {
           // const t = await Notifications.getExpoPushTokenAsync(); FUNCIONA EN DEV, PERO EN PRODUCCIÓN HAY QUE ESPECIFICAR EL PROJECT ID
          const t = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig.extra.eas.projectId
          });

            registerPushToken(t.data);
          }
        } catch {}
      } else {
        setStatus(STATUS.CHECKOUT);
      }

    } catch (err) {
      if (!isMounted.current) return;

      const code = err.response?.status;
      const msg  = err.response?.data?.error || '';

      if (code === 404) {
        // Cara detectada pero no reconocida → seguir intentando
        noFaceCount.current = 0;
        setStatus(STATUS.NOT_FOUND);
        setResult({ message: 'Rostro no reconocido' });
        setTimeout(() => {
          if (!isMounted.current) return;
          setStatus(STATUS.IDLE);
          setResult(null);
        }, 1300);

      } else if (
        msg.toLowerCase().includes('rostro') ||
        msg.toLowerCase().includes('face')
      ) {
        // No se detectó cara en el frame → contar y eventualmente mostrar hint
        noFaceCount.current += 1;
        if (noFaceCount.current >= MAX_NO_FACE) {
          setStatus(STATUS.NO_FACE);
          setResult({ message: 'No se detecta tu rostro. Acercate más.' });
          setTimeout(() => {
            if (!isMounted.current) return;
            setStatus(STATUS.IDLE);
            setResult(null);
            noFaceCount.current = 0;
          }, 2000);
        }

      } else {
        // Error de red u otro
        setStatus(STATUS.ERROR);
        setResult({ message: msg || 'Error de conexión. Reintentando...' });
        setTimeout(() => {
          if (!isMounted.current) return;
          setStatus(STATUS.IDLE);
          setResult(null);
        }, 2500);
      }
    } finally {
      scanningRef.current = false;
    }
  }, [login]);

  // ── Sin permiso ───────────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <View style={styles.centeredView}>
        <Ionicons name="camera-outline" size={64} color={COLORS.accent} />
        <Text style={styles.permTitle}>Permiso de cámara requerido</Text>
        <Text style={styles.permSub}>
          Necesitamos acceso para el reconocimiento facial
        </Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const borderColor = ovalBorderColor(status);
  const isDone      = status === STATUS.MATCH || status === STATUS.CHECKOUT;

  const scanLineTranslate = scanLineY.interpolate({
    inputRange:  [0, 1],
    outputRange: [-(OVAL_H / 2 - 12), OVAL_H / 2 - 12],
  });

  return (
    <View style={styles.container}>

      {/* ── Cámara en vivo ── */}
      {!isDone && (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing="front"
        />
      )}

      {/* ── Overlay semitransparente ── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">

        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Reconocimiento Facial</Text>
          {/* Indicador AUTO parpadeante */}
          <Animated.View style={[styles.autoPill, { opacity: ovalOpacity }]}>
            <View style={styles.autoLed} />
            <Text style={styles.autoText}>AUTO</Text>
          </Animated.View>
        </View>

        {/* ── Centro: guía de rostro ── */}
        <View style={styles.center} pointerEvents="none">

          {/* Óvalo guía con bordes animados */}
          <Animated.View
            style={[
              styles.oval,
              {
                borderColor,
                transform: [{ scale: ovalScale }],
                opacity:   ovalOpacity,
              },
            ]}
          >
            {/* Esquinas decorativas */}
            {[styles.cTL, styles.cTR, styles.cBL, styles.cBR].map((pos, i) => (
              <View key={i} style={[styles.corner, pos, { borderColor }]} />
            ))}

            {/* Línea de scan (solo mientras IDLE) */}
            {!isDone && (
              <Animated.View
                style={[
                  styles.scanLine,
                  { transform: [{ translateY: scanLineTranslate }] },
                ]}
              />
            )}

            {/* Ícono resultado dentro del óvalo */}
            {isDone && (
              <View style={styles.doneIconWrap}>
                <Ionicons
                  name={status === STATUS.MATCH ? 'checkmark-circle' : 'log-out-outline'}
                  size={60}
                  color={borderColor}
                />
              </View>
            )}
          </Animated.View>

          {/* Texto guía debajo del óvalo */}
          <Text style={styles.guideText}>
            {isDone
              ? (status === STATUS.MATCH ? '✅ Ingreso registrado' : '👋 Salida registrada')
              : status === STATUS.NOT_FOUND
              ? '🔄 Reintentando...'
              : status === STATUS.NO_FACE
              ? '📷 Acercate más a la cámara'
              : status === STATUS.ERROR
              ? '⚠️ Error de conexión'
              : 'Posicioná tu rostro en el óvalo'}
          </Text>

        </View>

        {/* ── Banner resultado (check-in / check-out) ── */}
        {isDone && result && (
          <Animated.View
            style={[
              styles.resultBanner,
              { opacity: resultOpacity },
              status === STATUS.MATCH ? styles.bannerIn : styles.bannerOut,
            ]}
            pointerEvents="none"
          >
            <Ionicons
              name={status === STATUS.MATCH ? 'log-in-outline' : 'log-out-outline'}
              size={24}
              color={COLORS.white}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerLabel}>
                {status === STATUS.MATCH ? 'INGRESO' : 'SALIDA'}
              </Text>
              <Text style={styles.bannerName}>
                {result.staff
                  ? `${result.staff.firstName} ${result.staff.lastName}`
                  : result.message}
              </Text>
              {result.time && (
                <Text style={styles.bannerTime}>
                  {new Date(result.time).toLocaleTimeString('es-AR', {
                    hour: '2-digit', minute: '2-digit',
                  })}
                </Text>
              )}
              {result.delayMinutes > 0 && (
                <Text style={styles.bannerDelay}>+{result.delayMinutes} min tarde</Text>
              )}
            </View>
          </Animated.View>
        )}

        {/* ── Pie ── */}
        <View style={styles.footer}>
          {isDone && status === STATUS.CHECKOUT ? (
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => navigation.navigate('RoleSelect')}
            >
              <Ionicons name="home-outline" size={18} color={COLORS.primary} />
              <Text style={styles.homeBtnText}>Volver al inicio</Text>
            </TouchableOpacity>
          ) : !isDone ? (
            <>
              <ScanDots active={status === STATUS.IDLE} />
              <Text style={styles.scanningLabel}>
                {status === STATUS.IDLE ? 'Escaneando automáticamente...' : 'Procesando...'}
              </Text>
              <TouchableOpacity
                style={styles.registerLink}
                onPress={() => navigation.navigate('SecurityRegister')}
              >
                <Text style={styles.registerLinkText}>¿Primera vez? Registrate aquí</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

      </View>
    </View>
  );
}

// ── Puntos de escaneo animados ─────────────────────────────────────────────
// Cada punto es su propio componente para respetar las reglas de hooks
function Dot({ delay, active }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!active) {
      anim.setValue(0.3);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1,   duration: 320, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 320, useNativeDriver: true }),
        Animated.delay(600 - delay),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active]);

  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

function ScanDots({ active }) {
  return (
    <View style={styles.dotsRow}>
      <Dot delay={0}   active={active} />
      <Dot delay={180} active={active} />
      <Dot delay={360} active={active} />
    </View>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#000' },
  centeredView: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 14, backgroundColor: COLORS.primary, padding: 32,
  },
  permTitle:   { fontSize: 18, fontWeight: '700', color: COLORS.white, textAlign: 'center' },
  permSub:     { fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 20 },
  permBtn:     { backgroundColor: COLORS.accent, paddingHorizontal: 28, paddingVertical: 13, borderRadius: 14, marginTop: 4 },
  permBtnText: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingTop: 52, paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  backBtn:  { padding: 4 },
  topTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.white },
  autoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12,
    paddingHorizontal: 9, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)',
  },
  autoLed:  { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.success },
  autoText: { fontSize: 10, fontWeight: '800', color: COLORS.success, letterSpacing: 1 },

  // Centro
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 28,
  },

  // Óvalo
  oval: {
    width: OVAL_W,
    height: OVAL_H,
    borderRadius: OVAL_W / 2,
    borderWidth: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },

  // Esquinas decorativas
  corner: { position: 'absolute', width: 26, height: 26 },
  cTL: { top: 8,    left: 8,    borderTopWidth: 3,    borderLeftWidth: 3,    borderTopLeftRadius: 5 },
  cTR: { top: 8,    right: 8,   borderTopWidth: 3,    borderRightWidth: 3,   borderTopRightRadius: 5 },
  cBL: { bottom: 8, left: 8,    borderBottomWidth: 3, borderLeftWidth: 3,    borderBottomLeftRadius: 5 },
  cBR: { bottom: 8, right: 8,   borderBottomWidth: 3, borderRightWidth: 3,   borderBottomRightRadius: 5 },

  // Línea de scan
  scanLine: {
    position: 'absolute',
    left: 0, right: 0,
    height: 2,
    backgroundColor: 'rgba(252,211,77,0.5)',
    // Glow efecto vía shadow
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },

  doneIconWrap: { justifyContent: 'center', alignItems: 'center' },

  guideText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // Banner resultado
  resultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    marginHorizontal: 20, padding: 18, borderRadius: 18,
  },
  bannerIn:    { backgroundColor: 'rgba(34,197,94,0.92)' },
  bannerOut:   { backgroundColor: 'rgba(59,130,246,0.92)' },
  bannerLabel: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5 },
  bannerName:  { fontSize: 16, fontWeight: '700', color: COLORS.white, marginTop: 2 },
  bannerTime:  { fontSize: 12, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  bannerDelay: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginTop: 2 },

  // Footer
  footer: {
    alignItems: 'center', paddingBottom: 48, paddingHorizontal: 24,
    gap: 10, backgroundColor: 'rgba(0,0,0,0.55)', paddingTop: 18,
  },
  dotsRow:      { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot:          { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.accent },
  scanningLabel:{ fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  registerLink: { marginTop: 2 },
  registerLinkText: { color: 'rgba(255,255,255,0.35)', fontSize: 13, textDecorationLine: 'underline' },
  homeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
  },
  homeBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
});
