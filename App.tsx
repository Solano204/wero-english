import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { RootNavigator, navTheme, navigationRef } from '@/navigation';
import { useAuthStore, useSettingsStore } from '@/store';
import { ErrorBoundary } from '@/components/base/ErrorBoundary';
import { TransicionHoy } from '@/components/fx';
import * as audio from '@/services/audio';
import { color, fuentes } from '@/theme';

void SplashScreen.preventAutoHideAsync();

/** Rutas de la sección Lecturas: salir de ellas corta la voz de frase. */
const RUTAS_LECTURAS = new Set(['Lecturas', 'Lectura']);

export default function App() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const loadSettings = useSettingsStore((s) => s.load);
  const rutaPrevia = useRef<string | undefined>(undefined);
  const [fuentesCargadas, fuentesError] = useFonts(fuentes);
  // Si una fuente falla, la app arranca con la del sistema en vez de quedarse en el splash.
  const fuentesListas = fuentesCargadas || fuentesError !== null;

  // El splash se esconde cuando el arranque terminó y las fuentes están
  // listas, no cuando React montó: si se esconde antes, se ve un parpadeo
  // negro y luego el salto de fuente.
  useEffect(() => {
    if (status !== 'booting' && fuentesListas) void SplashScreen.hideAsync();
  }, [status, fuentesListas]);

  // Los ajustes se cargan al entrar y al cambiar de usuario.
  useEffect(() => {
    if (user) void loadSettings(user.id);
  }, [user, loadSettings]);

  if (!fuentesListas) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: color.bg }}>
      <SafeAreaProvider>
        <ErrorBoundary>
          <NavigationContainer
            ref={navigationRef}
            theme={navTheme}
            onReady={() => {
              rutaPrevia.current = navigationRef.getCurrentRoute()?.name;
            }}
            onStateChange={() => {
              const actual = navigationRef.getCurrentRoute()?.name;
              const previa = rutaPrevia.current;
              if (
                previa &&
                RUTAS_LECTURAS.has(previa) &&
                (!actual || !RUTAS_LECTURAS.has(actual))
              ) {
                audio.stop();
              }
              rutaPrevia.current = actual;
            }}
          >
            <StatusBar style="light" />
            <RootNavigator />
            <TransicionHoy />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
