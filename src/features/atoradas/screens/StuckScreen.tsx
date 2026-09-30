import React from 'react';
import { FlatList, StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { Carga, EmptyState, Header, Screen } from '@/shared/ui';
import { HuesoTarjeta, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { Desatorar } from '@/features/atoradas/components/Desatorar';
import { TarjetaAtorada } from '@/features/atoradas/components/TarjetaAtorada';
import { color, font, space } from '@/theme';
import { conteo } from '@/domain/texto';
import { Atorada, useAtoradas } from '@/features/atoradas/hooks/useAtoradas';

/** Cuántas tarjetas entran animadas al abrir la pantalla; el resto aparece directo. */
const ANIMADAS = 8;

/**
 * Filas que la lista arma por tanda al hacer scroll (el default es 10). Cada tarjeta lleva karaoke por palabra y su
 * grupo de audio: diez de golpe ocupan el hilo de JS más de un cuadro; de cuatro en cuatro la tanda cabe.
 */
const LOTE = 4;

/**
 * P-14, las que se atoran.
 *
 * Sin cronómetro y sin calificación: aquí el usuario solo lee y escucha.
 * Convertir esto en otro examen es exactamente lo contrario de lo que
 * necesita alguien que ya falló la frase cinco veces.
 *
 * Cada frase es una sola tarjeta con su medidor de atasco; las que tienen más fallos van arriba y más grandes. Al abrir se
 * compara con la última visita (`atoradasVistas` en ajustes): las frases que ya no están atoradas aparecen arriba un
 * momento («Ya no se te atora») y luego queda la lista de ahora, que es lo que se guarda para la próxima. No hay un botón
 * principal en el pie: «Corregir N errores» (el verbo de Hoy y de Progreso) lleva a esta misma pantalla, y no existe otra
 * sesión para corregirlas.
 */
export function StuckScreen() {
  const { nav, carga, items, mostrando, retirar, abrir } = useAtoradas();

  const renderItem = ({ item, index }: ListRenderItemInfo<Atorada>) => (
    <TarjetaAtorada entry={item.entry} fallos={item.fallos} indice={index} animar={index < ANIMADAS} onAbrir={abrir} />
  );

  const vacio = (
    <EmptyState
      icon="check"
      iconColor={color.correct}
      title="Ninguna por ahora"
      body="Cuando falles la misma frase tres veces, aparecerá aquí para que la repases con calma."
    />
  );

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Se me atoran" />
        <Carga
          carga={carga}
          vacio={vacio}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando las atoradas" style={styles.list}>
              {Array.from({ length: 6 }, (_, i) => (
                <HuesoTarjeta key={i} lineas={1} />
              ))}
            </ProveedorEsqueleto>
          }
        >
          {() => null}
        </Carga>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.head}>
        <Header
          onBack={() => nav.goBack()}
          title="Se me atoran"
          subtitle={items.length > 0 ? conteo(items.length, 'frase') : undefined}
        />
      </View>
      <FlatList
        data={items}
        keyExtractor={claveAtorada}
        renderItem={renderItem}
        ListHeaderComponent={
          <View>
            <Text style={styles.intro}>Sin cronómetro ni calificación. Léelas, escúchalas y ya.</Text>
            {mostrando.map((d) => (
              <Desatorar key={d.entry.id} entry={d.entry} fallos={d.fallos} retraso={d.retraso} onTerminar={() => retirar(d.entry.id)} />
            ))}
          </View>
        }
        ListEmptyComponent={<View style={styles.vacio}>{vacio}</View>}
        ItemSeparatorComponent={Separador}
        contentContainerStyle={styles.list}
        initialNumToRender={ANIMADAS}
        windowSize={7}
        removeClippedSubviews
        maxToRenderPerBatch={LOTE}
      />
    </Screen>
  );
}

const claveAtorada = (a: Atorada) => String(a.entry.id);

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
  vacio: { paddingVertical: space.xxl },
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
});
