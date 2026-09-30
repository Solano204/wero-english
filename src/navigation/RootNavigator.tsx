import React, { useEffect } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TabNavigator } from './TabNavigator';
import { navigate, navigationRef } from './navigationRef';
import { NOTIF_TARGETS, type RootStackParams } from './routes';
// Solo lo del arranque se importa aquí: el resto de las pantallas se evalúa la
// primera vez que se abre (ver `diferida`), no en el arranque en frío.
import { AuthScreen } from '@/screens/entry/AuthScreen';
import { BootScreen } from '@/screens/entry/BootScreen';
import { useAuthStore, useSettingsStore } from '@/store';
import * as music from '@/services/music';
import { precargarDistractores } from '@/db/queries';
import * as notifications from '@/services/notifications';
import { color, motionDuration } from '@/theme';

const Stack = createNativeStackNavigator<RootStackParams>();

/** Cuánto después de entrar se precarga lo de Estudiar: pasada la entrada de Practicar. */
const PRECARGA_MS = 2500;

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

  // Ya dentro y con Practicar pintado, se prepara en segundo plano lo que Estudiar va a pedir.
  useEffect(() => {
    if (status !== 'signed') return;
    const t = setTimeout(precargarDistractores, PRECARGA_MS);
    return () => clearTimeout(t);
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
        <Stack.Screen name="LegalDoc" getComponent={() => require('@/screens/utility/LegalDocScreen').LegalDocScreen} />
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
        <Stack.Screen name="Onboarding" getComponent={() => require('@/screens/entry/OnboardingScreen').OnboardingScreen} />
        <Stack.Screen name="LegalDoc" getComponent={() => require('@/screens/utility/LegalDocScreen').LegalDocScreen} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator screenOptions={SCREEN_OPTIONS}>
      <Stack.Screen name="Main" component={TabNavigator} />

      {/* La sesión entra desde abajo: se siente como entrar a un modo,
          no como navegar a otra sección. */}
      <Stack.Group screenOptions={{ animation: 'slide_from_bottom' }}>
        <Stack.Screen name="Study" getComponent={() => require('@/screens/study/StudyScreen').StudyScreen} />
        <Stack.Screen name="EarMode" getComponent={() => require('@/screens/extras/EarModeScreen').EarModeScreen} />
        <Stack.Screen name="Cazala" getComponent={() => require('@/screens/games/CazalaScreen').CazalaScreen} />
        <Stack.Screen name="Colmena" getComponent={() => require('@/screens/games/ColmenaScreen').ColmenaScreen} />
        <Stack.Screen name="Pares" getComponent={() => require('@/screens/games/ParesScreen').ParesScreen} />
        <Stack.Screen name="Caida" getComponent={() => require('@/screens/games/CaidaScreen').CaidaScreen} />
        <Stack.Screen name="Dulces" getComponent={() => require('@/screens/games/DulcesScreen').DulcesScreen} />
        <Stack.Screen
          name="GameEnd"
          getComponent={() => require('@/screens/games/GameEndScreen').GameEndScreen}
          // Pares cierra su tablero con una ola de luz: el resumen entra con un fundido en vez de subir desde abajo.
          options={({ route }) => ({
            gestureEnabled: false,
            ...(route.params?.juego === 'pares' ? { animation: 'fade' as const, animationDuration: motionDuration.lento } : null),
          })}
        />
        <Stack.Screen name="MinimalPairs" getComponent={() => require('@/screens/extras/MinimalPairsScreen').MinimalPairsScreen} />
      </Stack.Group>

      <Stack.Screen name="Detail" getComponent={() => require('@/screens/discover/DetailScreen').DetailScreen} />
      <Stack.Screen name="PackDetail" getComponent={() => require('@/screens/discover/PackDetailScreen').PackDetailScreen} />
      <Stack.Screen name="WorldDetail" getComponent={() => require('@/screens/discover/WorldDetailScreen').WorldDetailScreen} />
      <Stack.Screen name="Pronunciation" getComponent={() => require('@/screens/extras/PronunciationScreen').PronunciationScreen} />
      <Stack.Screen name="Contractions" getComponent={() => require('@/screens/extras/ContractionsScreen').ContractionsScreen} />
      <Stack.Screen name="Errors" getComponent={() => require('@/screens/extras/ErrorsScreen').ErrorsScreen} />
      <Stack.Screen name="ErrorDetail" getComponent={() => require('@/screens/extras/ErrorDetailScreen').ErrorDetailScreen} />
      <Stack.Screen name="Downloads" getComponent={() => require('@/screens/utility/DownloadsScreen').DownloadsScreen} />
      <Stack.Screen name="Settings" getComponent={() => require('@/screens/utility/SettingsScreen').SettingsScreen} />
      <Stack.Screen name="LegalDoc" getComponent={() => require('@/screens/utility/LegalDocScreen').LegalDocScreen} />
      <Stack.Screen name="Borrar" getComponent={() => require('@/screens/utility/BorrarScreen').BorrarScreen} />
      <Stack.Screen name="Stuck" getComponent={() => require('@/screens/utility/StuckScreen').StuckScreen} />
      <Stack.Screen name="Deck" getComponent={() => require('@/screens/utility/DeckScreen').DeckScreen} />
      <Stack.Screen name="Niveles" getComponent={() => require('@/screens/games/NivelesScreen').NivelesScreen} />
      <Stack.Screen name="Gramatica" getComponent={() => require('@/screens/extras/GramaticaScreen').GramaticaScreen} />
      <Stack.Screen name="GramaticaTema" getComponent={() => require('@/screens/extras/GramaticaTemaScreen').GramaticaTemaScreen} />
      <Stack.Screen name="Phrasal" getComponent={() => require('@/screens/extras/PhrasalScreen').PhrasalScreen} />
      {/* El verbo viaja del renglón a su título: la pantalla entra con un fundido y ese vuelo es la transición. */}
      <Stack.Screen
        name="PhrasalVerbo"
        getComponent={() => require('@/screens/extras/PhrasalVerboScreen').PhrasalVerboScreen}
        options={{ animation: 'fade', animationDuration: motionDuration.lento }}
      />
      <Stack.Screen name="Azar" getComponent={() => require('@/screens/extras/AzarScreen').AzarScreen} />
      <Stack.Screen name="Lecturas" getComponent={() => require('@/screens/extras/LecturasScreen').LecturasScreen} />
      <Stack.Screen name="Lectura" getComponent={() => require('@/screens/extras/LecturaScreen').LecturaScreen} />
      <Stack.Screen name="Diagnostics" getComponent={() => require('@/screens/utility/DiagnosticsScreen').DiagnosticsScreen} />
      {__DEV__ ? <Stack.Screen name="SfxSampler" getComponent={() => require('@/screens/utility/SfxSamplerScreen').SfxSamplerScreen} /> : null}
    </Stack.Navigator>
  );
}

const SCREEN_OPTIONS = {
  headerShown: false,
  contentStyle: { backgroundColor: color.bg },
  animation: 'slide_from_right',
} as const;

export { navigationRef };
