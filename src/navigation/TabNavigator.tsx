import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { ExploreScreen } from '@/screens/discover';
import { PracticeScreen } from '@/screens/extras';
import { ProgressScreen } from '@/screens/utility';
import { color, duration, filoLuz, font, radius, shadow, sol, space } from '@/theme';
import { AdBar } from '@/components/base';
import { useMovimientoReducido } from '@/utils';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParams } from './routes';

const Tab = createBottomTabNavigator<MainTabParams>();

/**
 * Tres pestañas y ni una más.
 *
 * Se quitó "Hoy". Era la pantalla del plan diario, y sin plan diario ya
 * no le quedaba trabajo propio: su tarjeta de sesión vive ahora en
 * Practicar, arriba de todo, que es donde la gente la busca.
 *
 * Los iconos son glifos de texto en vez de una librería de iconos:
 * lucide o vector-icons agregan unos 400 KB al bundle por cuatro
 * símbolos. Si más adelante se necesita un set completo, se cambia.
 */
const GLYPH: Record<keyof MainTabParams, string> = {
  Explore: '◎',
  Practice: '◈',
  Progress: '▲',
};

/**
 * Icono de pestaña.
 *
 * La pestaña activa recibe una pastilla de cian que crece por detrás del
 * glifo. Un cambio de color solo se nota poco sobre tinta; la pastilla se
 * ve de reojo y dice dónde estás sin tener que leer la etiqueta.
 *
 * La animación corre en el hilo de UI con reanimated, igual que la del
 * botón, para que no se trabe mientras la pantalla nueva está montando.
 */
function Icono({ glifo, activo, tint }: { glifo: string; activo: boolean; tint: string }) {
  const v = useSharedValue(activo ? 1 : 0);
  const reducido = useMovimientoReducido();

  useEffect(() => {
    v.value = withTiming(activo ? 1 : 0, {
      duration: reducido ? 0 : duration.fast,
      easing: Easing.bezier(0.2, 0.7, 0.3, 1),
    });
  }, [activo, v, reducido]);

  const pastilla = useAnimatedStyle(() => ({
    opacity: v.value,
    transform: [{ scale: 0.6 + v.value * 0.4 }],
  }));

  const simbolo = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + v.value * 0.12 }],
  }));

  return (
    <View style={styles.icon}>
      <Animated.View style={[styles.pastilla, pastilla]} />
      <Animated.Text style={[styles.glyph, { color: tint }, simbolo]}>
        {glifo}
      </Animated.Text>
    </View>
  );
}

/**
 * Fondo de la barra.
 *
 * Aquí sí vale el desenfoque: el contenido pasa por detrás al hacer
 * scroll y es justo eso lo que da la sensación de capa flotante. Encima
 * lleva un velo de tinta para que los glifos no compitan con lo que
 * pasa abajo, y el mismo filo de luz que las tarjetas.
 */
function FondoBarra() {
  return (
    <LinearGradient
      colors={filoLuz}
      start={sol.start}
      end={sol.end}
      style={styles.filo}
    >
      <View style={styles.filoInterior}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.veloBarra]} />
      </View>
    </LinearGradient>
  );
}

export function TabNavigator() {
  const insets = useSafeAreaInsets();
  /*
   * La barra de anuncios va DEBAJO del navegador y ya absorbe el inset
   * del teléfono, así que aquí no hace falta sumarlo otra vez: lo único
   * que se necesita es aire entre las dos barras para que no se lean
   * como una sola franja pegada.
   */
  const abajo = space.md;

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Tab.Navigator
      initialRouteName="Practice"
      screenOptions={({ route }) => ({
        headerShown: false,
        // La barra flota: se despega de los bordes y deja ver el
        // contenido desenfocado por detrás. Pegada al borde aplastaba la
        // pantalla; flotando, la app respira.
        tabBarStyle: [styles.bar, { bottom: abajo }],
        tabBarBackground: () => <FondoBarra />,
        tabBarActiveTintColor: color.accent,
        tabBarInactiveTintColor: color.textFaint,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarIcon: ({ color: tint, focused }) => (
          <Icono glifo={GLYPH[route.name]} activo={focused} tint={tint} />
        ),
      })}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{ title: 'Vocabulario' }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{ title: 'Practicar' }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{ title: 'Progreso' }}
      />
      </Tab.Navigator>

      {/* La barra va DEBAJO del tab bar, nunca encima. Tapar la
          navegación con un anuncio es de las formas más rápidas de
          perder a alguien. */}
      <AdBar bottomInset={insets.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    height: 68,
    borderTopWidth: 0,
    borderRadius: radius.lg,
    backgroundColor: 'transparent',
    ...shadow.card,
    elevation: 0,
    paddingBottom: 10,
    paddingTop: 10,
  },
  filo: { flex: 1, borderRadius: radius.lg, padding: 1 },
  filoInterior: {
    flex: 1,
    borderRadius: radius.lg - 1,
    overflow: 'hidden',
  },
  veloBarra: { backgroundColor: color.veloBarra },
  label: {
    fontSize: font.size.xs,
    fontFamily: font.family.bodyStrong,
    marginTop: 2,
  },
  item: { paddingTop: 2 },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 28,
  },
  pastilla: {
    position: 'absolute',
    width: 54,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.accentSoft,
    borderWidth: 1,
    borderColor: color.accentBorde,
  },
  glyph: { fontFamily: font.family.body, fontSize: 17 },
});
