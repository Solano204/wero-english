import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { conteo } from '@/domain/texto';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/shared/ui';
import { Hueso, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { Trozos } from '@/shared/ui/feedback/Trozos';
import { CableSenal } from '@/features/juegos/pares/components/CableSenal';
import { FichaPar } from '@/features/juegos/pares/components/FichaPar';
import { FichasJugadas } from '@/features/juegos/pares/components/FichasJugadas';
import { RelojRonda } from '@/features/juegos/pares/components/RelojRonda';
import { SegmentosPares } from '@/features/juegos/pares/components/SegmentosPares';
import { Sello } from '@/features/juegos/pares/components/Sello';
import { TarjetaFusion } from '@/features/juegos/pares/components/TarjetaFusion';
import { usePartidaPares } from '@/features/juegos/pares/hooks/usePartidaPares';
import { color, escalon, font, radius, space } from '@/theme';

/**
 * P-25, Pares.
 *
 * La mecánica que la competencia usa con una lista fija de palabras
 * sueltas. Aquí el tablero se arma con las tarjetas que le tocan hoy al
 * usuario, así que juntar dos fichas mueve su cola de repaso de verdad.
 *
 * Quedarse sin jugadas no acaba la partida. El tablero se queda como
 * está, se muestra lo que faltaba y se pasa al resumen. No hay derrota.
 *
 * La partida vive en usePartidaPares (y su fase con nombre en logic/partida.ts). Aquí solo se pinta.
 */
export function ParesScreen() {
  const p = usePartidaPares();
  const m = p.medidas;
  const { nav, carga, vuelo, elegida } = p;

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Pares" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (p.loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Pares" />
        {carga.demora ? (
          <ProveedorEsqueleto etiqueta="Repartiendo fichas" style={styles.esqueletoRaiz}>
            <Hueso width="60%" height={4} radius={radius.pill} style={styles.esqueletoCentrado} />
            <View style={styles.esqueletoColumnas}>
              {[0, 1].map((col) => (
                <View key={col} style={styles.esqueletoColumna}>
                  {Array.from({ length: 5 }, (_, i) => (
                    <Hueso key={i} height={64} radius={radius.md} />
                  ))}
                </View>
              ))}
            </View>
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (!p.tablero || p.tablero.totalPares < 3) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Pares" />
        <EmptyState
          icon="warning"
          title="No se pudo armar el tablero"
          body="No hay frases cortas suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const restantes = Math.max(0, p.tablero.jugadas - p.jugadas);

  return (
    <Screen padded={false} style={styles.sinHueco} transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}>
      <View ref={m.capaRef} style={styles.capa} onLayout={m.alMedirCapa}>
        <Trozos disparo={p.reaccion.trozos} tinte={color.world.dia_a_dia} x="50%" y="50%" />
        <View style={styles.top}>
          <Header
            onBack={() => nav.goBack()}
            title={p.nivel ? `Nivel ${p.nivel}` : undefined}
            right={
              <View ref={m.segmentosRef} collapsable={false} onLayout={m.medirSegmentos}>
                <SegmentosPares total={p.tablero.totalPares} resueltos={p.resueltas.length - (p.fusion ? 1 : 0)} cierre={p.cerrando} />
              </View>
            }
          />
          {p.nv ? (
            <View style={styles.reloj}>
              <RelojRonda
                segundos={p.nv.segundosTablero}
                llave={p.nivel ?? 0}
                // Al resolver el tablero el reloj se congela: seguir
                // contando mientras corre la animación de salida haría
                // perder partidas ya ganadas. También se congela mientras
                // se oye la voz de un par recién acertado. Y no arranca hasta
                // que cae la última ficha: la duración del nivel no cambia.
                pausado={!m.repartido || p.enPausa || p.resueltas.length >= (p.tablero?.totalPares ?? 0)}
                onFin={p.terminar}
              />
            </View>
          ) : null}
        </View>

        <Text style={styles.instruccion}>Junta cada frase con lo que significa</Text>

        <View style={styles.zona} onLayout={m.alMedirZona} pointerEvents={p.enPausa ? 'none' : 'auto'}>
          {m.zona.ancho > 0 ? (
            <ScrollView
              scrollEnabled={m.geo.desborda}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.zonaContenido}
              onScroll={m.alScrollear}
              scrollEventThrottle={16}
            >
              <CableSenal
                ancho={m.zona.ancho}
                alto={m.geo.altoContenido}
                rectas={m.geo.rectas}
                ancla={elegida ? p.tablero.fichas.findIndex((f) => f.id === elegida.id) : -1}
                libres={p.libres}
                bloqueado={!m.repartido || p.enPausa || p.fallando.length > 0 || p.union !== null || p.fusion !== null}
                arrastrable={!m.geo.desborda}
                union={p.union}
                fallo={p.fallo}
                onIniciar={p.tocarIndice}
                onSoltar={p.tocarIndice}
                onCancelar={p.cancelarArrastre}
                onUnionLista={p.alTerminarUnion}
              >
                {p.tablero.fichas.map((f, i) => {
                  const recta = m.geo.rectas[i];
                  if (!recta) return null;
                  const uniendo = p.union !== null && (p.union.a === i || p.union.b === i);
                  if (p.resueltas.includes(f.entryId) && !uniendo) return <Sello key={f.id} recta={recta} saliendo={p.cerrando} retraso={escalon(i)} />;
                  return (
                    <FichaPar
                      key={f.id}
                      ficha={f}
                      recta={recta}
                      elevada={uniendo || elegida?.id === f.id}
                      falla={p.fallando.includes(f.id)}
                      // La segunda ficha de la jugada es la que se sacude.
                      sacude={p.fallando[1] === f.id}
                      onPress={() => p.tocar(f)}
                      entra={escalon(i)}
                    />
                  );
                })}
              </CableSenal>
            </ScrollView>
          ) : null}
        </View>

        {p.fusion && vuelo?.fichaA && vuelo.fichaB && m.capa.ancho > 0 ? (
          <TarjetaFusion
            fichas={[vuelo.fichaA, vuelo.fichaB]}
            rectas={vuelo.rectaA && vuelo.rectaB ? [vuelo.rectaA, vuelo.rectaB] : null}
            capa={m.capa}
            destino={vuelo.destino}
            entry={p.fusion.entry}
            iniciar={p.union === null}
            saliendo={!p.enPausa}
            onAterrizo={p.alAterrizar}
          />
        ) : null}

        <View style={styles.pie}>
          <View style={styles.jugadasFila}>
            {restantes > 0 ? <FichasJugadas total={p.tablero.jugadas} restantes={restantes} /> : null}
            <Text style={[styles.jugadas, restantes > 0 && styles.jugadasAlLado]}>
              {restantes > 0
                ? `Te quedan ${conteo(restantes, 'jugada')}`
                : 'Se acabaron las jugadas, pero el tablero se queda'}
            </Text>
          </View>
          {p.enPausa ? (
            // «Saltar» ocupa el lugar del botón de salida, en la zona del pulgar y por encima del velo de la tarjeta.
            <Button label="Saltar" variant="ghost" icon="chevron-right" iconAlFinal onPress={p.saltarPausa} disabled={p.saltando} full />
          ) : (
            <Button
              label={restantes > 0 ? 'Dejarlo aquí' : 'Ver cómo me fue'}
              variant={restantes > 0 ? 'ghost' : 'primary'}
              onPress={p.terminar}
              full
            />
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `Screen` suma un colchón abajo cuando no hay footer: aquí el contenido llega hasta el borde seguro.
  sinHueco: { paddingBottom: 0 },
  capa: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  reloj: { marginTop: space.sm, marginBottom: space.md },
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  zona: { flex: 1, marginHorizontal: space.lg },
  zonaContenido: { flexGrow: 1, justifyContent: 'center' },
  pie: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  jugadasFila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  jugadas: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textMuted,
    textAlign: 'center',
    flex: 1,
  },
  jugadasAlLado: { textAlign: 'right' },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.xl },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoColumnas: { flexDirection: 'row', gap: space.md },
  esqueletoColumna: { flex: 1, gap: space.sm },
});
