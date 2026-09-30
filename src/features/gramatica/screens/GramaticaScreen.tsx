import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Header, Screen } from '@/shared/ui';
import { BloqueGramatica } from '@/features/gramatica/components/BloqueGramatica';
import { MedidorNivel } from '@/features/gramatica/components/MedidorNivel';
import { RenglonTema } from '@/features/gramatica/components/RenglonTema';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { ANUNCIOS_ACTIVOS } from '@/config/monetizacion';
import { color, font, space, aparecerSubiendo, escalon } from '@/theme';
import { useGramatica } from '@/features/gramatica/hooks/useGramatica';

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
  const { nav, reducido, gramatica, clavesVistas, abierto, setAbierto, porBloque, niveles, bloques, abrirTema } = useGramatica();

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
                      cerrado={ANUNCIOS_ACTIVOS && n >= GRATIS_POR_BLOQUE && !clavesVistas.has(`gramatica:${tema.id}`)}
                      primero={n === 0}
                      indice={n}
                      avance={avance}
                      onPress={abrirTema}
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
