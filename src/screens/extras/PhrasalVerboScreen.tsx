import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { EmptyState, Header, Screen } from '@/components/base';
import { RuletaParticulas } from '@/components/phrasal/RuletaParticulas';
import { ViajeVerbo, type Viaje } from '@/components/phrasal/ViajeVerbo';
import { anunciarForma, etiquetasParticulas } from '@/domain/phrasal';
import { loadContent } from '@/store/content';
import { useSettingsStore } from '@/store';
import { color, font, space, text } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';
import type { PhrasalVerb } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;
type R = RouteProp<RootStackParams, 'PhrasalVerbo'>;

/** Si el verbo no llega a su título en este tiempo (ms), se muestra igual: el vuelo nunca deja la página sin título. */
const VIAJE_MAX_MS = 1350;

/**
 * La página de un verbo: el verbo grande, fijo, y a su derecha la ruleta de partículas. El verbo no se mueve y la
 * partícula cambia todo el significado. Llega desde la lista con el verbo volando de su renglón a su lugar aquí
 * (`origen`). El héroe queda fijo arriba y solo lo de abajo hace scroll: así el gesto de la ruleta no compite con él.
 */
export function PhrasalVerboScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const content = useMemo(loadContent, []);
  const modoLimpio = useSettingsStore((s) => s.modoLimpio);
  const verboRef = useRef<View>(null);
  const [indice, setIndice] = useState(0);
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

  const medirVerbo = useCallback(() => {
    verboRef.current?.measureInWindow((x, y, width, height) =>
      setViaje((v) => (v && !v.hasta ? { ...v, hasta: { x, y, width, height } } : v))
    );
  }, []);
  const finViaje = useCallback(() => setViaje(null), []);
  const elegir = useCallback((i: number) => setIndice(i), []);

  useEffect(() => {
    if (!volando) return;
    const t = setTimeout(() => setViaje(null), VIAJE_MAX_MS);
    return () => clearTimeout(t);
  }, [volando]);

  const forma = formas[indice];
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

  return (
    <>
      <Screen style={styles.pantalla}>
        <Header
          onBack={() => nav.goBack()}
          right={formas.length > 1 ? <Text style={styles.contador}>{`${indice + 1} de ${formas.length}`}</Text> : undefined}
        />
        <View style={styles.heroe}>
          <View ref={verboRef} collapsable={false} onLayout={medirVerbo} style={volando ? styles.oculto : null}>
            <Text style={styles.verbo} accessibilityRole="header">
              {params.verbo}
            </Text>
          </View>
          {formas.length > 1 ? (
            <RuletaParticulas
              verbo={params.verbo}
              etiquetas={etiquetas}
              indice={indice}
              anuncio={anunciarForma(forma, indice, formas.length)}
              onElegir={elegir}
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
          <Text style={styles.significado}>{forma.significado}</Text>
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
  significado: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.4,
    color: color.text,
  },
});
