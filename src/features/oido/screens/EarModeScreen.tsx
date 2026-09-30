import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button, EmptyState, ErrorCarga, Header, IconButton, Screen } from '@/shared/ui';
import { Hueso, HuesoBoton, HuesoCirculo, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { AnilloRadio } from '@/features/oido/components/AnilloRadio';
import { BarraSesion } from '@/shared/ui/fx/BarraSesion';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { PuntosRepeticion } from '@/shared/ui/fx/PuntosRepeticion';
import { color, desaparecer, font, fraseEntra, fraseSale, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { useModoOido } from '@/features/oido/hooks/useModoOido';

/** Diámetro del anillo: con poco alto (menos de 700 dp) baja para que todo quepa sin scroll. */
const ANILLO = 176;

const ANILLO_COMPACTO = 144;

const ALTO_COMPACTO = 700;

// Copias locales: un worklet captura un texto, no el objeto de tema entero.
const APAGADA = color.textMuted;

const ENCENDIDA = color.text;

/** A qué ronda (1-3) y qué idioma corresponde el paso `i` de pasosFrase(). */
function interpretaPaso(
  tieneEs: boolean,
  i: number
): { ronda: 1 | 2 | 3; idioma: 'en' | 'es' } {
  if (!tieneEs) {
    return { ronda: (Math.min(i, 2) + 1) as 1 | 2 | 3, idioma: 'en' };
  }
  return {
    ronda: (Math.min(Math.floor(i / 2), 2) + 1) as 1 | 2 | 3,
    idioma: i % 2 === 0 ? 'en' : 'es',
  };
}

/** La traducción: en `textMuted` y se enciende cuando suena el español. Con «reducir movimiento» solo cambia el color. */
function Traduccion({ texto, luz }: { texto: string; luz: boolean }) {
  const reducido = useMovimientoReducido();
  const encendida = useSharedValue(luz ? 1 : 0);

  useEffect(() => {
    const destino = luz ? 1 : 0;
    encendida.value = reducido ? destino : withTiming(destino, { duration: motionDuration.base, easing: motionEasing.entrar });
  }, [luz, reducido, encendida]);

  const estilo = useAnimatedStyle(() => ({ color: interpolateColor(encendida.value, [0, 1], [APAGADA, ENCENDIDA]) }));
  return <Animated.Text style={[styles.spanish, estilo]}>{texto}</Animated.Text>;
}

/**
 * P-09, el Modo Oído.
 *
 * Reproduce frase, pausa y sigue, sin que el usuario toque nada. Es para
 * el camión y para lavar trastes. Por eso la pantalla es enorme y solo
 * tiene un botón principal: no se mira, se escucha.
 */
export function EarModeScreen() {
  const { nav, altoVentana, queue, idx, playing, empezo, pasoIdx, carga, loading, actual, vozEn, vozEs, analisisEn, analisisEs, bolsillo, despertar, estiloBrillo, alternar, saltar } = useModoOido();

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
        {carga.demora ? (
          <ProveedorEsqueleto etiqueta="Preparando el modo oído" style={styles.esqueletoRaiz}>
            <HuesoCirculo diametro={176} style={styles.esqueletoCentrado} />
            <View style={styles.esqueletoTexto}>
              <Hueso width="80%" height={22} style={styles.esqueletoCentrado} />
              <Hueso width="55%" height={16} style={styles.esqueletoCentrado} />
            </View>
            <HuesoBoton size="lg" style={styles.esqueletoCentrado} width={220} />
          </ProveedorEsqueleto>
        ) : null}
      </Screen>
    );
  }

  if (queue.length === 0 || !actual) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Modo oído" />
        <EmptyState
          icon="volume-off"
          title="Sin audio todavía"
          body="Este modo usa frases que ya estudiaste y que tengan audio descargado."
          actionLabel="Ir a estudiar"
          onAction={() => nav.replace('Study')}
        />
      </Screen>
    );
  }

  const tieneEs = Boolean(actual.audio_es);
  const { ronda, idioma } = interpretaPaso(tieneEs, pasoIdx);
  // Solo resalta mientras de verdad está sonando: pasoIdx se queda
  // congelado en el paso a retomar cuando está en pausa.
  const sonandoEs = playing && idioma === 'es';
  const suena = sonandoEs ? vozEs : vozEn;
  const envolvente = (sonandoEs ? analisisEs : analisisEn)?.envolvente ?? [];

  return (
    <Screen padded={false} transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}>
      {/* Cualquier toque despierta la pantalla, sin quitárselo a quien lo recibe (devuelve false). */}
      <View
        style={styles.flex}
        onStartShouldSetResponderCapture={() => {
          despertar();
          return false;
        }}
      >
      <Animated.View style={[styles.cabeza, estiloBrillo]}>
        <Header onBack={() => nav.goBack()} title="Modo oído" subtitle={`${idx + 1} de ${queue.length}`} />
        <View style={styles.barra}>
          <BarraSesion hecho={idx} meta={queue.length} />
        </View>
      </Animated.View>

      <ScrollView style={styles.flex} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <AnilloRadio
          voz={suena}
          envolvente={envolvente}
          diametro={altoVentana < ALTO_COMPACTO ? ANILLO_COMPACTO : ANILLO}
          idioma={idioma}
          activo={playing}
          bolsillo={bolsillo}
        />

        <Animated.View key={actual.id} entering={fraseEntra()} exiting={fraseSale()} style={styles.frase}>
          {analisisEn ? <FraseKaraoke palabras={analisisEn.palabras} voz={vozEn} tamano="display" apagada={sonandoEs} /> : null}
          <Traduccion texto={actual.spanish_main} luz={sonandoEs} />
          <Animated.View style={estiloBrillo}>
            <PuntosRepeticion ronda={ronda} />
          </Animated.View>
        </Animated.View>

        {empezo ? null : (
          <Animated.Text exiting={desaparecer()} style={[styles.hint, estiloBrillo]}>
            Guarda el teléfono. Cada frase suena en inglés y en español, tres veces, para que la repitas en voz alta.
          </Animated.Text>
        )}
      </ScrollView>

      <Animated.View style={[styles.controles, estiloBrillo]}>
        <IconButton icono="previous" etiqueta="Anterior" tamano="lg" onPress={() => saltar(-1)} disabled={idx === 0} />
        <Button
          label={playing ? 'Pausar' : empezo ? 'Reanudar' : 'Empezar'}
          icon={playing ? 'pause' : 'play'}
          onPress={alternar}
          size="lg"
          style={styles.principal}
        />
        <IconButton
          icono="next"
          etiqueta="Siguiente"
          tamano="lg"
          onPress={() => saltar(1)}
          disabled={idx >= queue.length - 1}
        />
      </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  esqueletoRaiz: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xxl, paddingHorizontal: space.xl },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoTexto: { gap: space.sm, alignItems: 'center' },
  flex: { flex: 1 },
  cabeza: { paddingHorizontal: space.lg, paddingTop: space.sm },
  // El halo de la barra ocupa 24 dp; se le devuelve lo que sobra para que no separe el contenido.
  barra: { marginTop: -space.sm, marginBottom: -space.sm },
  // El contenido se centra entre el encabezado y los controles; si una frase larga no cabe, la zona hace scroll.
  body: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: layout.screenPad,
    paddingVertical: space.md,
  },
  frase: { alignSelf: 'stretch', alignItems: 'center', gap: space.md },
  spanish: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.3,
    textAlign: 'center',
  },
  hint: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
    paddingHorizontal: space.lg,
  },
  // Los controles van fijos abajo, con el aspecto del footer de `Screen`, en la zona del pulgar.
  controles: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: layout.screenPad,
    paddingTop: space.md,
    paddingBottom: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.borderStrong,
    backgroundColor: color.bgFin,
  },
  principal: { flex: 1 },
});
