import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { EmptyState, ErrorCarga, Header, Screen } from '@/shared/ui';
import { Hueso, HuesoBoton, HuesoCirculo, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { Trozos } from '@/shared/ui/feedback/Trozos';
import { FichaCaida } from '@/features/juegos/caida/components/FichaCaida';
import { FinCaida, PieFinCaida } from '@/features/juegos/caida/components/FinCaida';
import { FraseRonda } from '@/features/juegos/caida/components/FraseRonda';
import { HojaPausa } from '@/features/juegos/caida/components/HojaPausa';
import { IndicadorRitmo } from '@/features/juegos/caida/components/IndicadorRitmo';
import { PistaCaida } from '@/features/juegos/caida/components/PistaCaida';
import { usePartidaCaida } from '@/features/juegos/caida/hooks/usePartidaCaida';
import { estadoFicha } from '@/features/juegos/caida/logic/partida';
import { MARGEN_ARRIBA, chevronsPara, largoEstela } from '@/features/juegos/caida/logic/medidas';
import { CAIDA_INICIAL_MS, CAIDA_MINIMA_MS } from '@/domain/caida';
import { color, font, radius, space } from '@/theme';

/**
 * P-26, Caída.
 *
 * La frase aparece arriba y dos tarjetas bajan. Hay que tocar la
 * correcta antes de que lleguen al piso. Tocar la equivocada, o dejar
 * que aterricen, acaba la partida.
 *
 * Es el único modo de la app donde se puede perder, y es a pedido
 * expreso. Para que no contradiga la regla de que nada se castiga,
 * perder aquí no toca nada de afuera: no rompe la racha ni marca la
 * tarjeta peor de lo que la marcaría una respuesta equivocada en una
 * sesión normal. Se pierde la partida, no el avance.
 *
 * La partida vive en usePartidaCaida (y su máquina de estados en logic/partida.ts). Aquí solo se pinta.
 */
export function CaidaScreen() {
  const { acertada, aciertos, alLlegarFicha, altoPista, anim, animandoFin, avanzando, capaRef, carga, destino, enPausa, estela, fallada, golpe, idx, loading, marcadorRef, medirDestino, nav, nivel, nv, otraVez, pausaInfo, perdio, pistaRef, pulsoAnim, reaccion, recordAntes, responder, round, rounds, setAltoPista, tocarSiguienteEnPausa, volando, y } = usePartidaCaida();

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Caída" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Caída" />
        {carga.demora ? (
          <ProveedorEsqueleto etiqueta="Preparando la caída" style={styles.esqueletoRaiz}>
            <View style={styles.esqueletoTop}>
              <Hueso width="70%" height={4} radius={radius.pill} />
              <HuesoCirculo diametro={40} />
            </View>
            <View style={styles.esqueletoFrase}>
              <Hueso width="80%" height={26} style={styles.esqueletoCentrado} />
              <Hueso width="55%" height={26} style={styles.esqueletoCentrado} />
            </View>
            <View style={styles.esqueletoPistas}>
              {Array.from({ length: 3 }, (_, i) => (
                <HuesoBoton key={i} width={110} />
              ))}
            </View>
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (rounds.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Caída" />
        <EmptyState
          title="No se pudo armar la partida"
          body="No hay frases suficientes con los filtros que traes puestos."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  if (perdio) {
    return (
      <Screen
        footer={
          // Fijo abajo: una frase larga en la tarjeta (o un "Elegiste: ..." largo) no debe poder empujar
          // estos dos botones fuera de la pantalla en un equipo chico.
          <PieFinCaida
            onOtraVez={otraVez}
            onVerResultado={() =>
              nav.replace('GameEnd', {
                juego: 'caida',
                rondas: rounds.length,
                aciertos: aciertos,
                nivel: nivel ?? undefined,
              })
            }
          />
        }
      >
        <Header onBack={() => nav.goBack()} title={nivel ? `Nivel ${nivel}` : undefined} />
        {round ? (
          <FinCaida aciertos={aciertos} entry={round.entry} correcta={round.correcta} fallada={fallada} record={recordAntes} />
        ) : null}
      </Screen>
    );
  }

  // Entre la última ronda y el resumen no hay ronda: la pantalla nunca queda en blanco, sale con su encabezado.
  if (!round) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Caída" />
      </Screen>
    );
  }

  const izquierda = round.correctaIzquierda ? round.correcta : round.falsa;
  const derecha = round.correctaIzquierda ? round.falsa : round.correcta;
  // El ritmo es el del nivel: cada uno trae su duración inicial y su mínima. Las constantes son el respaldo.
  const chevrons = chevronsPara(
    round.duracionMs,
    nv?.caidaInicialMs ?? CAIDA_INICIAL_MS,
    nv?.caidaMinimaMs ?? CAIDA_MINIMA_MS
  );

  return (
    <Screen padded={false} style={styles.sinHueco} transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}>
      <View ref={capaRef} style={styles.capa}>
        <Trozos disparo={reaccion.trozos} tinte={color.correct} x="50%" y="62%" />
        <View style={styles.top}>
          <Header
            onBack={() => nav.goBack()}
            title={nivel ? `Nivel ${nivel}` : undefined}
            right={
              <View style={styles.derecha}>
                <IndicadorRitmo nivel={chevrons} />
                <View ref={marcadorRef} collapsable={false} onLayout={medirDestino}>
                  <Animated.View style={pulsoAnim}>
                    <Marcador
                      valor={aciertos - (volando ? 1 : 0)}
                      tamano={font.size.xl}
                      color={color.accent}
                      etiqueta={`${aciertos} ${aciertos === 1 ? 'acierto' : 'aciertos'}`}
                    />
                  </Animated.View>
                </View>
              </View>
            }
          />
          <FraseRonda key={idx} texto={round.entry.phrase} />
          <Text style={styles.instruccion}>
            Toca el significado antes de que lleguen abajo
          </Text>
        </View>

        <PistaCaida
          pistaRef={pistaRef}
          y={y}
          onDistancia={setAltoPista}
          largoEstela={largoEstela(altoPista, round.duracionMs)}
          estela={estela}
          armado={!enPausa}
          golpe={golpe}
        >
          <Animated.View style={[styles.fila, anim]}>
            <FichaCaida
              key={`${idx}-a`}
              texto={izquierda}
              estado={estadoFicha(izquierda, round.correcta, fallada, acertada, idx)}
              y={y}
              destino={destino}
              onLlego={alLlegarFicha}
              onPress={() => void responder(izquierda)}
            />
            <FichaCaida
              key={`${idx}-b`}
              texto={derecha}
              estado={estadoFicha(derecha, round.correcta, fallada, acertada, idx)}
              y={y}
              destino={destino}
              onLlego={alLlegarFicha}
              onPress={() => void responder(derecha)}
            />
          </Animated.View>
        </PistaCaida>

        <HojaPausa
          entry={pausaInfo?.entry ?? null}
          correct={pausaInfo?.correct ?? false}
          visible={enPausa && !volando && !animandoFin}
          avanzando={avanzando}
          onContinuar={tocarSiguienteEnPausa}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // `Screen` suma un colchón abajo cuando no hay footer: aquí el contenido llega hasta el borde seguro.
  sinHueco: { paddingBottom: 0 },
  capa: { flex: 1 },
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  derecha: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  instruccion: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.xs,
  },
  // La fila va absoluta arriba de la pista y baja con `translateY`: el piso es de la pista, no de esta fila.
  fila: {
    position: 'absolute',
    // El aplastamiento contra el piso (`scaleY`) sale de abajo, donde las fichas tocan.
    transformOrigin: 'bottom',
    top: MARGEN_ARRIBA,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.xxl },
  esqueletoTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  esqueletoFrase: { gap: space.sm, alignItems: 'center', marginTop: space.xxl },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoPistas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
});
