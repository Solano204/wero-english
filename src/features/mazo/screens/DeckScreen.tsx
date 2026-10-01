import React from 'react';
import { StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import Animated from 'react-native-reanimated';
import { Carga, EmptyState, Header, Screen } from '@/shared/ui';
import { HuesoTarjeta, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { AvisoDeshacer } from '@/features/mazo/components/AvisoDeshacer';
import { TarjetaGuardada } from '@/features/mazo/components/TarjetaGuardada';
import { color, font, reacomodarResorte, space } from '@/theme';
import { conteo, plural } from '@/domain/texto';
import type { Entry } from '@/types';
import { useMazo } from '@/features/mazo/hooks/useMazo';

/** Cuántas tarjetas entran animadas al abrir la pantalla; el resto aparece directo. */
const ANIMADAS = 8;

/**
 * Filas que la lista arma por tanda al hacer scroll (el default es 10). Cada tarjeta lleva karaoke por palabra y su
 * grupo de audio: diez de golpe ocupan el hilo de JS más de un cuadro; de cuatro en cuatro la tanda cabe.
 */
const LOTE = 4;

const REACOMODO = reacomodarResorte();

/**
 * P-17, mi mazo: las guardadas con estrella, cada una como una tarjeta con su karaoke y su grupo Inglés · Español. Arriba,
 * cuántas hay con el `Marcador`, que baja al quitar. El orden es el de siempre (lo último que repasaste primero): no se
 * guarda la fecha en que se guardó una frase. Aquí no hay «Repasar»: la sesión de estudio no recibe listas sin tocar SM-2
 * ni la cola del día.
 *
 * Quitar: deslizar la tarjeta, mantenerla presionada o la acción del lector de pantalla. La tarjeta se va, las de abajo
 * suben con resorte y un aviso («Quitada de tu mazo · Deshacer») dura 5 s; «Deshacer» la regresa a su lugar. Hay un solo
 * pendiente: quitar otra confirma la anterior. La base se actualiza al quitar, no al vencer el aviso.
 */
export function DeckScreen() {
  const { nav, reducido, carga, items, aviso, reinsertada, quitar, deshacer, abrir } = useMazo();

  const renderItem = ({ item, index }: ListRenderItemInfo<Entry>) => (
    <TarjetaGuardada
      entry={item}
      indice={item.id === reinsertada ? 0 : index}
      animar={index < ANIMADAS || item.id === reinsertada}
      onAbrir={abrir}
      onQuitar={quitar}
    />
  );

  const vacio = (
    <EmptyState
      icon="star"
      title="Tu mazo está vacío"
      body="Toca la estrella en cualquier frase para guardarla aquí."
      actionLabel="Ir a Frases sueltas"
      onAction={() => nav.navigate('Azar')}
    />
  );

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <Carga
          carga={carga}
          vacio={vacio}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando tu mazo" style={styles.list}>
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
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <View style={styles.conteo} accessible accessibilityRole="header" accessibilityLabel={conteo(items.length, 'guardada')}>
          <View style={styles.conteoVista} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Marcador valor={items.length} tamano={font.size.xxl} color={color.text} />
            <Text style={styles.conteoResto}>{plural(items.length, 'guardada')}</Text>
          </View>
        </View>
      </View>
      {items.length === 0 ? (
        <View style={styles.vacio}>{vacio}</View>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={claveEntrada}
          renderItem={renderItem}
          itemLayoutAnimation={reducido ? undefined : REACOMODO}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separador}
          initialNumToRender={ANIMADAS}
          windowSize={7}
          maxToRenderPerBatch={LOTE}
        />
      )}
      {aviso ? (
        <AvisoDeshacer
          key={aviso.id}
          texto={aviso.tipo === 'quitada' ? 'Quitada de tu mazo' : 'No se pudo actualizar tu mazo. Intenta otra vez.'}
          onDeshacer={aviso.tipo === 'quitada' ? deshacer : undefined}
        />
      ) : null}
    </Screen>
  );
}

const claveEntrada = (e: Entry) => String(e.id);

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  conteo: { marginBottom: space.sm },
  conteoVista: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  conteoResto: { fontFamily: font.family.display, fontSize: font.size.xl, color: color.textMuted },
  vacio: { flex: 1, paddingHorizontal: space.lg },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
});
