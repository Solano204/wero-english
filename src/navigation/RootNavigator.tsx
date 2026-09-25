import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { navigate, navigationRef } from './navigationRef';
import { NOTIF_TARGETS, type RootStackParams } from './routes';
import {
  AuthScreen,
  BootScreen,
  CaidaScreen,
  CazalaScreen,
  ColmenaScreen,
  DulcesScreen,
  ContractionsScreen,
  DeckScreen,
  DetailScreen,
  DiagnosticsScreen,
  DownloadsScreen,
  EarModeScreen,
  ErrorDetailScreen,
  ErrorsScreen,
  GameEndScreen,
  GramaticaScreen,
  GramaticaTemaScreen,
  LecturaScreen,
  LecturasScreen,
  AzarScreen,
  MinimalPairsScreen,
  NivelesScreen,
  OnboardingScreen,
  PackDetailScreen,
  ParesScreen,
  PhrasalScreen,
  PronunciationScreen,
  SettingsScreen,
  StudyScreen,
  StuckScreen,
  WorldDetailScreen,
} from '@/screens';
import { useAuthStore, useSettingsStore } from '@/store';
import * as music from '@/services/music';
import * as notifications from '@/services/notifications';
import { color, motionDuration } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParams>();

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const onboardingHecho = useSettingsStore((s) => s.onboardingHecho);

  // Al tocar una notificación se abre la pantalla que dice abre_en.
  useEffect(() => {
    return notifications.onNotificationTap((abreEn) => {
      const target = NOTIF_TARGETS[abreEn] ?? 'Main';
      navigate(target, undefined);
    });
  }, []);

  // Arranca UNA vez, en cuanto se sale de Boot. Cada pantalla declara
  // su propia pista con useMusicaPantalla; esto solo prende el motor.
  useEffect(() => {
    if (status === 'booting') return;
    void music.iniciar();
  }, [status]);

  if (status === 'booting') {
    return (
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="Boot" component={BootScreen} />
      </Stack.Navigator>
    );
  }

  if (status === 'anon') {
    return (
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="Auth" component={AuthScreen} />
      </Stack.Navigator>
    );
  }

  // El onboarding va aquí y no dentro de las pestañas: mientras no se
  // conteste (o se salte) no debe existir barra inferior ni forma de
  // navegar a otro lado. Se espera a que carguen los ajustes para no
  // mostrarlo un instante a quien ya lo contestó.
  if (status === 'signed' && settingsLoaded && !onboardingHecho) {
    return (
      <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="Main" component={TabNavigator} />

      {/* La sesión entra desde abajo: se siente como entrar a un modo,
          no como navegar a otra sección. */}
      <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
        <Stack.Screen name="Study" component={StudyScreen} />
        <Stack.Screen name="EarMode" component={EarModeScreen} />
        <Stack.Screen name="Cazala" component={CazalaScreen} />
        <Stack.Screen name="Colmena" component={ColmenaScreen} />
        <Stack.Screen name="Pares" component={ParesScreen} />
        <Stack.Screen name="Caida" component={CaidaScreen} />
        <Stack.Screen name="Dulces" component={DulcesScreen} />
        <Stack.Screen
          name="GameEnd"
          component={GameEndScreen}
          // Pares cierra su tablero con una ola de luz: el resumen entra con un fundido en vez de subir desde abajo.
          options={({ route }) => ({
            gestureEnabled: false,
            ...(route.params?.juego === 'pares' ? { animation: 'fade' as const, animationDuration: motionDuration.lento } : null),
          })}
        />
        <Stack.Screen name="MinimalPairs" component={MinimalPairsScreen} />
      </Stack.Group>

      <Stack.Screen name="Detail" component={DetailScreen} />
      <Stack.Screen name="PackDetail" component={PackDetailScreen} />
      <Stack.Screen name="WorldDetail" component={WorldDetailScreen} />
      <Stack.Screen name="Pronunciation" component={PronunciationScreen} />
      <Stack.Screen name="Contractions" component={ContractionsScreen} />
      <Stack.Screen name="Errors" component={ErrorsScreen} />
      <Stack.Screen name="ErrorDetail" component={ErrorDetailScreen} />
      <Stack.Screen name="Downloads" component={DownloadsScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Stuck" component={StuckScreen} />
      <Stack.Screen name="Deck" component={DeckScreen} />
      <Stack.Screen name="Niveles" component={NivelesScreen} />
      <Stack.Screen name="Gramatica" component={GramaticaScreen} />
      <Stack.Screen name="GramaticaTema" component={GramaticaTemaScreen} />
      <Stack.Screen name="Phrasal" component={PhrasalScreen} />
      <Stack.Screen name="Azar" component={AzarScreen} />
      <Stack.Screen name="Lecturas" component={LecturasScreen} />
      <Stack.Screen name="Lectura" component={LecturaScreen} />
      <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} />
    </Stack.Navigator>
  );
}

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: color.bg },
  animation: 'slide_from_right',
} as const;

export { navigationRef };
