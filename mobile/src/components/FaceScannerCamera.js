import React from 'react';
import { StyleSheet } from 'react-native';
import { Camera as FaceDetectionCamera } from 'react-native-vision-camera-face-detector';
import { FACE_DETECTION_OPTIONS } from '../hooks/useFaceScanner';

/**
 * Cámara con detección facial local (ML Kit vía react-native-vision-camera).
 * Es el único punto del proyecto que toca la API de vision-camera —
 * cualquier pantalla de escaneo la usa a través de esto + useFaceScanner.
 *
 * La detección corre en el device (frame processor); el componente padre
 * decide qué hacer cuando hay una cara estable (ver useFaceScanner).
 */
export default function FaceScannerCamera({
  cameraRef,
  device,
  format,
  isActive,
  onFacesDetected,
  paused,
  style,
}) {
  return (
    <FaceDetectionCamera
      ref={cameraRef}
      style={style || StyleSheet.absoluteFill}
      device={device}
      format={format}
      isActive={isActive}
      photo
      pixelFormat="yuv"
      faceDetectionOptions={FACE_DETECTION_OPTIONS}
      // Mientras `paused` es true (procesando / mostrando resultado /
      // cooldown) se ignoran las detecciones — evita procesar la misma
      // cara de nuevo mientras todavía se está resolviendo el escaneo
      // anterior.
      faceDetectionCallback={paused ? () => {} : onFacesDetected}
    />
  );
}
