import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/shared/ui';
import { CierreLectura } from '@/features/lecturas/components/CierreLectura';
import { EsqueletoTexto } from '@/features/lecturas/components/EsqueletoTexto';
import { LeyendaFrases } from '@/features/lecturas/components/LeyendaFrases';
import { PieReproductor } from '@/features/lecturas/components/PieReproductor';
import { PreguntaUnaAUna } from '@/features/lecturas/components/PreguntaUnaAUna';
import { TextoAcompanado } from '@/features/lecturas/components/TextoAcompanado';
import * as audio from '@/services/audio';
import { aparecer, color, desaparecer, font, layout, motionDuration, space } from '@/theme';
import { useLectura } from '@/features/lecturas/hooks/useLectura';

/**
 * El lector.
 *
 * Las frases del catálogo van subrayadas y se pueden tocar: subrayada en gris
 * si ya las viste, punteada y en azul si son nuevas. Tocar abre la ficha
 * completa. Mientras suena el capítulo, la oración que se escucha se
 * ilumina; el reproductor va fijo abajo, en la zona del pulgar.
 *
 * Al final, tres preguntas. No se guarda calificación y no se puede
 * reprobar: son para confirmar que se entendió, no para evaluar. Poner
 * un puntaje aquí convertiría la lectura en tarea.
 */
export function LecturaScreen() {
  const { nav, reducido, leyendaVista, lectura, cap, enPreguntas, setEnPreguntas, pregunta, setPregunta, respuestas, carga, estados, capitulo, oraciones, porOracion, rep, actual, scrollY, scrollRef, altoPie, siguiendo, mostrarVolver, volverAlAudio, alMedirTexto, marcarLeyenda, abrirFrase, irAOracion, siguiente, responder, botonSiguiente } = useLectura();

  if (!lectura) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Lectura" />
        <EmptyState
          title="Esa historia ya no está"
          body="Puede que se haya regenerado lecturas.json con otros ids."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  // Las preguntas llegan solo después de leer (con los datos ya cargados).
  if (enPreguntas && carga.estado === 'listo') {
    const total = lectura.preguntas.length;
    const preguntaActual = lectura.preguntas[pregunta];
    const cerrada = preguntaActual === undefined;
    const dada = respuestas[pregunta];
    const nuevas = lectura.frases.filter((id) => !estados.has(id)).length;
    // Cada botón va en el mismo lugar: «Siguiente» (o «Terminar») entra en el suyo, y el ghost sale con el cierre.
    const pieBoton = cerrada ? (
      <Button label="Volver a las lecturas" onPress={() => nav.goBack()} full size="lg" />
    ) : dada !== undefined ? (
      <Animated.View entering={reducido ? undefined : aparecer()}>
        <Button label={pregunta + 1 >= total ? 'Terminar' : 'Siguiente'} onPress={() => setPregunta((p) => p + 1)} full size="lg" />
      </Animated.View>
    ) : (
      <Button label="Salir sin contestar" variant="ghost" onPress={() => setPregunta(total)} full size="lg" />
    );
    return (
      <Screen scroll footer={pieBoton}>
        <Header
          onBack={cerrada ? () => nav.goBack() : () => setEnPreguntas(false)}
          title={cerrada ? lectura.titulo : 'Tres preguntas'}
        />
        {cerrada ? (
          <CierreLectura nuevas={nuevas} todas={Object.keys(respuestas).length === total} />
        ) : (
          <PreguntaUnaAUna
            pregunta={preguntaActual}
            indice={pregunta}
            respuesta={dada}
            onResponder={(opcion) => responder(pregunta, opcion)}
          />
        )}
      </Screen>
    );
  }

  const ultimo = cap + 1 >= lectura.capitulos.length;
  const listo = carga.estado === 'listo';
  // «Volver a donde va el audio» flota encima del pie (Screen `flotante`): si ocupara lugar dentro del pie, el pie
  // crecería y el texto brincaría. Entra y sale en su propio `Animated.View`: `Button` anima su escala en su propio nodo.
  const volver = mostrarVolver ? (
    <Animated.View
      entering={reducido ? undefined : aparecer()}
      exiting={reducido ? undefined : desaparecer(motionDuration.rapido)}
      style={styles.volver}
    >
      <Button label="Volver a donde va el audio" icon="chevron-down" variant="secondary" onPress={volverAlAudio} />
    </Animated.View>
  ) : null;
  const pie = (
    <View onLayout={(e) => (altoPie.value = e.nativeEvent.layout.height)}>
      <PieReproductor
        rep={rep}
        texto={capitulo?.texto ?? ''}
        siguiente={botonSiguiente}
      />
    </View>
  );

  // Un solo árbol desde el primer cuadro: encabezado, título, leyenda y reproductor salen del JSON y no esperan a la
  // base. Solo el texto espera (sus frases se marcan con lo que ya viste): mientras tanto, su esqueleto ocupa su lugar
  // con el mismo interlineado y se quita de golpe cuando llega.
  return (
    <Screen
      scroll
      scrollY={scrollY}
      scrollRef={scrollRef}
      soltarScroll={siguiendo}
      footer={capitulo?.audio ? pie : undefined}
      flotante={capitulo?.audio ? volver : undefined}
    >
      <Header
        onBack={() => nav.goBack()}
        title={lectura.titulo}
        subtitle={
          lectura.capitulos.length > 1
            ? `Capítulo ${cap + 1} de ${lectura.capitulos.length}`
            : undefined
        }
      />

      {capitulo ? (
        <>
          <Text style={styles.capTitulo} accessibilityRole="header" numberOfLines={2}>
            {capitulo.titulo}
          </Text>

          <LeyendaFrases vista={leyendaVista} onVista={marcarLeyenda} />

          {carga.estado === 'error' ? (
            <ErrorCarga onReintentar={carga.reintentar} />
          ) : !listo ? (
            <View style={styles.textoPendiente}>
              <EsqueletoTexto oraciones={oraciones} visible={carga.demora} />
            </View>
          ) : (
            <TextoAcompanado
              key={cap}
              oraciones={oraciones}
              porOracion={porOracion}
              actual={actual}
              enCurso={rep.enCurso}
              conAudio={Boolean(capitulo.audio) && !rep.apagado}
              onFrase={abrirFrase}
              onOracion={irAOracion}
              alMedir={alMedirTexto}
            />
          )}

          {/* Sin audio no hay pie: el botón de seguir va al final del texto. */}
          {capitulo.audio || !listo ? null : (
            <Button
              label={ultimo ? 'Ver las preguntas' : `Capítulo ${cap + 2}`}
              icon="arrow-right"
              iconAlFinal
              onPress={siguiente}
              full
              size="lg"
            />
          )}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Mismo margen de abajo que TextoAcompanado.
  textoPendiente: { marginBottom: space.lg },
  volver: { alignSelf: 'center' },
  capTitulo: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.text,
    marginBottom: space.sm,
  },
});
