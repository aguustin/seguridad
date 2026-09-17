// Reemplaza a app.json — necesario para poder leer la clave de Google Maps
// desde una variable de entorno (.env.local en local, variable de entorno
// de EAS en el build en la nube) en vez de tenerla hardcodeada en un
// archivo que se sube a git.
require('dotenv').config({ path: '.env.local' });

module.exports = {
  expo: {
    name: 'Seguridad Barrios',
    slug: 'securityn',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    assetBundlePatterns: ['**/*'],
    ios: {
      supportsTablet: false,
      bundleIdentifier: 'com.seguridad.barrios',
      infoPlist: {
        NSCameraUsageDescription: 'Seguridad Barrios necesita la cámara para reconocimiento facial',
        NSLocationWhenInUseUsageDescription: 'Necesitamos tu ubicación para el seguimiento de seguridad.',
        NSLocationAlwaysAndWhenInUseUsageDescription: 'Necesitamos tu ubicación en segundo plano para el seguimiento continuo de guardias en turno.',
        UIBackgroundModes: ['location'],
      },
      // react-native-maps en iOS usa Apple Maps por defecto y no necesita
      // clave — si en algún momento se quiere forzar Google Maps en iOS
      // también, va acá: config.googleMapsApiKey.
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#1a1a2e',
      },
      package: 'com.seguridad.barrios',
      permissions: [
        'CAMERA',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'ACCESS_FINE_LOCATION',
        'ACCESS_COARSE_LOCATION',
        'ACCESS_BACKGROUND_LOCATION',
        'FOREGROUND_SERVICE',
        'FOREGROUND_SERVICE_LOCATION',
        'RECEIVE_BOOT_COMPLETED',
        'VIBRATE',
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.ACCESS_FINE_LOCATION',
      ],
      // Requerido por react-native-maps en Android — sin esto el mapa
      // crashea al montarse (ver diagnóstico: afecta NeighborhoodsScreen,
      // AdminMapScreen y PatrolRouteCheckpointsScreen). Viene de
      // GOOGLE_MAPS_API en .env.local (local) / variable de entorno de EAS
      // (build en la nube) — nunca hardcodeada acá.
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API,
        },
      },
    },
    plugins: [
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission: 'Necesitamos tu ubicación en segundo plano para el seguimiento continuo de guardias en turno.',
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
      [
        'react-native-vision-camera',
        {
          cameraPermissionText: 'Seguridad Barrios necesita la cámara para reconocimiento facial',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#c0392b',
          sounds: ['./assets/alert.wav'],
        },
      ],
      'expo-font',
      [
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          resizeMode: 'contain',
          backgroundColor: '#1a1a2e',
        },
      ],
      [
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 26,
          },
        },
      ],
    ],
    extra: {
      eas: {
        // OJO: este es el ID del PROYECTO en EAS (fijo), no el de un build
        // puntual — se confundieron en algún momento y quedó pisado con un
        // build ID, lo que rompe cualquier `eas build`/`eas update` futuro
        // con mismatch de proyecto. Verificado con `eas project:info`.
        projectId: '5319b878-930c-4e2c-9a3b-8babde115886',
      },
    },
    owner: 'agustin1994',
  },
};
