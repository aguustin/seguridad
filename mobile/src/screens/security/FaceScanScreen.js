import { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../context/AuthContext';
import { connectSocket, registerPushToken } from '../../services/socket';
import { COLORS } from '../../config/constants';
import { useFaceScanner, SCAN_STATUS } from '../../hooks/useFaceScanner';
import FaceScannerCamera from '../../components/FaceScannerCamera';

const OVAL_W = 220;
const OVAL_H = 280;

/**
 * Pantalla de login/checkout personal del guardia (su propio celular, NO el
 * dispositivo fijo de la puerta — ese es ScannerScreen, el "modo escáner").
 *
 * Flujo: preview de cámara → detección local de rostro (ML Kit) → cuando
 * hay una cara estable se captura UNA foto y se manda al backend → según
 * la respuesta, loguea al guardia (check-in) o muestra la confirmación de
 * salida (check-out).
 */
export default function FaceScanScreen({ navigation }) {
  const { login, logout, user } = useAuth();
  const isFocused = useIsFocused();
  const {
    device, format, hasPermission, requestPermission, cameraRef,
    onFacesDetected, status, result,
  } = useFaceScanner();

  const loggedInRef = useRef(false);

  // Animaciones (puramente decorativas, no afectan el flujo de escaneo)
  const scanLineY   = useRef(new Animated.Value(0)).current;
  const ovalScale   = useRef(new Animated.Value(1)).current;
  const ovalOpacity = useRef(new Animated.Value(0.7)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!hasPermission) requestPermission();
    startAnimations();
  }, []);

  useEffect(() => {
    if (result) {
      Animated.timing(resultOpacity, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    } else {
      resultOpacity.setValue(0);
    }
  }, [result]);

  // Al recibir un check-in exitoso: loguear al guardia (una sola vez).
  useEffect(() => {
    if (!result?.ok || result.action !== 'check_in' || loggedInRef.current) return;
    loggedInRef.current = true;

    (async () => {
      await login(result.staff, result.token);
      connectSocket(result.token);
      try {
        const { status: permStatus } = await Notifications.requestPermissionsAsync();
        if (permStatus === 'granted') {
          const t = await Notifications.getExpoPushTokenAsync({
            projectId: Constants.expoConfig?.extra?.eas?.projectId,
          });
          registerPushToken(t.data);
        }
      } catch {}
    })();
  }, [result]);

  function startAnimations() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineY, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(scanLineY, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();

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

  // ── Sin permiso ───────────────────────────────────────────────────────
  if (!hasPermission) {
    return (
      <View style={styles.centeredView}>
        <Ionicons name="camera-outline" size={64} color={COLORS.accent} />
        <Text style={styles.permTitle}>Permiso de cámara requerido</Text>
        <Text style={styles.permSub}>Necesitamos acceso para el reconocimiento facial</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Dar permiso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.centeredView}>
        <Ionicons name="camera-outline" size={64} color={COLORS.accent} />
        <Text style={styles.permTitle}>Cámara no disponible</Text>
      </View>
    );
  }

  const isCheckIn  = result?.ok && result.action === 'check_in';
  const isCheckOut = result?.ok && result.action === 'check_out';
  const isDone     = isCheckIn || isCheckOut;
  const isProcessing = status === SCAN_STATUS.PROCESSING;

  const borderColor = isCheckIn ? COLORS.success
    : isCheckOut ? COLORS.info
    : result && !result.ok ? COLORS.danger
    : COLORS.accent;

  const scanLineTranslate = scanLineY.interpolate({
    inputRange: [0, 1],
    outputRange: [-(OVAL_H / 2 - 12), OVAL_H / 2 - 12],
  });

  const guideText = isDone
    ? (isCheckIn ? '✅ Ingreso registrado' : '👋 Salida registrada')
    : isProcessing
    ? 'Procesando...'
    : result && !result.ok
    ? (result.message || 'Rostro no reconocido')
    : 'Posicioná tu rostro en el óvalo';

  return (
    <View style={styles.container}>
      {!isDone && (
        <FaceScannerCamera
          cameraRef={cameraRef}
          device={device}
          format={format}
          isActive={isFocused && !isDone}
          paused={status !== SCAN_STATUS.WAITING}
          onFacesDetected={onFacesDetected}
        />
      )}

      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={COLORS.white} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>Reconocimiento Facial</Text>
          <Animated.View style={[styles.autoPill, { opacity: ovalOpacity }]}>
            <View style={styles.autoLed} />
            <Text style={styles.autoText}>AUTO</Text>
          </Animated.View>
        </View>

        <View style={styles.center} pointerEvents="none">
          <Animated.View
            style={[styles.oval, { borderColor, transform: [{ scale: ovalScale }], opacity: ovalOpacity }]}
          >
            {[styles.cTL, styles.cTR, styles.cBL, styles.cBR].map((pos, i) => (
              <View key={i} style={[styles.corner, pos, { borderColor }]} />
            ))}

            {!isDone && !isProcessing && (
              <Animated.View style={[styles.scanLine, { transform: [{ translateY: scanLineTranslate }] }]} />
            )}

            {isDone && (
              <View style={styles.doneIconWrap}>
                <Ionicons name={isCheckIn ? 'checkmark-circle' : 'log-out-outline'} size={60} color={borderColor} />
              </View>
            )}
          </Animated.View>

          <Text style={styles.guideText}>{guideText}</Text>
        </View>

        {isDone && result && (
          <Animated.View
            style={[styles.resultBanner, { opacity: resultOpacity }, isCheckIn ? styles.bannerIn : styles.bannerOut]}
            pointerEvents="none"
          >
            <Ionicons name={isCheckIn ? 'log-in-outline' : 'log-out-outline'} size={24} color={COLORS.white} />
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerLabel}>{isCheckIn ? 'INGRESO' : 'SALIDA'}</Text>
              <Text style={styles.bannerName}>
                {result.staff ? `${result.staff.firstName} ${result.staff.lastName}` : result.message}
              </Text>
              {result.time && (
                <Text style={styles.bannerTime}>
                  {new Date(result.time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              )}
              {result.delayMinutes > 0 && (
                <Text style={styles.bannerDelay}>+{result.delayMinutes} min tarde</Text>
              )}
            </View>
          </Animated.View>
        )}

        <View style={styles.footer}>
          {isCheckOut ? (
            <TouchableOpacity
              style={styles.homeBtn}
              onPress={() => (user ? logout() : navigation.navigate('RoleSelect'))}
            >
              <Ionicons name="home-outline" size={18} color={COLORS.primary} />
              <Text style={styles.homeBtnText}>Volver al inicio</Text>
            </TouchableOpacity>
          ) : !isDone ? (
            <>
              <ScanDots active={status === SCAN_STATUS.WAITING} />
              <Text style={styles.scanningLabel}>
                {status === SCAN_STATUS.WAITING ? 'Escaneando automáticamente...' : 'Procesando...'}
              </Text>
              <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('SecurityRegister')}>
                <Text style={styles.registerLinkText}>¿Primera vez? Registrate aquí</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function Dot({ delay, active }) {
  const anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (!active) {
      anim.setValue(0.3);
      return undefined;
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

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 28 },

  oval: {
    width: OVAL_W, height: OVAL_H, borderRadius: OVAL_W / 2,
    borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
  },

  corner: { position: 'absolute', width: 26, height: 26 },
  cTL: { top: 8,    left: 8,    borderTopWidth: 3,    borderLeftWidth: 3,    borderTopLeftRadius: 5 },
  cTR: { top: 8,    right: 8,   borderTopWidth: 3,    borderRightWidth: 3,   borderTopRightRadius: 5 },
  cBL: { bottom: 8, left: 8,    borderBottomWidth: 3, borderLeftWidth: 3,    borderBottomLeftRadius: 5 },
  cBR: { bottom: 8, right: 8,   borderBottomWidth: 3, borderRightWidth: 3,   borderBottomRightRadius: 5 },

  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: 'rgba(252,211,77,0.5)',
    shadowColor: COLORS.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 4,
  },

  doneIconWrap: { justifyContent: 'center', alignItems: 'center' },

  guideText: {
    fontSize: 14, fontWeight: '500', color: 'rgba(255,255,255,0.8)',
    textAlign: 'center', paddingHorizontal: 32,
  },

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
