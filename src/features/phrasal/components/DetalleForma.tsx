import React, { useCallback, useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Badge, Card, NotaInfo, Presionable } from '@/shared/ui';
import { AudioButton } from '@/shared/ui/AudioButton';
import { GrupoAudio, type ControlAudio } from '@/shared/ui/GrupoAudio';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { useVozFrase } from '@/shared/ui/fx/useVozFrase';
import { rangoEnFrase } from '@/domain/cazala';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, layout, motionDuration, motionEasing, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { PhrasalVerb } from '@/types';

/** Cuánto se desplaza el contenido al cambiar de forma, en dp. */
const DESPLAZA = space.md;
const PERSPECTIVA = 600;

/**
 * Si el usuario ya tocó algún botón de audio desde que abrió la app. Solo entonces la frase suena sola al cambiar de
 * partícula; antes de eso la ruleta nunca habla por su cuenta. Vive en el módulo: dura lo que la sesión y no se guarda.
 */
let escuchoAlgunaVez = false;

interface Props {
  forma: PhrasalVerb;
  /** +1 si la forma nueva viene después de la que se veía, -1 si viene antes: hacia dónde se desplaza el cambio. */
  direccion: 1 | -1;
  /** `y` al girar la ruleta (el contenido sube o baja); `x` con los chips o deslizando la tarjeta. */
  eje: 'x' | 'y';
}

/**
 * La tarjeta de la forma elegida: la frase completa con karaoke y su grupo Escuchar · Lento, el significado en `xl` con
 * su audio en español, el ejemplo en una sub-tarjeta (la partícula resaltada; tocar la frase la reproduce; Inglés ·
 * Lento · Español) y la nota. «Cuidado» y «Fuerte» van junto a la frase.
 *
 * Al cambiar de forma el contenido sale (`rapido`, en la dirección del giro), cambia y entra (`base`) desde el lado
 * contrario, y el significado da un giro vertical: todo sale de un solo valor compartido en el hilo de UI, y no de
 * animaciones de montaje, para que lo que sale y lo que entra nunca ocupen lugar a la vez. Con «reducir movimiento»
 * cambia sin más. Si el usuario ya usó el audio, la frase nueva suena sola cuando aparece.
 */
export function DetalleForma({ forma, direccion, eje }: Props) {
  const reducido = useMovimientoReducido();
  const [mostrada, setMostrada] = useState(forma);
  const mostradaId = useRef(forma.id);
  useLayoutEffect(() => {
    mostradaId.current = mostrada.id;
  }, [mostrada]);
  const v = useSharedValue(0);
  const ejeY = useSharedValue(eje === 'y' ? 1 : 0);

  useEffect(() => {
    if (forma.id === mostradaId.current) {
      // Volvió a la que se ve: se termina de mostrar.
      v.set(reducido ? 0 : withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.entrar }));
      return;
    }
    if (reducido) {
      setMostrada(forma);
      return;
    }
    ejeY.set(eje === 'y' ? 1 : 0);
    const cambiar = () => {
      setMostrada(forma);
      v.set(direccion);
      v.set(withTiming(0, { duration: motionDuration.base, easing: motionEasing.entrar }));
    };
    v.set(withTiming(-direccion, { duration: motionDuration.rapido, easing: motionEasing.salir }, (fin) => {
      if (fin) runOnJS(cambiar)();
    }));
    return () => cancelAnimation(v);
  }, [forma, direccion, eje, reducido, v, ejeY]);

  const contenido = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(v.get()),
    transform: [{ translateX: (1 - ejeY.get()) * v.get() * DESPLAZA }, { translateY: ejeY.get() * v.get() * DESPLAZA }],
  }));
  const flip = useAnimatedStyle(() => ({
    opacity: 1 - Math.abs(v.get()),
    transform: [{ perspective: PERSPECTIVA }, { rotateX: `${v.get() * 90}deg` }],
  }));

  const frase = useVozFrase(mostrada.frase, mostrada.audio_frase, mostrada.audio_frase_lento);
  const ejemplo = useVozFrase(mostrada.ejemplo, mostrada.audio_ejemplo, mostrada.audio_ejemplo_lento);
  const vozTraduccion = useVozEnVivo(mostrada.audio_traduccion);

  // La frase nueva suena sola al aparecer (después del cambio, para que su karaoke ya esté escuchando).
  const primera = useRef(true);
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (escuchoAlgunaVez) void audio.play(mostrada.audio_frase);
  }, [mostrada.id, mostrada.audio_frase]);
  useEffect(() => () => audio.stop(), []);

  const destacadas = useMemo(() => {
    const rango = rangoEnFrase(mostrada.ejemplo, mostrada.particula);
    if (!rango) return undefined;
    const indices = new Set<number>();
    for (let i = rango[0]; i <= rango[1]; i++) indices.add(i);
    return indices;
  }, [mostrada.ejemplo, mostrada.particula]);

  const marcarEscucho = useCallback(() => {
    escuchoAlgunaVez = true;
  }, []);
  const sonar = useCallback((ruta: string, lento: boolean) => {
    escuchoAlgunaVez = true;
    haptics.tapLight();
    void (lento ? audio.playSlow(ruta) : audio.play(ruta));
  }, []);

  const controlesFrase: ControlAudio[] = [
    { clave: 'frase', etiqueta: 'Escuchar', descripcion: `Escuchar ${mostrada.frase}`, icono: 'play', ruta: mostrada.audio_frase, lento: false, suena: frase.sonandoNormal },
    { clave: 'frase-lento', etiqueta: 'Lento', descripcion: `Escuchar ${mostrada.frase} lento`, icono: 'slow', ruta: mostrada.audio_frase_lento, lento: true, suena: frase.sonandoLenta },
  ];
  const controlesEjemplo: ControlAudio[] = [
    { clave: 'en', etiqueta: 'Inglés', descripcion: 'Escuchar el ejemplo en inglés', icono: 'play', ruta: mostrada.audio_ejemplo, lento: false, suena: ejemplo.sonandoNormal },
    { clave: 'lento', etiqueta: 'Lento', descripcion: 'Escuchar el ejemplo lento', icono: 'slow', ruta: mostrada.audio_ejemplo_lento, lento: true, suena: ejemplo.sonandoLenta },
    { clave: 'es', etiqueta: 'Español', descripcion: 'Escuchar el ejemplo en español', icono: 'play', ruta: mostrada.audio_traduccion, lento: false, suena: vozTraduccion.sonando },
  ];

  return (
    <Card>
      <Animated.View style={[styles.bloque, contenido]}>
        <View style={styles.fraseFila}>
          <FraseKaraoke palabras={frase.palabras} voz={frase.voz} tamano="lg" alinear="inicio" />
          {mostrada.vulgaridad === 2 ? (
            <Badge label="Fuerte" tone="strong" small />
          ) : mostrada.vulgaridad === 1 ? (
            <Badge label="Cuidado" tone="warn" small />
          ) : null}
        </View>
        <GrupoAudio controles={controlesFrase} alSonar={sonar} />
      </Animated.View>

      <Animated.View style={[styles.significadoFila, flip]}>
        <Text style={styles.significado}>{mostrada.significado}</Text>
        <AudioButton
          path={mostrada.audio_significado}
          size="sm"
          descripcion="Escuchar el significado en español"
          onBeforePlay={marcarEscucho}
        />
      </Animated.View>

      <Animated.View style={[styles.bloque, contenido]}>
        <View style={styles.ejemplo}>
          <Presionable
            onPress={() => sonar(mostrada.audio_ejemplo, false)}
            accessibilityRole="button"
            accessibilityLabel={mostrada.ejemplo}
            accessibilityHint="Escuchar el ejemplo en inglés"
            style={styles.ejemploFrase}
          >
            <FraseKaraoke
              palabras={ejemplo.palabras}
              voz={ejemplo.voz}
              tamano="md"
              alinear="inicio"
              destacadas={destacadas}
              apagada={vozTraduccion.sonando}
            />
          </Presionable>
          <Text style={[styles.traduccion, vozTraduccion.sonando && styles.traduccionSuena]}>{mostrada.traduccion}</Text>
          <GrupoAudio controles={controlesEjemplo} alSonar={sonar} />
        </View>
        <NotaInfo>
          <Text style={styles.nota}>{mostrada.nota}</Text>
        </NotaInfo>
        {mostrada.separable ? (
          <Text style={styles.separable}>
            Separable: el objeto puede ir en medio ({mostrada.verbo} it {mostrada.particula})
          </Text>
        ) : null}
      </Animated.View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: space.md },
  fraseFila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: space.xs },
  significadoFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  significado: { flex: 1, fontFamily: font.family.body, fontSize: font.size.xl, lineHeight: font.size.xl * 1.4, color: color.text },
  ejemplo: { gap: space.md, padding: space.lg, borderRadius: radius.md, backgroundColor: color.surfaceAlt },
  ejemploFrase: { minHeight: layout.tapMin, justifyContent: 'center' },
  traduccion: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  traduccionSuena: { color: color.text },
  nota: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.text },
  separable: { fontFamily: font.family.body, fontSize: font.size.sm, lineHeight: font.size.sm * 1.45, color: color.textMuted },
});
