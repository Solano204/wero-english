import React, { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { RootNavigator } from '@/app/navegacion/RootNavigator';
import { navTheme } from '@/app/navegacion/temaNavegacion';
import { navigationRef } from '@/shared/navegacion/navigationRef';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { TransicionHoy } from '@/app/navegacion/TransicionHoy';
import { useBarraOculta } from '@/app/arranque/useBarraOculta';
import { OCULTAR_BARRA_ESTADO } from '@/config/pantalla';
import * as audio from '@/services/audio';
import { color, tema } from '@/theme';
import { marcar } from '@/shared/utils/marcasArranque';
import { vaciarConMemoriaBaja } from '@/services/memoria';

marcar('app');
void SplashScreen.preventAutoHideAsync();

export default function App() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const loadSettings = useSettingsStore((s) => s.load);
  const rutaPrevia = useRef<string | undefined>(undefined);
  useBarraOculta();

  // El splash se esconde cuando el arranque terminó (base, catálogo y sesión), no cuando React montó: si se
  // esconde antes, se ve un parpadeo negro. Las fuentes ya vienen dentro del APK (plugin de expo-font en
  // app.json): no hay que esperarlas.
  useEffect(() => {
    if (status !== 'booting') void SplashScreen.hideAsync().then(() => marcar('splash'), () => undefined);
  }, [status]);

  // Los ajustes se cargan al entrar y al cambiar de usuario.
  useEffect(() => {
    if (user) void loadSettings(user.id);
  }, [user, loadSettings]);

  // Al pasar a segundo plano se corta todo el audio. Al volver no se
  // reanuda nada solo: lo que tenga su propio "Reanudar" (Modo oído en
  // pausa) sigue ahí, pero el usuario decide cuándo seguir.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') audio.detenerTodo();
    });
    return () => sub.remove();
  }, []);

  // Con poca memoria se sueltan las cachés que se vuelven a armar solas (services/memoria.ts).
  useEffect(() => vaciarConMemoriaBaja(), []);

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
              // Cualquier cambio de ruta (pantalla nueva encima, atrás, el
              // gesto de atrás o cambio de pestaña) corta TODO el audio antes
              // de que la pantalla que entra reproduzca lo suyo: el corte va
              // primero, el play automático de la nueva (p. ej. la primera
              // tarjeta de Estudio) sigue sonando después, sin competir.
              if (actual !== previa) audio.detenerTodo();
              rutaPrevia.current = actual;
            }}
          >
            <StatusBar hidden={OCULTAR_BARRA_ESTADO} style={tema.claro ? 'dark' : 'light'} />
            <RootNavigator />
            <TransicionHoy />
          </NavigationContainer>
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
