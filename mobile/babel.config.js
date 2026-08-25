module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-worklets-core: requerido por el frame processor de
    // detección facial (react-native-vision-camera-face-detector). Debe ir
    // último en la lista de plugins.
    plugins: ['react-native-worklets-core/plugin'],
  };
};
