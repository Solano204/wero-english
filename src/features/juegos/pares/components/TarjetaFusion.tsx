import React, { useCallback, useEffect, useRef, useState, useEffectEvent, useLayoutEffect } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { FraseKaraoke } from '@/shared/ui/fx/FraseKaraoke';
import { OndaVoz } from '@/shared/ui/fx/OndaVoz';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { marcasDe } from '@/services/marcas';
import { color, font, motionDuration, motionEasing, radius, shadow, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry, ParFicha } from '@/types';
import { FichaPar } from './FichaPar';
import type { Rect } from '@/features/juegos/pares/logic/geometria';

const ALTO_ONDA = 40;
const ESCALA_INICIO = 0.7;
/** La tarjeta llega a su segmento casi como un punto. */
const ESCALA_FIN = 0.06;
const ANCHO_MAX = 420;
// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const TENUE = color.textMuted;
const ENCENDIDA = color.text;

const acotar = (v: number) => {
  'worklet';
  return Math.min(1, Math.max(0, v));
};

interface Punto {
  x: number;
  y: number;
}

interface FantasmaProps {
  ficha: ParFicha;
  /** La ficha en el espacio de la capa. */
  recta: Rect;
  /** El centro de la tarjeta: a donde se funde. */
  hacia: Punto;
  entrada: SharedValue<number>;
}

const SIN_ACCION = () => undefined;

/** Una copia de la ficha que sale del tablero y se funde hacia el centro mientras crece la tarjeta. */
function Fantasma({ ficha, recta, hacia, entrada }: FantasmaProps) {
  const dx = hacia.x - (recta.x + recta.width / 2);
  const dy = hacia.y - (recta.y + recta.height / 2);
  const estilo = useAnimatedStyle(() => {
    const p = entrada.get();
    return {
      opacity: 1 - acotar((p - 0.5) / 0.4),
      transform: [{ translateX: dx * p }, { translateY: dy * p }, { scale: 1 + 0.12 * p }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.fantasma, { left: recta.x, top: recta.y, width: recta.width, height: recta.height }, estilo]}
    >
      <FichaPar
        ficha={ficha}
        recta={{ x: 0, y: 0, width: recta.width, height: recta.height }}
        elevada
        falla={false}
        sacude={false}
        onPress={SIN_ACCION}
      />
    </Animated.View>
  );
}

interface Props {
  /** Las dos fichas del par, para las copias que vuelan. */
  fichas: [ParFicha, ParFicha];
  /** Dónde están en la capa; `null` si aún no se midió el tablero (entonces la tarjeta solo aparece). */
  rectas: [Rect, Rect] | null;
  /** El tamaño de la capa: la tarjeta crece en su centro. */
  capa: { ancho: number; alto: number };
  /** El centro del segmento que se enciende, en la capa. */
  destino: Punto;
  entry: Entry;
  /** El cable terminó: las fichas ya pueden fundirse. Antes la tarjeta espera invisible, pero ya escucha la voz. */
  iniciar: boolean;
  /** La voz terminó (o se saltó, o se salió de la pantalla): la tarjeta se encoge y vuela a su segmento. */
  saliendo: boolean;
  /** Llegó al segmento (o no llegó a mostrarse): quien la trae la retira y enciende el segmento. */
  onAterrizo: () => void;
}

/**
 * La pausa de voz al acertar un par, sin modal negro. Las dos fichas se funden en una sola
 * tarjeta que crece en el centro con un velo de a lo más 0.42; trae la frase en inglés con
 * karaoke y la onda de la voz, y la traducción se enciende cuando suena el español. Al
 * terminar la voz la tarjeta se encoge y vuela a su segmento del progreso.
 *
 * Escucha la voz desde que se monta (antes de que termine el cable): el audio arranca al
 * acertar y no espera a la animación. La reproducción y sus topes viven en la pantalla;
 * esta tarjeta solo la muestra. Con «reducir movimiento» no hay copias que vuelan ni
 * vuelo: la tarjeta aparece y se va con un fundido.
 */
export function TarjetaFusion({ fichas, rectas, capa, destino, entry, iniciar, saliendo, onAterrizo }: Props) {
  const reducido = useMovimientoReducido();
  const vozEn = useVozEnVivo(entry.audio_en);
  const vozEs = useVozEnVivo(entry.audio_es);
  const activaEs = vozEs.activa;
  // Lo que se dice puede diferir de lo que se ve; los tiempos se calculan sobre lo dicho.
  const hablado = entry.phrase_tts || entry.phrase;
  const en = analizar(entry.phrase, hablado, marcasDe(entry.audio_en), vozEn.duracion);
  const es = analizar(entry.spanish_main, entry.spanish_main, undefined, vozEs.duracion);
  // Si el inglés arranca mientras el español se apaga, manda el inglés.
  const hablaEs = vozEs.sonando && !vozEn.sonando;

  const entrada = useSharedValue(0);
  const salida = useSharedValue(0);
  const [lista, setLista] = useState(false);
  const empezo = useRef(false);
  const alLlegar = useRef(onAterrizo);
  useLayoutEffect(() => {
    alLlegar.current = onAterrizo;
  }, [onAterrizo]);
  const marcarLista = () => setLista(true);
  const aterrizar = useCallback(() => alLlegar.current(), []);

  const cx = capa.ancho / 2;
  const cy = capa.alto / 2;
  const hacia = ({ x: cx, y: cy });

  const efectoIniciar = useEffectEvent(() => {
    if (!iniciar || empezo.current) return;
    // La voz ya se acabó (o se saltó) antes de que terminara el cable: no hay nada que mostrar.
    if (saliendo) {
      empezo.current = true;
      aterrizar();
      return;
    }
    empezo.current = true;
    AccessibilityInfo.announceForAccessibility(`Par unido. ${entry.phrase}. ${entry.spanish_main}`);
    entrada.set(withTiming(
      1,
      { duration: reducido ? motionDuration.base : motionDuration.escena, easing: motionEasing.entrar },
      (terminada) => {
        'worklet';
        if (terminada) runOnJS(marcarLista)();
      }
    ));
    // Arranca una sola vez, cuando el cable termina: la voz que cambie después no reinicia la entrada.
  });
  useEffect(() => efectoIniciar(), [iniciar]);

  useEffect(() => {
    if (!saliendo || !lista) return;
    salida.set(withTiming(
      1,
      { duration: reducido ? motionDuration.base : motionDuration.lento, easing: motionEasing.entrar },
      (terminada) => {
        'worklet';
        if (terminada) runOnJS(aterrizar)();
      }
    ));
  }, [saliendo, lista, reducido, salida, aterrizar]);

  useEffect(
    () => () => {
      cancelAnimation(entrada);
      cancelAnimation(salida);
    },
    [entrada, salida]
  );

  const veloEstilo = useAnimatedStyle(() => ({ opacity: entrada.get() * (1 - salida.get()) }));

  const dx = destino.x - cx;
  const dy = destino.y - cy;
  const tarjetaEstilo = useAnimatedStyle(() => {
    const p = entrada.get();
    const s = salida.get();
    if (reducido) return { opacity: p * (1 - s) };
    return {
      opacity: acotar((p - 0.4) / 0.4) * (1 - acotar((s - 0.6) / 0.4)),
      transform: [
        { translateX: s * dx },
        { translateY: s * dy },
        { scale: (ESCALA_INICIO + (1 - ESCALA_INICIO) * p) * (1 - s * (1 - ESCALA_FIN)) },
      ],
    };
  });

  // La traducción se enciende mientras suena el español.
  const traduccionEstilo = useAnimatedStyle(() => ({ color: interpolateColor(activaEs.get(), [0, 1], [TENUE, ENCENDIDA]) }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, styles.velo, veloEstilo]} />
      {!reducido && iniciar && !lista && rectas
        ? rectas.map((recta, i) => {
            const ficha = fichas[i];
            return ficha ? <Fantasma key={ficha.id} ficha={ficha} recta={recta} hacia={hacia} entrada={entrada} /> : null;
          })
        : null}
      <View style={styles.centro}>
        <Animated.View style={[styles.tarjeta, tarjetaEstilo]}>
          <FraseKaraoke palabras={en.palabras} voz={vozEn} tamano="lg" />
          <OndaVoz
            voz={hablaEs ? vozEs : vozEn}
            envolvente={hablaEs ? es.envolvente : en.envolvente}
            alto={ALTO_ONDA}
            tono={hablaEs ? 'neutro' : 'senal'}
          />
          <Animated.Text style={[styles.traduccion, traduccionEstilo]}>{entry.spanish_main}</Animated.Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // El velo nunca pasa de este 42 %: la pantalla se sigue viendo detrás de la tarjeta.
  velo: { backgroundColor: color.veloPortada },
  fantasma: { position: 'absolute' },
  centro: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl },
  tarjeta: {
    alignSelf: 'stretch',
    maxWidth: ANCHO_MAX,
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    ...shadow.card,
  },
  traduccion: {
    fontFamily: font.family.body,
    fontSize: font.size.xl,
    lineHeight: font.size.xl * 1.35,
    textAlign: 'center',
  },
});
