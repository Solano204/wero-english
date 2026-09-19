module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: { '@': './src', '@data': './assets/data' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      // Reanimated 4 usa react-native-worklets. Este plugin va SIEMPRE
      // al final de la lista: si va antes de otro, no ve el código ya
      // transformado y las animaciones fallan en silencio.
      'react-native-worklets/plugin',
    ],
  };
};
