import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Card, Header, Icon, Screen } from '@/components/base';
import { CandadoBadge } from '@/components/unlock';
import { SectionTitle } from '@/components/list';
import { loadContent } from '@/store/content';
import { useUnlockStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import { color, font, space, aparecerSubiendo, escalon } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';
import type { GramaticaTema } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Gramática, el índice.
 *
 * Ocho bloques, cincuenta temas. Se entra por bloque y no por lista
 * plana: cincuenta filas seguidas no se leen, se abandonan.
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
  const { gramatica } = loadContent();
  const claves = useUnlockStore((s) => s.claves);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Misma pista que el resto de la app, pero más baja: aquí se lee.
  useMusicaPantalla('app', { volumenFactor: 0.4 });

  const porBloque = useMemo(() => {
    const m = new Map<string, GramaticaTema[]>();
    for (const t of gramatica.temas) {
      const lista = m.get(t.bloque) ?? [];
      lista.push(t);
      m.set(t.bloque, lista);
    }
    return m;
  }, [gramatica]);

  const bloques = Object.entries(gramatica.bloques);

  return (
    <Screen scroll>
      <Header title="Gramática" onBack={() => nav.goBack()} />

      <Text style={styles.intro}>
        {gramatica.temas.length} temas explicados desde el español: qué es,
        cuándo va y en qué te vas a equivocar.
      </Text>

      {bloques.map(([clave, bloque], i) => {
        const temas = porBloque.get(clave) ?? [];
        const desplegado = abierto === clave;
        return (
          <Animated.View key={clave} entering={aparecerSubiendo(escalon(i))}>
            <Card
              onPress={() => setAbierto(desplegado ? null : clave)}
              style={styles.bloque}
            >
              <View style={styles.bloqueTop}>
                <Text style={styles.bloqueNombre}>{bloque.nombre}</Text>
                <View style={styles.bloqueNumFila}>
                  <Text style={styles.bloqueNum}>{temas.length}</Text>
                  <Icon name={desplegado ? 'chevron-down' : 'chevron-right'} size="sm" color={color.accent} />
                </View>
              </View>
              <Text style={styles.bloqueResumen}>{bloque.resumen}</Text>
            </Card>

            {desplegado
              ? temas.map((tema, n) => {
                  const cerrado =
                    n >= GRATIS_POR_BLOQUE &&
                    !claves.has(`gramatica:${tema.id}`);
                  return (
                    <Card
                      key={tema.id}
                      onPress={() => nav.navigate('GramaticaTema', { temaId: tema.id })}
                      style={styles.tema}
                    >
                      <View style={styles.temaTop}>
                        <Text style={styles.temaTitulo}>{tema.titulo}</Text>
                        <Text style={styles.temaNivel}>N{tema.nivel}</Text>
                      </View>
                      <Text style={styles.temaGancho}>{tema.gancho}</Text>
                      {cerrado ? <CandadoBadge /> : null}
                    </Card>
                  );
                })
              : null}
          </Animated.View>
        );
      })}

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
    marginBottom: space.lg,
  },
  /*
   * Los bloques son la unidad que se escanea, asi que necesitan
   * separarse entre si mas de lo que se separan de sus temas. Sin este
   * margen, ocho bloques seguidos se leian como una sola lista larga.
   */
  bloque: { gap: space.xs, marginBottom: space.md },
  bloqueTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  bloqueNombre: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
  },
  bloqueNumFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  bloqueNum: { fontSize: font.size.sm, color: color.accent, fontFamily: font.family.bodyStrong },
  bloqueResumen: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted, lineHeight: font.size.sm * 1.5 },
  /*
   * Los temas van sangrados y con su propio aire. La sangria dice que
   * cuelgan del bloque; el margen evita que se peguen entre ellos.
   */
  tema: { gap: 4, marginLeft: space.lg, marginBottom: space.sm },
  temaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  temaTitulo: {
    flex: 1,
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  temaNivel: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  temaGancho: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted, lineHeight: font.size.sm * 1.45 },
});
