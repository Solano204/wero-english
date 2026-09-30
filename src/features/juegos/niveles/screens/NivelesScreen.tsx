import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, Carga, Header, Screen } from '@/shared/ui';
import { AnilloEnVista } from '@/features/juegos/niveles/components/AnilloActual';
import { CONFIGURACION_VISTA } from '@/features/juegos/niveles/hooks/useScrollNivel';
import { EncabezadoNiveles } from '@/features/juegos/niveles/components/EncabezadoNiveles';
import { EsqueletoNiveles } from '@/features/juegos/niveles/components/EsqueletoNiveles';
import { type ItemLista } from '@/domain/niveles';
import { MuroDesbloqueo } from '@/shared/ui/MuroDesbloqueo';
import { ANUNCIOS_ACTIVOS } from '@/config/monetizacion';
import { aparecer, color, desaparecer, font, radius, space } from '@/theme';
import { RUTA, useNivelesJuego } from '@/features/juegos/niveles/hooks/useNivelesJuego';

const claveItem = (it: ItemLista) => it.key;

/**
 * El mapa de niveles.
 *
 * Doscientos por juego, en tres tramos (las bandas del juego) de renglones de cinco.
 * Se abren de uno en uno: terminar un nivel abre el siguiente, saques una estrella o
 * tres, y un anuncio abre UN nivel adelantado, el que sigue del siguiente. La lista
 * está virtualizada (no se pintan los doscientos de golpe) y cada tramo lleva su
 * encabezado pegado arriba mientras se recorre.
 */
const TITULOS: Record<string, string> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caída',
  dulces: 'Dulces',
  cazala: 'Cázala',
  pares_minimos: 'Pares mínimos',
};

export function NivelesScreen() {
  const { nav, juego, muro, def, carga, siguiente, aviso, lado, items, pegados, getItemLayout, reducido, listaRef, scrollY, alScroll, alMedir, posicionada, lejos, alVisibles, irAlActual, actualEnVista, cuenta, renderItem, extraData } = useNivelesJuego();

  if (!def) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Niveles" />
        <Card>
          <Text style={styles.vacio}>
            No hay niveles cargados para este juego. Corre
            scripts/genera_niveles.py.
          </Text>
        </Card>
      </Screen>
    );
  }

  // La acción principal, en la zona del pulgar: jugar el nivel que sigue. Con los 200 jugados no hay «actual».
  const hayActual = Boolean(carga.datos) && siguiente <= def.total;

  const contenido = (
    <Screen
      padded={false}
      footer={
        hayActual ? (
          <Button
            label={`Jugar nivel ${siguiente}`}
            size="lg"
            full
            onPress={() => {
              const ruta = RUTA[juego];
              if (ruta) nav.navigate(ruta, { nivel: siguiente });
            }}
          />
        ) : undefined
      }
    >
      <EncabezadoNiveles
        titulo={def.nombre}
        estrellas={carga.datos ? cuenta : null}
        maximo={def.total * 3}
        scrollY={scrollY}
        onBack={() => nav.goBack()}
      />

      <Carga carga={carga} esqueleto={<EsqueletoNiveles lado={lado} />}>
        {() => (
          // Hasta que la lista se posiciona en el nivel actual no se ve: sin esto se vería un destello arriba.
          <View style={[styles.lista, { opacity: posicionada ? 1 : 0 }]} onLayout={alMedir}>
            <AnilloEnVista value={actualEnVista}>
              <Animated.FlatList
                ref={listaRef}
                data={items}
                renderItem={renderItem}
                keyExtractor={claveItem}
                getItemLayout={getItemLayout}
                extraData={extraData}
                stickyHeaderIndices={pegados}
                onScroll={alScroll}
                scrollEventThrottle={16}
                onViewableItemsChanged={alVisibles}
                viewabilityConfig={CONFIGURACION_VISTA}
                initialNumToRender={12}
                maxToRenderPerBatch={8}
                windowSize={7}
                showsVerticalScrollIndicator={false}
                ListFooterComponent={
                  <Text style={styles.pie}>
                    Terminar un nivel abre el siguiente, saques una estrella o tres.
                    {ANUNCIOS_ACTIVOS
                      ? ' El que sigue del último también se abre con «Ver anuncio y abrir».'
                      : ''}
                    {' '}Rejugar nunca te baja lo que ya tenías.
                  </Text>
                }
              />
            </AnilloEnVista>
          </View>
        )}
      </Carga>

      {/* Sobre la lista y encima del footer: el aviso del anuncio y, si te alejas del nivel actual, un atajo para volver. */}
      <View style={styles.flotante} pointerEvents="box-none">
        {aviso ? (
          <Animated.View
            entering={reducido ? undefined : aparecer()}
            exiting={reducido ? undefined : desaparecer()}
            style={styles.aviso}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.avisoTexto}>{aviso}</Text>
          </Animated.View>
        ) : null}
        {posicionada && lejos ? (
          <Animated.View
            entering={reducido ? undefined : aparecer()}
            exiting={reducido ? undefined : desaparecer()}
            pointerEvents="box-none"
          >
            <Button
              label={`Ir al nivel ${siguiente}`}
              variant="secondary"
              icon={lejos === 'abajo' ? 'chevron-down' : 'chevron-up'}
              onPress={irAlActual}
            />
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );

  // Cada juego se abre una vez y queda abierto para siempre. El muro
  // deja ver los niveles por detras: se ve lo que hay, y eso es justo
  // lo que da ganas de abrirlo.
  return (
    <MuroDesbloqueo
      abierto={muro.abierto}
      puede={muro.puede}
      onDesbloquear={muro.desbloquear}
      nombre={TITULOS[juego] ?? "Este juego"}
      detalle="200 niveles, todos con frases de tu catálogo."
      onVolver={() => nav.goBack()}
    >
      {contenido}
    </MuroDesbloqueo>
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1 },
  // Pegado abajo, sobre la lista y encima del footer (el footer queda fuera de este contenedor).
  flotante: { position: 'absolute', left: 0, right: 0, bottom: space.md, alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  aviso: {
    alignSelf: 'stretch',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    padding: space.md,
  },
  avisoTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text, textAlign: 'center', lineHeight: font.size.md * 1.5 },
  pie: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    margin: space.lg,
    marginBottom: space.xxxl,
  },
  vacio: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
