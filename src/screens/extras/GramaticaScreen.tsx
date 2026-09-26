import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Header, Screen } from '@/components/base';
import { BloqueGramatica } from '@/components/gramatica/BloqueGramatica';
import { MedidorNivel } from '@/components/gramatica/MedidorNivel';
import { RenglonTema } from '@/components/gramatica/RenglonTema';
import { SectionTitle } from '@/components/list';
import { nivelMaximo } from '@/domain/gramatica';
import { loadContent } from '@/store/content';
import { useUnlockStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import { color, font, space, aparecerSubiendo, escalon } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { RootStackParams } from '@/navigation/routes';
import type { GramaticaTema } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Gramática, el índice.
 *
 * Nueve bloques, ochenta temas. Se entra por bloque y no por lista plana:
 * ochenta filas seguidas no se leen, se abandonan. Cada bloque es una
 * tarjeta como las de Practicar y sus temas son renglones dentro de ella.
 *
 * Los tres primeros temas de cada bloque están abiertos. El resto pide
 * un anuncio, una vez, y queda abierto para siempre. La razón de que
 * sean los tres primeros y no los tres últimos: quien llega a gramática
 * viene con una duda concreta, y tiene que poder resolver algo antes de
 * que se le pida nada.
 */

/** Cuántos temas de cada bloque están abiertos sin anuncio. */
export const GRATIS_POR_BLOQUE = 3;

export function GramaticaScreen() {
  const nav = useNavigation<Nav>();
  const enfocada = useIsFocused();
  const reducido = useMovimientoReducido();
  const { gramatica } = loadContent();
  const claves = useUnlockStore((s) => s.claves);
  // Lo que se abre con un anuncio dentro del tema se refleja al volver a la lista, no antes: así el candado se ve abrirse.
  const [clavesVistas, setClavesVistas] = useState(claves);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Misma pista que el resto de la app, pero más baja: aquí se lee.
  useMusicaPantalla('app', { volumenFactor: 0.4 });

  useEffect(() => {
    if (enfocada) setClavesVistas(claves);
  }, [enfocada, claves]);

  const porBloque = useMemo(() => {
    const m = new Map<string, GramaticaTema[]>();
    for (const t of gramatica.temas) {
      const lista = m.get(t.bloque) ?? [];
      lista.push(t);
      m.set(t.bloque, lista);
    }
    return m;
  }, [gramatica]);
  const niveles = useMemo(() => nivelMaximo(gramatica.temas), [gramatica]);

  const bloques = Object.entries(gramatica.bloques);

  return (
    <Screen scroll>
      <Header title="Gramática" onBack={() => nav.goBack()} />

      <Text style={styles.intro}>
        {gramatica.temas.length} temas explicados desde el español: qué es,
        cuándo va y en qué te vas a equivocar.
      </Text>
      <View style={styles.filaLeyenda}>
        <MedidorNivel nivel={Math.ceil(niveles / 2)} total={niveles} decorativo />
        <Text style={styles.leyenda}>Más barras, más avanzado</Text>
      </View>

      <View style={styles.bloques}>
        {bloques.map(([clave, bloque], i) => {
          const temas = porBloque.get(clave) ?? [];
          return (
            <Animated.View key={clave} entering={reducido ? undefined : aparecerSubiendo(escalon(i))}>
              <BloqueGramatica
                nombre={bloque.nombre}
                resumen={bloque.resumen}
                total={temas.length}
                abierto={abierto === clave}
                onAlternar={() => setAbierto(abierto === clave ? null : clave)}
              >
                {(avance) =>
                  temas.map((tema, n) => (
                    <RenglonTema
                      key={tema.id}
                      tema={tema}
                      niveles={niveles}
                      cerrado={n >= GRATIS_POR_BLOQUE && !clavesVistas.has(`gramatica:${tema.id}`)}
                      primero={n === 0}
                      indice={n}
                      avance={avance}
                      onPress={() => nav.navigate('GramaticaTema', { temaId: tema.id })}
                    />
                  ))
                }
              </BloqueGramatica>
            </Animated.View>
          );
        })}
      </View>

      {gramatica.temas.length === 0 ? (
        <SectionTitle title="Todavía no hay temas cargados" />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
    marginBottom: space.md,
  },
  filaLeyenda: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  leyenda: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.45,
    color: color.textMuted,
  },
  /*
   * Los bloques son la unidad que se escanea, asi que necesitan
   * separarse entre si. Sin este espacio, nueve bloques seguidos se
   * leian como una sola lista larga.
   */
  bloques: { gap: space.md },
});
