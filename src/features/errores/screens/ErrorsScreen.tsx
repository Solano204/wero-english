import React, { memo } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { EmptyState, Header, Presionable, Screen } from '@/shared/ui';
import { TarjetaError } from '@/features/errores/components/TarjetaError';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { CATEGORIAS_ERRORES, ORDENES_ERRORES } from '@/domain/errores';
import { color, desvaneceDerecha, font, layout, radius, space } from '@/theme';
import type { ErrorCard } from '@/types';
import { useErrores } from '@/features/errores/hooks/useErrores';

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
  const { nav, todos, cat, orden, vista, salida, cuentas, lista, encabezado, elegirCategoria, elegirOrden, abrir } = useErrores();

  const renderItem = ({ item, index }: ListRenderItemInfo<ErrorCard>) => (
    <TarjetaError error={item} indice={index} animar={index < ANIMADAS} onAbrir={abrir} />
  );

  const estiloSalida = useAnimatedStyle(() => ({ opacity: salida.get() }));

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
