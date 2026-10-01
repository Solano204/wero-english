module.exports = function (api) {
  // En producción (export y builds release) se quitan los console.* del bundle, menos
  // console.error: los avisos de diagnóstico cuestan en el hilo de JS y en release nadie los lee.
  // api.env() ya registra el entorno en la caché de Babel.
  const produccion = api.env('production');
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          'react-compiler': {
            // El React Compiler «saca» a nivel de módulo (`function _temp…`) las funciones que no usan nada del
            // componente. Si esa función era el callback de una animación anidada dentro de un worklet, deja de
            // ser worklet y Reanimated la llama en el hilo de UI: «[Worklets] Tried to synchronously call a Remote
            // Function» (el crash al entrar a Estudio por HOY y al volver de segundo plano). Sin outlining las
            // funciones se quedan donde están y el plugin de worklets las convierte. check:worklets lo vigila.
            //
            // `environment` reemplaza entero al que arma babel-preset-expo (lo esparce después), así que se repite
            // su única opción: reiniciar la caché al editar un archivo, solo en desarrollo.
            environment: {
              enableFunctionOutlining: false,
              enableResetCacheOnSourceFileChanges: !produccion,
            },
          },
        },
      ],
    ],
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
