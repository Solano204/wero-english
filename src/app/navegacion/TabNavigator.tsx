import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  BottomTabBar,
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming } from 'react-native-reanimated';
import { PracticeScreen } from '@/features/practicar/screens/PracticeScreen';
import { color, filoLuz, font, radius, shadow, sol, space, motionDuration, motionEasing } from '@/theme';
import { AdBar, Icon, Presionable, type IconName } from '@/shared/ui';
import { PildoraLiquida } from '@/app/navegacion/PildoraLiquida';
import * as haptics from '@/services/haptics';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MainTabParams } from '@/types/rutas';

const Tab = createBottomTabNavigator<MainTabParams>();

/**
 * Tres pestañas y ni una más.
 *
 * Se quitó "Hoy". Era la pantalla del plan diario, y sin plan diario ya
 * no le quedaba trabajo propio: su tarjeta de sesión vive ahora en
 * Practicar, arriba de todo, que es donde la gente la busca.
 *
 * Los íconos salen de `Icon`, el mismo set de toda la app. La pestaña
 * activa cambia de color (acento), no de ícono.
 */
const ICONO: Record<keyof MainTabParams, IconName> = {
  Explore: 'explore',
  Practice: 'practice',
  Progress: 'progress',
};

/** Las pestañas en el orden en que se dibujan: el índice que la barra reporta como activo. */
const ORDEN_PESTANAS: string[] = Object.keys(ICONO);

/** Cada pestaña presiona igual que el resto de la app, sin el ripple de Android que traen las props. */
function BotonPestana({ href: _href, onPress, ...props }: BottomTabBarButtonProps) {
  return (
    <Presionable
      {...props}
      android_ripple={null}
      onPress={(e) => {
        // Solo un cambio de pestaña da háptico: tocar la que ya está abierta no.
        if (!props['aria-selected']) haptics.tapLight();
        onPress?.(e);
      }}
    />
  );
}

/**
 * Ícono de pestaña. Un cambio de color solo se nota poco sobre tinta, así que el
 * ícono de la pestaña que se vuelve activa hace 1 → 1.12 → 1 en el hilo de UI. La
 * píldora que dice dónde estás no vive aquí: la pinta `PildoraLiquida` en el
 * fondo de la barra y se desliza entre pestañas.
 */
interface IconoProps {
  nombre: IconName;
  /** El `focused` con el que React Navigation pinta esta copia: cada ícono se dibuja dos veces (activa e inactiva) y este valor no cambia. */
  activo: boolean;
  tint: string;
  /** Posición de la pestaña: la que se vuelve activa es la que pulsa. */
  indice: number;
}

function Icono({ nombre, activo, tint, indice }: IconoProps) {
  const reducido = useMovimientoReducido();
  const enfocada = useContext(IndicePestana) === indice;
  const escala = useSharedValue(1);
  const montado = useRef(false);

  useEffect(() => {
    // Al montar no hay pulso: solo cuando la pestaña se vuelve la activa.
    if (!montado.current) {
      montado.current = true;
      return;
    }
    if (!enfocada || !activo || reducido) return;
    escala.set(withSequence(
      withTiming(1.12, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
      withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar })
    ));
  }, [enfocada, activo, reducido, escala]);

  const simbolo = useAnimatedStyle(() => ({
    transform: [{ scale: escala.get() }],
  }));

  return (
    <View style={styles.icon}>
      <Animated.View style={simbolo}>
        <Icon name={nombre} size="lg" color={tint} />
      </Animated.View>
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
  const indice = useContext(IndicePestana);
  const [ancho, setAncho] = useState(0);
  return (
    <LinearGradient
      colors={filoLuz}
      start={sol.start}
      end={sol.end}
      style={styles.filo}
    >
      <View style={styles.filoInterior} onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.veloBarra]} />
        <PildoraLiquida indice={indice} total={Object.keys(ICONO).length} ancho={ancho} arriba={ARRIBA_PILDORA} />
      </View>
    </LinearGradient>
  );
}

/** Pestaña activa, para que la píldora del fondo sepa a dónde deslizarse. */
const IndicePestana = createContext(0);

/**
 * Barra por defecto de React Navigation, más la pestaña activa por contexto. La
 * píldora vive en el fondo (detrás de los íconos) y desde ahí no recibe props.
 */
function BarraLiquida(props: BottomTabBarProps) {
  return (
    <IndicePestana.Provider value={props.state.index}>
      <BottomTabBar {...props} />
    </IndicePestana.Provider>
  );
}

/**
 * Dónde empieza el ícono contando desde el borde de arriba de la barra: el paddingTop
 * de la barra (`sm`), el del ítem (`xs`) y el `padding: 5` que React Navigation le
 * pone al botón de cada pestaña (variante uikit); menos el px del filo de luz.
 */
const PADDING_BOTON_PESTANA = 5;
const ARRIBA_PILDORA = space.sm + space.xs + PADDING_BOTON_PESTANA - 1;

/*
 * Lo que la barra le pide a cada pestaña, fuera del componente: las mismas funciones en cada render del navegador
 * (antes, `screenOptions` creaba un fondo y un ícono nuevos por pestaña cada vez).
 */
const barraDePestanas = (props: BottomTabBarProps) => <BarraLiquida {...props} />;
const fondoDeBarra = () => <FondoBarra />;
const iconoDe = (nombre: keyof MainTabParams) =>
  function IconoPestana({ color: tint, focused }: { color: string; focused: boolean }) {
    return <Icono nombre={ICONO[nombre]} activo={focused} tint={tint} indice={ORDEN_PESTANAS.indexOf(nombre)} />;
  };
const ICONO_DE_PESTANA: Record<string, ReturnType<typeof iconoDe>> = Object.fromEntries(
  ORDEN_PESTANAS.map((nombre) => [nombre, iconoDe(nombre as keyof MainTabParams)])
);

export function TabNavigator() {
  const insets = useSafeAreaInsets();
  /*
   * Con la barra de navegación de Android oculta (useBarraOculta), el
   * inset inferior es 0 y la pestaña flotante se queda en el margen
   * mínimo `space.md`, para que no quede pegada al borde donde se
   * desliza para verla. Si algo la deja visible (el instante antes de
   * ocultarse, un dispositivo donde falle), `insets.bottom` no es 0 y la
   * pestaña sube por encima suyo en vez de quedar tapada.
   */
  const abajo = insets.bottom > 0 ? insets.bottom + space.xs : space.md;
  const estiloBarra = [styles.bar, { bottom: abajo }];

  return (
    <View style={{ flex: 1, backgroundColor: color.bg }}>
      <Tab.Navigator
      initialRouteName="Practice"
      tabBar={barraDePestanas}
      screenOptions={({ route }) => ({
        headerShown: false,
        // La barra flota: se despega de los bordes y deja ver el
        // contenido desenfocado por detrás. Pegada al borde aplastaba la
        // pantalla; flotando, la app respira.
        tabBarStyle: estiloBarra,
        tabBarBackground: fondoDeBarra,
        tabBarActiveTintColor: color.barraActivo,
        tabBarInactiveTintColor: color.barraInactivo,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        tabBarButton: BotonPestana,
        tabBarIcon: ICONO_DE_PESTANA[route.name],
      })}
    >
      {/* Solo Practicar (la inicial) se evalúa al abrir: Vocabulario y Progreso (con sus gráficas de Skia) cargan
          su código la primera vez que se tocan. Las pestañas ya se montan perezosas (lazy, el default). */}
      <Tab.Screen
        name="Explore"
        getComponent={() => require('@/features/vocabulario/screens/ExploreScreen').ExploreScreen}
        options={{ title: 'Vocabulario' }}
      />
      <Tab.Screen
        name="Practice"
        component={PracticeScreen}
        options={{ title: 'Practicar' }}
      />
      <Tab.Screen
        name="Progress"
        getComponent={() => require('@/features/progreso/screens/ProgressScreen').ProgressScreen}
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
    paddingBottom: space.sm,
    paddingTop: space.sm,
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
    marginTop: space.xs,
  },
  item: { paddingTop: space.xs },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 54,
    height: 28,
  },
});
