import React from 'react';
import { plural } from '@/domain/texto';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, ErrorCarga, Header, IconButton, Screen } from '@/shared/ui';
import { FinDelDia } from '@/features/estudio/components/FinDelDia';
import { Confetti } from '@/shared/ui/feedback/Confetti';
import { Trozos } from '@/shared/ui/feedback/Trozos';
import { BarraSesion } from '@/shared/ui/fx/BarraSesion';
import { ChipMarcador } from '@/features/estudio/components/ChipMarcador';
import { HojaVeredicto } from '@/features/estudio/components/HojaVeredicto';
import { publicarBarraEstudio } from '@/shared/ui/fx/estadoTransicion';
import { DiffFrase } from '@/features/estudio/components/DiffFrase';
import { StudyCardView } from '@/features/estudio/components/StudyCardView';
import { Hueso, HuesoBoton, HuesoImagen, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { nivelSeguidas } from '@/domain/seguidas';
import { aparecerSubiendo, color, font, layout, radius, space } from '@/theme';
import { Cierre, useSesionEstudio } from '@/features/estudio/hooks/useSesionEstudio';

const lineaFinal = (c: Cierre) => `${c.aciertos} de ${c.total} ${plural(c.total, 'frase atinada', 'frases atinadas')}`;

/**
 * P-05, la sesión de estudio. La pantalla más importante de la app.
 *
 * Mantiene la pantalla encendida: una sesión de tres minutos con audio
 * puede pasar de los quince segundos de inactividad de Android y se
 * apaga a media tarjeta.
 */
export function StudyScreen() {
  const { reducido, nav, params, barra, settings, phase, card, feedback, done, goal, seguidas, avanzando, skip, aciertos, pendientes, summary, proximoRepaso, nuevasCatalogo, demoraSesion, huboEsqueleto, chosen, setChosen, hoja, mostrarFin, fin, ultimaTarjeta, reaccion, origenTrozos, setOrigenTrozos, otraSesion, seguirRepasando, aprenderNuevas, handleClose, handleAnswer, handleContinue } = useSesionEstudio();

  if (phase === 'loading' || phase === 'idle' || demoraSesion) {
    return (
      <Screen transicionCarga={demoraSesion ? 'esqueleto' : undefined}>
        <Header onClose={() => nav.goBack()} />
        {demoraSesion ? (
          <ProveedorEsqueleto etiqueta="Armando tu sesión" style={styles.esqueletoRaiz}>
            <Hueso width="100%" height={6} radius={radius.pill} />
            <HuesoImagen style={styles.esqueletoImagen} />
            <View style={styles.esqueletoTexto}>
              <Hueso width="75%" height={24} style={styles.esqueletoCentrado} />
              <Hueso width="45%" height={16} style={styles.esqueletoCentrado} />
            </View>
            <View style={styles.esqueletoOpciones}>
              {Array.from({ length: 4 }, (_, i) => (
                <HuesoBoton key={i} size="lg" />
              ))}
            </View>
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (phase === 'error') {
    return (
      <Screen>
        <Header onClose={() => nav.goBack()} />
        <ErrorCarga onReintentar={() => otraSesion(params?.modo === 'nuevas')} />
      </Screen>
    );
  }

  // Sin nada que repasar, o la sesión ya terminó: el estado final. Nunca una pantalla vacía.
  if (phase === 'empty' || (phase === 'finished' && mostrarFin)) {
    return (
      <Screen>
        <Confetti active={phase === 'finished' && Boolean(fin?.merece)} />
        <Header onClose={() => nav.goBack()} />
        <FinDelDia
          resumen={phase === 'finished' ? summary : null}
          pendientes={phase === 'finished' ? pendientes : 0}
          proximoRepaso={proximoRepaso}
          nuevasCatalogo={nuevasCatalogo}
          onSeguirRepasando={seguirRepasando}
          onAprenderNuevas={aprenderNuevas}
          onJugar={() => nav.popTo('Main', { screen: 'Practice' })}
          onFrasesSueltas={() => nav.replace('Azar', undefined)}
          onVolver={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const terminada = phase === 'finished';
  // Nunca en blanco: si por lo que sea no hay tarjeta y la sesión no terminó, queda la salida.
  if (!card && !terminada) {
    return (
      <Screen>
        <Header onClose={() => nav.goBack()} />
      </Screen>
    );
  }

  return (
    <Screen padded={false} transicionCarga={huboEsqueleto ? 'contenido' : undefined}>
      <Trozos disparo={reaccion.trozos} tinte={color.accent} y="46%" origen={origenTrozos ?? undefined} />
      <Confetti active={terminada && Boolean(fin?.merece)} />
      <View style={styles.top}>
        {/*
          * Fila de arriba: atrás a la izquierda, "Saltar" a la derecha y en
          * medio los chips de la sesión. Los dos chips no caben junto a la
          * barra a 360 px (quedaba de ~40 dp), así que la barra va debajo, a
          * todo el ancho. Ninguno de los dos se guarda ni se menciona al
          * caerse: son un gusto pequeño mientras dura la sesión, no una deuda.
          */}
        <View style={styles.filaSuperior}>
          <IconButton icono="back" etiqueta="Atrás" tamano="sm" onPress={handleClose} />
          <View style={styles.chips}>
            {aciertos > 0 ? (
              <ChipMarcador
                valor={aciertos}
                sufijo={plural(aciertos, 'atinada', 'atinadas')}
                tinte={color.accent}
                etiqueta={`${aciertos} ${plural(aciertos, 'frase atinada', 'frases atinadas')}`}
              />
            ) : null}
            {settings.mostrarSeguidas && nivelSeguidas(seguidas) > 0 ? (
              <ChipMarcador valor={seguidas} icono="fire" tinte={color.star} etiqueta={`${seguidas} seguidas`} />
            ) : null}
          </View>
          <Button
            label="Saltar"
            variant="ghost"
            disabled={avanzando || terminada}
            onPress={() => {
              setChosen(null);
              setOrigenTrozos(null);
              skip();
            }}
          />
        </View>

        <View
          ref={barra}
          collapsable={false}
          style={styles.barRow}
          onLayout={() => barra.current?.measureInWindow((_x, y, _w, alto) => publicarBarraEstudio(y + alto / 2))}
        >
          {/* Al terminar la barra se llena (aunque hayas saltado alguna) y la luz la recorre una vez. */}
          <BarraSesion
            hecho={terminada ? goal : done}
            meta={goal}
            seguidas={settings.mostrarSeguidas && !terminada ? seguidas : 0}
            barrido={terminada}
          />
        </View>
      </View>

      <View style={styles.body}>
        {card ? (
          <StudyCardView
            key={`${card.entry.id}-${card.kind}`}
            card={card}
            locked={Boolean(feedback)}
            chosen={chosen}
            autoAudio={settings.autoAudio}
            onChoose={setChosen}
            onAnswer={handleAnswer}
            onOrigenAcierto={setOrigenTrozos}
          />
        ) : fin ? (
          <Animated.View
            entering={reducido ? undefined : aparecerSubiendo()}
            style={styles.finCentro}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.cierreTitulo}>Sesión terminada</Text>
            <Text style={styles.cierreLinea}>{lineaFinal(fin)}</Text>
          </Animated.View>
        ) : null}
      </View>

      {ultimaTarjeta.current ? (
        <HojaVeredicto
          visible={Boolean(feedback)}
          correct={feedback?.correct ?? false}
          answer={feedback?.answer ?? ''}
          nota={feedback?.nota}
          repaso={feedback?.nextLabel}
          frase={
            // Dictado y Escribir: la frase con lo que faltó y lo que sobró marcado en su lugar.
            feedback &&
            !feedback.correct &&
            (ultimaTarjeta.current.kind === 'dictado' || ultimaTarjeta.current.kind === 'escribir') &&
            chosen ? (
              <DiffFrase dado={chosen} esperado={feedback.answer} />
            ) : undefined
          }
          avanzando={avanzando}
          onContinue={handleContinue}
          onDetail={() => {
            const abierta = ultimaTarjeta.current;
            if (abierta) nav.navigate('Detail', { entryId: abierta.entry.id });
          }}
        />
      ) : null}
      {hoja}
    </Screen>
  );
}

const styles = StyleSheet.create({
  cierreTitulo: {
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
    color: color.text,
    textAlign: 'center',
  },
  cierreLinea: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    marginBottom: space.md,
  },
  finCentro: { flex: 1, justifyContent: 'center', gap: space.sm },
  top: { paddingHorizontal: space.lg, paddingTop: space.xs },
  filaSuperior: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: layout.tapMin },
  chips: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barRow: { marginBottom: space.xs },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.md },
  esqueletoRaiz: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.md, gap: space.xl },
  esqueletoImagen: { marginTop: space.md },
  esqueletoTexto: { gap: space.sm, alignItems: 'center' },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoOpciones: { gap: space.sm },
});
