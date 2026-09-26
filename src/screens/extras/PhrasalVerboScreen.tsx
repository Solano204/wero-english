import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { EmptyState, Header, Screen } from '@/components/base';
import { ChipsFormas } from '@/components/phrasal/ChipsFormas';
import { DetalleForma } from '@/components/phrasal/DetalleForma';
import { RuletaParticulas } from '@/components/phrasal/RuletaParticulas';
import { ViajeVerbo, type Viaje } from '@/components/phrasal/ViajeVerbo';
import { anunciarForma, etiquetasParticulas } from '@/domain/phrasal';
import { limitarIndice } from '@/domain/ruleta';
import * as haptics from '@/services/haptics';
import { loadContent } from '@/store/content';
import { useSettingsStore } from '@/store';
import { color, font, layout, space, text } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { RootStackParams } from '@/navigation/routes';
import type { PhrasalVerb } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;
type R = RouteProp<RootStackParams, 'PhrasalVerbo'>;

/** Si el verbo no llega a su título en este tiempo (ms), se muestra igual: el vuelo nunca deja la página sin título. */
const VIAJE_MAX_MS = 1350;
/** Un deslizamiento de lado cambia de forma si recorre al menos esto (dp) o va a esta velocidad (dp/s). */
const DESLIZA_MIN = layout.tapMin;
const DESLIZA_VELOCIDAD = 600;

/** La forma que se ve y cómo se llegó a ella: hacia dónde y en qué eje se desplaza el contenido al cambiar. */
interface Cambio {
  indice: number;
  direccion: 1 | -1;
  eje: 'x' | 'y';
}

/**
 * La página de un verbo: el verbo grande, fijo, y a su derecha la ruleta de partículas. El verbo no se mueve y la
 * partícula cambia todo el significado. Llega desde la lista con el verbo volando de su renglón a su lugar aquí
 * (`origen`). El héroe queda fijo arriba y solo lo de abajo hace scroll: así el gesto de la ruleta no compite con él.
 *
 * La forma se elige de tres maneras que se mantienen juntas: girando la ruleta, con los chips de todas las formas o
 * deslizando la tarjeta de lado. Con «reducir movimiento» no hay ruleta: los chips suben y son el control principal.
 */
export function PhrasalVerboScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const reducido = useMovimientoReducido();
  const content = useMemo(loadContent, []);
  const modoLimpio = useSettingsStore((s) => s.modoLimpio);
  const verboRef = useRef<View>(null);
  const [cambio, setCambio] = useState<Cambio>({ indice: 0, direccion: 1, eje: 'y' });
  const [viaje, setViaje] = useState<Viaje | null>(() =>
    params.origen ? { verbo: params.verbo, desde: params.origen, hasta: null } : null
  );
  const volando = viaje !== null;

  // Las formas del verbo, con el mismo filtro que la lista: el modo limpio esconde las fuertes.
  const formas = useMemo(() => {
    const grupo = content.phrasal.grupos.find((g) => g.verbo === params.verbo);
    if (!grupo) return [];
    const porId = new Map<number, PhrasalVerb>(content.phrasal.verbos.map((v) => [v.id, v]));
    return grupo.ids
      .map((id) => porId.get(id))
      .filter((v): v is PhrasalVerb => v !== undefined && !(modoLimpio && v.vulgaridad === 2));
  }, [content, params.verbo, modoLimpio]);
  const etiquetas = useMemo(() => etiquetasParticulas(formas.map((f) => f.particula)), [formas]);
  const n = formas.length;

  const medirVerbo = useCallback(() => {
    verboRef.current?.measureInWindow((x, y, width, height) =>
      setViaje((v) => (v && !v.hasta ? { ...v, hasta: { x, y, width, height } } : v))
    );
  }, []);
  const finViaje = useCallback(() => setViaje(null), []);
  const elegir = useCallback(
    (indice: number, eje: 'x' | 'y') =>
      setCambio((c) => (indice === c.indice ? c : { indice, direccion: indice > c.indice ? 1 : -1, eje })),
    []
  );
  const elegirConRuleta = useCallback((indice: number) => elegir(indice, 'y'), [elegir]);
  const elegirConChips = useCallback((indice: number) => elegir(indice, 'x'), [elegir]);

  /** Pasa a la forma anterior o a la siguiente (deslizar la tarjeta de lado). */
  const pasar = useCallback(
    (delta: 1 | -1) => {
      const indice = limitarIndice(cambio.indice + delta, n);
      if (indice === cambio.indice) return;
      haptics.selection();
      elegir(indice, 'x');
    },
    [cambio.indice, n, elegir]
  );
  const deslizar = useMemo(
    () =>
      Gesture.Pan()
        .enabled(n > 1)
        .activeOffsetX([-20, 20])
        .failOffsetY([-16, 16])
        .onEnd((e, exito) => {
          if (!exito) return;
          if (Math.abs(e.translationX) < DESLIZA_MIN && Math.abs(e.velocityX) < DESLIZA_VELOCIDAD) return;
          runOnJS(pasar)(e.translationX < 0 ? 1 : -1);
        }),
    [n, pasar]
  );

  useEffect(() => {
    if (!volando) return;
    const t = setTimeout(() => setViaje(null), VIAJE_MAX_MS);
    return () => clearTimeout(t);
  }, [volando]);

  const forma = formas[cambio.indice];
  if (!forma) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <EmptyState
          title="Ese verbo no existe"
          body="Puede que el catálogo se haya actualizado."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const conRuleta = n > 1 && !reducido;
  const chips = (
    <ChipsFormas verbo={params.verbo} etiquetas={etiquetas} indice={cambio.indice} onElegir={elegirConChips} />
  );

  return (
    <>
      <Screen style={styles.pantalla}>
        <Header
          onBack={() => nav.goBack()}
          right={n > 1 ? <Text style={styles.contador}>{`${cambio.indice + 1} de ${n}`}</Text> : undefined}
        />
        <View style={styles.heroe}>
          <View ref={verboRef} collapsable={false} onLayout={medirVerbo} style={volando ? styles.oculto : null}>
            <Text style={styles.verbo} accessibilityRole="header">
              {params.verbo}
            </Text>
          </View>
          {conRuleta ? (
            <RuletaParticulas
              verbo={params.verbo}
              etiquetas={etiquetas}
              indice={cambio.indice}
              anuncio={anunciarForma(forma, cambio.indice, n)}
              onElegir={elegirConRuleta}
            />
          ) : (
            <Text style={styles.particula}>{forma.particula}</Text>
          )}
        </View>
        <ScrollView
          style={styles.detalle}
          contentContainerStyle={styles.detalleContenido}
          showsVerticalScrollIndicator={false}
        >
          {n > 1 && reducido ? chips : null}
          <GestureDetector gesture={deslizar}>
            <View collapsable={false}>
              <DetalleForma forma={forma} direccion={cambio.direccion} eje={cambio.eje} />
            </View>
          </GestureDetector>
          {conRuleta ? chips : null}
        </ScrollView>
      </Screen>
      {viaje ? <ViajeVerbo viaje={viaje} onFin={finViaje} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  // Lo de abajo hace scroll hasta el borde: su propio relleno reserva el hueco.
  pantalla: { paddingBottom: 0 },
  contador: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  heroe: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  oculto: { opacity: 0 },
  verbo: { ...text.display, color: color.text },
  particula: { ...text.display, color: color.accent },
  detalle: { flex: 1 },
  detalleContenido: { paddingTop: space.lg, paddingBottom: space.xxxl, gap: space.lg },
});
