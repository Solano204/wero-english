module.exports = function (api) {
  // En producción (export y builds release) se quitan los console.* del bundle, menos
  // console.error: los avisos de diagnóstico cuestan en el hilo de JS y en release nadie los lee.
  // api.env() ya registra el entorno en la caché de Babel.
  const produccion = api.env('production');
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: { '@': './src', '@data': './assets/data', '@assets': './assets', '@modules': './modules' },
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      ],
      ...(produccion ? [['transform-remove-console', { exclude: ['error'] }]] : []),
      // Reanimated 4 usa react-native-worklets. Este plugin va SIEMPRE
      // al final de la lista: si va antes de otro, no ve el código ya
      // transformado y las animaciones fallan en silencio.
      'react-native-worklets/plugin',
    ],
  };
};
