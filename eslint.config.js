/**
 * ESLint de Wero (config plana).
 *
 *  - react-hooks: rules-of-hooks y exhaustive-deps como error.
 *  - react-compiler: en advertencia, para ver qué rompe las reglas del React Compiler (se corrige en el
 *    prompt 4 de la serie de rendimiento).
 *  - Sin imports sin usar.
 *  - Sin console fuera de __DEV__, salvo console.error (el único que queda en producción: ver babel.config.js).
 *  - Sin Touchable* ni el Button nativo: todo lo que se toca pasa por Presionable.
 *
 * Las reglas de capas (qué puede importar a qué) las revisan `npm run check:imports` y `npm run check:capas`.
 */
const tseslint = require('typescript-eslint');
const reactHooks = require('eslint-plugin-react-hooks');
const reactCompiler = require('eslint-plugin-react-compiler');
const unusedImports = require('eslint-plugin-unused-imports');

/** Una llamada a console.* que no sea console.error y no esté dentro de `if (__DEV__)` ni de `__DEV__ && …`. */
const CONSOLE_FUERA_DE_DEV =
  "CallExpression[callee.object.name='console'][callee.property.name!='error']" +
  ":not(IfStatement[test.name='__DEV__'] CallExpression)" +
  ":not(LogicalExpression[left.name='__DEV__'] CallExpression)";

module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'android/**',
      'ios/**',
      'dist/**',
      '.expo/**',
      'scripts/**',
      'plugins/**',
      'modules/**',
      'assets/**',
      'docs/**',
      'src/assets/bundled.ts',
      '*.config.js',
      'index.js',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': reactHooks,
      'react-compiler': reactCompiler,
      'unused-imports': unusedImports,
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react-compiler/react-compiler': 'warn',
      'unused-imports/no-unused-imports': 'error',
      // Todo lo que se toca pasa por `Presionable` (o `Pressable`): los Touchable* no dan el feedback en el hilo de UI
      // y dejan de responder mientras el hilo de JS está ocupado. Ni los de React Native ni los de gesture-handler.
      'no-restricted-imports': [
        'error',
        {
          paths: ['react-native', 'react-native-gesture-handler'].map((name) => ({
            name,
            importNames: ['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback', 'Button'],
            message: 'Usa Presionable (src/shared/ui/Presionable) o el Button de shared/ui.',
          })),
        },
      ],
      'no-restricted-syntax': [
        'error',
        { selector: CONSOLE_FUERA_DE_DEV, message: 'console fuera de __DEV__ (solo console.error queda en producción).' },
      ],
    },
  }
);
