import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { EmptyState, Header, Screen } from '@/shared/ui';
import { ChipsFormas } from '@/features/phrasal/components/ChipsFormas';
import { DetalleForma } from '@/features/phrasal/components/DetalleForma';
import { RuletaParticulas } from '@/features/phrasal/components/RuletaParticulas';
import { ViajeVerbo } from '@/features/phrasal/components/ViajeVerbo';
import { anunciarForma } from '@/domain/phrasal';
import { color, font, space, text } from '@/theme';
import { usePhrasalVerbo } from '@/features/phrasal/hooks/usePhrasalVerbo';

/**
 * La página de un verbo: el verbo grande, fijo, y a su derecha la ruleta de partículas. El verbo no se mueve y la
 * partícula cambia todo el significado. Llega desde la lista con el verbo volando de su renglón a su lugar aquí
 * (`origen`). El héroe queda fijo arriba y solo lo de abajo hace scroll: así el gesto de la ruleta no compite con él.
 *
 * La forma se elige de tres maneras que se mantienen juntas: girando la ruleta, con los chips de todas las formas o
 * deslizando la tarjeta de lado. Con «reducir movimiento» no hay ruleta: los chips suben y son el control principal.
 */
export function PhrasalVerboScreen() {
  const { nav, params, reducido, verboRef, cambio, viaje, volando, etiquetas, n, medirVerbo, finViaje, elegirConRuleta, elegirConChips, deslizar, forma } = usePhrasalVerbo();

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
