import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { EmptyState, ErrorCarga, Header, Screen } from '@/shared/ui';
import { Hueso, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { TableroDulces } from '@/features/juegos/dulces/components/TableroDulces';
import { Estallidos } from '@/features/juegos/dulces/components/Estallidos';
import { FraseVoladora } from '@/features/juegos/dulces/components/FraseVoladora';
import { HojaPregunta } from '@/features/juegos/dulces/components/HojaPregunta';
import { TarjetaMetas } from '@/features/juegos/dulces/components/MetaFrase';
import { NotaInicial, PieDulces } from '@/features/juegos/dulces/components/PieDulces';
import { usePartidaDulces } from '@/features/juegos/dulces/hooks/usePartidaDulces';
import { Trozos } from '@/shared/ui/feedback/Trozos';
import { color, radius, space } from '@/theme';

/**
 * P-27, Dulces.
 *
 * Un tres en línea normal, con una diferencia: cada color está amarrado
 * a una frase que el usuario tiene pendiente. Quitar piezas de un color
 * llena la barra de esa frase, y cuando se llena aparece la pregunta.
 *
 * Sin esa amarra sería un juego bonito que no enseña nada, y el tiempo
 * que pasa aquí sería tiempo robado a la sesión. Con ella, jugar
 * adelanta la cola de repaso igual que estudiar.
 *
 * La partida vive en usePartidaDulces (y su máquina de estados en logic/partida.ts); la lógica del
 * tablero, en domain/match3.ts, probada desde node. Aquí solo se pinta.
 */
export function DulcesScreen() {
  const p = usePartidaDulces();
  const { nav, carga, tablero, pregunta, medidas } = p;

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (p.loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        {carga.demora ? (
          <ProveedorEsqueleto etiqueta="Llenando el tablero" style={styles.esqueletoRaiz}>
            <View style={styles.esqueletoMetas}>
              {Array.from({ length: 3 }, (_, i) => (
                <Hueso key={i} width={72} height={72} radius={radius.md} />
              ))}
            </View>
            <View style={styles.esqueletoTablero}>
              {Array.from({ length: 6 }, (_, fila) => (
                <View key={fila} style={styles.esqueletoFila}>
                  {Array.from({ length: 7 }, (_, col) => (
                    <Hueso key={col} width={38} height={38} radius={radius.sm} />
                  ))}
                </View>
              ))}
            </View>
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (!tablero.board || p.objetivos.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Dulces" />
        <EmptyState
          title="No se pudo armar el tablero"
          body="No hay frases suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen padded={false} style={styles.sinHueco} transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}>
      <View ref={medidas.capaRef} style={styles.capa} onLayout={(e) => p.setCapaAlto(e.nativeEvent.layout.height)}>
        <Trozos disparo={p.reaccion.trozos} tinte={color.world.cultura} />
        <View style={styles.top}>
          <Header
            onBack={() => nav.goBack()}
            title={p.nivel ? `Nivel ${p.nivel}` : undefined}
          />
        </View>

        {/* Scroll interno: en niveles con más filas/columnas el tablero
            puede pasar de la altura disponible en pantallas chicas y, sin
            esto, se cortaría contra "Dejarlo aquí" en vez de dejarse ver
            completo con scroll. */}
        <ScrollView
          style={styles.medio}
          contentContainerStyle={styles.medioContenido}
          showsVerticalScrollIndicator={false}
          scrollEnabled={pregunta === null}
          onLayout={(e) => p.setVistaAlto(e.nativeEvent.layout.height)}
          onContentSizeChange={(_, alto) => p.setContenidoAlto(alto)}
        >
          <View style={styles.metas}>
            <TarjetaMetas
              key={tablero.llave}
              objetivos={p.objetivos}
              registrarBarra={medidas.registrarBarra}
              registrarFrase={medidas.registrarFrase}
              llenaColor={pregunta?.objetivo.color ?? null}
            />
          </View>

          <View
            ref={medidas.tableroCajaRef}
            collapsable={false}
            style={{ width: tablero.ANCHO_TABLERO, height: tablero.ALTO_TABLERO, alignSelf: 'center' }}
          >
            <TableroDulces
              ref={p.tableroRef}
              celdas={tablero.board.cells}
              cols={tablero.COLS}
              rows={tablero.ROWS}
              lado={tablero.LADO}
              hueco={space.xs}
              llave={tablero.llave}
              elegida={tablero.elegida}
              bloqueado={p.animando || p.jugadas <= 0 || pregunta !== null}
              soloHorizontal={tablero.puedeScroll}
              onTocar={p.tocar}
              onDeslizar={p.deslizar}
            />
          </View>

          <NotaInicial visible={!p.huboLinea} texto="Junta tres del mismo color para llenar su barra" />
        </ScrollView>

        <PieDulces jugadas={p.jugadas} total={p.jugadasTotal} onDejar={p.terminar} />

        <HojaPregunta
          pregunta={pregunta}
          respondiendo={p.respondiendo}
          elegidaOpcion={p.elegidaOpcion}
          avanzando={p.avanzando}
          tituloListo={p.vuelo === null}
          capaAlto={p.capaAlto}
          onDestinoTitulo={p.setDestinoTitulo}
          onResponder={p.responder}
          onSeguir={p.seguirAhora}
        />
        {p.vuelo && p.destinoTitulo ? (
          <FraseVoladora
            key={p.vuelo.texto}
            texto={p.vuelo.texto}
            desde={p.vuelo.desde}
            hasta={p.destinoTitulo}
            onFin={() => p.setVuelo(null)}
          />
        ) : null}
        <Estallidos ref={medidas.estallidosRef} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `Screen` suma un colchón abajo cuando no hay footer: aquí el contenido llega hasta el borde seguro.
  sinHueco: { paddingBottom: 0 },
  capa: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  medio: { flex: 1 },
  medioContenido: { paddingBottom: space.sm },
  metas: { paddingHorizontal: space.lg, marginBottom: space.md },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.xl, alignItems: 'center' },
  esqueletoMetas: { flexDirection: 'row', gap: space.md },
  esqueletoTablero: { gap: space.xs },
  esqueletoFila: { flexDirection: 'row', gap: space.xs },
});
