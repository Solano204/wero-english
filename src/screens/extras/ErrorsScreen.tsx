import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EmptyState, Header, Presionable, Screen } from '@/components/base';
import { TarjetaError } from '@/components/errores/TarjetaError';
import { Marcador } from '@/components/fx';
import {
  CATEGORIAS_ERRORES,
  ORDENES_ERRORES,
  conteoPorCategoria,
  encabezadoErrores,
  filtrarYOrdenar,
  normalizarOrden,
  type FiltroErrores,
  type OrdenErrores,
} from '@/domain/errores';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/data/contenido';
import { color, desvaneceDerecha, font, layout, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import type { ErrorCard } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Vista = { cat: FiltroErrores; orden: OrdenErrores };

/** Cuántas tarjetas entran animadas al cambiar de filtro; el resto aparece directo. */
const ANIMADAS = 8;
/** Lo que ocupa el desvanecido del borde derecho de los chips, en dp. */
const ANCHO_FADE = 32;

interface ChipProps {
  etiqueta: string;
  /** Cuántos errores tiene; sin él (los chips de orden) no lleva cuenta. */
  cuenta?: number;
  activo: boolean;
  onPress: () => void;
}

/** Un chip de 48 dp: el activo en `accentSoft` con borde `accent`. Dice su cuenta y si está elegido, no solo su color. */
const Chip = memo(function Chip({ etiqueta, cuenta, activo, onPress }: ChipProps) {
  return (
    <Presionable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cuenta === undefined ? etiqueta : `${etiqueta}, ${cuenta} errores`}
      accessibilityState={{ selected: activo }}
      style={[styles.chip, activo && styles.chipOn]}
    >
      <Text style={[styles.chipLetra, activo && styles.chipLetraOn]}>
        {etiqueta}
        {cuenta === undefined ? null : <Text style={[styles.chipCuenta, activo && styles.chipLetraOn]}>{` ${cuenta}`}</Text>}
      </Text>
    </Presionable>
  );
});

/**
 * P-22, los errores que te delatan.
 *
 * Arriba, el número de errores rueda con el `Marcador` («194 errores» sin filtro, «32 de 194» con filtro). Los chips de
 * categoría llevan su cuenta y scrollean con un desvanecido a la derecha; debajo, «Ordenar» (más graves primero, o en
 * orden), que solo reordena y se guarda en ajustes. Al cambiar de filtro u orden la lista sale en `rapido` y las primeras
 * ocho tarjetas entran escalonadas; con «reducir movimiento» cambia sin animar.
 */
export function ErrorsScreen() {
  const nav = useNavigation<Nav>();
  const reducido = useMovimientoReducido();
  const user = useAuthStore((s) => s.user);
  const guardado = useSettingsStore((s) => s.ordenErrores);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const content = useMemo(loadContent, []);
  const todos = content.errores.errores;
  const total = content.errores.total;

  const [cat, setCat] = useState<FiltroErrores>('todos');
  const [orden, setOrden] = useState<OrdenErrores>(() => normalizarOrden(guardado));
  // Lo que se ve en la lista: cambia cuando la lista anterior terminó de salir.
  const [vista, setVista] = useState<Vista>({ cat: 'todos', orden: normalizarOrden(guardado) });
  const salida = useSharedValue(1);

  const cuentas = useMemo(() => conteoPorCategoria(todos), [todos]);
  const lista = useMemo(() => filtrarYOrdenar(todos, vista.cat, vista.orden), [todos, vista]);
  const encabezado = encabezadoErrores(cat, cuentas[cat], total);

  useEffect(() => () => cancelAnimation(salida), [salida]);

  const alCambiarVista = useCallback(
    (sig: Vista) => {
      setVista(sig);
      salida.value = 1;
    },
    [salida]
  );
  const cambiarVista = useCallback(
    (sigCat: FiltroErrores, sigOrden: OrdenErrores) => {
      const sig: Vista = { cat: sigCat, orden: sigOrden };
      if (reducido) {
        setVista(sig);
        return;
      }
      salida.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }, (fin) => {
        if (fin) runOnJS(alCambiarVista)(sig);
      });
    },
    [reducido, salida, alCambiarVista]
  );

  const elegirCategoria = useCallback(
    (id: FiltroErrores) => {
      if (id === cat) return;
      setCat(id);
      cambiarVista(id, orden);
    },
    [cat, orden, cambiarVista]
  );
  const elegirOrden = useCallback(
    (id: OrdenErrores) => {
      if (id === orden) return;
      setOrden(id);
      if (user) void guardarAjuste(user.id, 'ordenErrores', id);
      cambiarVista(cat, id);
    },
    [cat, orden, user, guardarAjuste, cambiarVista]
  );

  const abrir = useCallback((errorId: string) => nav.navigate('ErrorDetail', { errorId }), [nav]);
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ErrorCard>) => (
      <TarjetaError error={item} indice={index} animar={index < ANIMADAS} onAbrir={abrir} />
    ),
    [abrir]
  );

  const estiloSalida = useAnimatedStyle(() => ({ opacity: salida.value }));

  if (todos.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Errores" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega errores.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.tope}>
        <Header onBack={() => nav.goBack()} title="Errores que te delatan" />
        <View style={styles.conteo} accessible accessibilityRole="header" accessibilityLabel={encabezado.anuncio}>
          <View style={styles.conteoVista} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Marcador valor={encabezado.numero} tamano={font.size.xxl} color={color.text} />
            <Text style={styles.conteoResto}>{encabezado.resto}</Text>
          </View>
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIAS_ERRORES.map((c) => (
            <Chip
              key={c.id}
              etiqueta={c.label}
              cuenta={cuentas[c.id]}
              activo={cat === c.id}
              onPress={() => elegirCategoria(c.id)}
            />
          ))}
        </ScrollView>
        <LinearGradient
          colors={desvaneceDerecha}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          pointerEvents="none"
          style={styles.fade}
        />
      </View>

      <View style={styles.ordenar}>
        <Text style={styles.ordenarRotulo}>Ordenar</Text>
        {ORDENES_ERRORES.map((o) => (
          <Chip key={o.id} etiqueta={o.label} activo={orden === o.id} onPress={() => elegirOrden(o.id)} />
        ))}
      </View>

      <Animated.View style={[styles.flex, estiloSalida]}>
        <FlatList
          key={`${vista.cat}|${vista.orden}`}
          data={lista}
          keyExtractor={claveError}
          renderItem={renderItem}
          ItemSeparatorComponent={Separador}
          contentContainerStyle={styles.list}
          initialNumToRender={ANIMADAS}
          windowSize={7}
          removeClippedSubviews
        />
      </Animated.View>
    </Screen>
  );
}

const claveError = (e: ErrorCard) => e.id;

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tope: { paddingHorizontal: layout.screenPad },
  conteo: { marginBottom: space.sm },
  conteoVista: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  conteoResto: { fontFamily: font.family.display, fontSize: font.size.xl, color: color.textMuted },
  chips: { gap: space.xs, paddingHorizontal: layout.screenPad, paddingRight: layout.screenPad + ANCHO_FADE },
  fade: { position: 'absolute', top: 0, right: 0, bottom: 0, width: ANCHO_FADE },
  chip: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipLetra: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  chipCuenta: { fontFamily: font.family.bodyStrong, color: color.textFaint },
  chipLetraOn: { color: color.accent, fontFamily: font.family.bodyStrong },
  ordenar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.xs,
    paddingHorizontal: layout.screenPad,
    paddingVertical: space.sm,
  },
  ordenarRotulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs, color: color.textFaint },
  list: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.sm },
});
