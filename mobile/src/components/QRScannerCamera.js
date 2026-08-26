import React from 'react';
import { StyleSheet } from 'react-native';
import { Camera } from 'react-native-vision-camera';

/**
 * Cámara para escanear códigos QR — usa el `codeScanner` nativo que ya
 * trae react-native-vision-camera desde v3 (sin dependencia nueva), a
 * diferencia de FaceScannerCamera que usa el paquete de detección facial
 * (react-native-vision-camera-face-detector) para su frame processor.
 *
 * Cámara trasera a propósito: acá es el VISITANTE quien muestra el QR a la
 * cámara del guardia, al revés del escaneo facial (cámara frontal, el
 * guardia se apunta a sí mismo).
 */
export default function QRScannerCamera({ device, isActive, codeScanner, style }) {
  return (
    <Camera
      style={style || StyleSheet.absoluteFill}
      device={device}
      isActive={isActive}
      codeScanner={codeScanner}
    />
  );
}
