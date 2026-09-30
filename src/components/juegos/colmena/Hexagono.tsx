import React, { memo, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Polygon, Stop } from 'react-native-svg';
import { Icon } from '@/shared/ui/Icon';
import { Presionable } from '@/shared/ui/Presionable';
import { color, font, motionColmena, motionDuration, motionEasing, motionSpring, radius, senal } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { puntosHexagono } from './geometria';

/** Lo que tarda una ficha en llegar a su ranura. */
export const DURACION_VUELO = motionDuration.base;
/** Cuánto se levanta la ficha a media trayectoria. */
const ARCO = 14;
/** Una letra que no va llega hasta aquí del camino (0 a 1) y vuelve. */
const LLEGA = 0.55;
/** La ficha entra al panal creciendo desde esta escala. */
const ENTRA_DESDE = 0.5;
const FILO = 1.5;
/** Desde qué punto del vuelo (0 a 1) el hexágono se funde con la ranura. */
const FUNDE_DESDE = 0.45;
/** Con la ronda resuelta los contornos del panal se quedan a esta opacidad, detrás de la frase. */
const OPACIDAD_TENUE = 0.35;

/** Una ficha que vuela a su ranura: por un toque, por una pista o porque la ayuda completó la frase. */
export interface Vuelo {
  /** Del centro del hexágono al centro de su ranura. */
  dx: number;
  dy: number;
  /** El tamaño de la ranura, y el de su letra: el hexágono se aplasta hasta esa proporción. */
  ranuraAncho: number;
  ranuraAlto: number;
  fuente: number;
  /** Cuánto espera antes de salir (el brillo de la pista, o el escalón de «No me sale»). */
  retraso: number;
  tipo: 'toque' | 'pista' | 'ayuda';
}

/** Una letra que no va: la ficha va hacia la ranura que sigue y regresa. */
export interface Rechazo {
  id: number;
  dx: number;
  dy: number;
}

interface ContornoProps {
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** La ronda se resolvió: el contorno se atenúa y queda de fondo de la frase. */
  atenuado: boolean;
  /** Se pasa a la ronda siguiente: el contorno sale hacia abajo. */
  saliendo: boolean;
  /** Cuánto espera para salir (el escalón de su distancia al centro). */
  retrasoSalida: number;
}

/**
 * El lugar del hexágono cuando su ficha se fue: un contorno fino que no se toca. Al resolverse la ronda se
 * atenúa y queda de fondo; al pasar a la siguiente, sale hacia abajo y se desvanece: es el panal que se deshace.
 * Con «reducir movimiento» solo cambia la opacidad.
 */
export const ContornoHex = memo(function ContornoHex({ x, y, ancho, alto, atenuado, saliendo, retrasoSalida }: ContornoProps) {
  const reducido = useMovimientoReducido();
  const tenue = useSharedValue(0);
  const salida = useSharedValue(0);

  useEffect(() => {
    tenue.value = withTiming(atenuado ? 1 : 0, {
      duration: reducido ? motionDuration.rapido : motionDuration.base,
      easing: motionEasing.entrar,
    });
  }, [atenuado, reducido, tenue]);

  useEffect(() => {
    if (!saliendo) return;
    const ir = withTiming(1, {
      duration: reducido ? motionDuration.rapido : motionColmena.salida / 2,
      easing: motionEasing.salir,
    });
    salida.value = reducido || retrasoSalida <= 0 ? ir : withDelay(retrasoSalida, ir);
  }, [saliendo, reducido, retrasoSalida, salida]);

  const estilo = useAnimatedStyle(() => ({
    opacity: (1 - (1 - OPACIDAD_TENUE) * tenue.value) * (1 - salida.value),
    transform: [{ translateY: reducido ? 0 : salida.value * motionColmena.caeDp * 1.5 }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[styles.abs, { left: x, top: y, width: ancho, height: alto }, estilo]}
    >
      <Svg width={ancho} height={alto}>
        <Polygon points={puntosHexagono(ancho, alto, 0.5)} fill="none" stroke={color.border} strokeWidth={1} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
});

const CARA = { fondo: color.surfaceAlt, borde: color.border, letra: color.text };
const CARA_AYUDA = { fondo: color.wrongSoft, borde: color.wrong, letra: color.wrong };

interface RastroProps {
  /** El mismo avance (0 a 1) que mueve la ficha: cada punto va un poco atrás en el camino. */
  avance: SharedValue<number>;
  vx: SharedValue<number>;
  vy: SharedValue<number>;
  atraso: number;
  opacidad: number;
}

function PuntoRastro({ avance, vx, vy, atraso, opacidad }: RastroProps) {
  const estilo = useAnimatedStyle(() => {
    const p = avance.value;
    const q = Math.max(0, p - atraso);
    return {
      opacity: p > 0 && p < 1 ? opacidad * (1 - p) : 0,
      transform: [
        { translateX: (q - p) * vx.value },
        { translateY: (q - p) * vy.value - ARCO * (Math.sin(Math.PI * q) - Math.sin(Math.PI * p)) },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={[styles.punto, estilo]} />;
}

interface Props {
  indice: number;
  letra: string;
  /** Donde va la esquina del hexágono en el panal, y su tamaño. */
  x: number;
  y: number;
  ancho: number;
  alto: number;
  /** El alto del área táctil (el de la fila del panal). */
  toque: number;
  /** Cuánto espera en aparecer cuando se arma el panal (del centro hacia afuera). */
  entrada: number;
  vuelo: Vuelo | null;
  rechazo: Rechazo | null;
  /** La ronda se resolvió: si esta ficha no se usó (es un señuelo), cae y se desvanece. */
  cae: boolean;
  retrasoCae: number;
  onTocar: (indice: number) => void;
}

/**
 * Una ficha del panal: un hexágono con su letra. Al tocarla se levanta, vuela a su ranura y se aplasta hasta la
 * proporción de la ranura mientras se funde con ella (la letra no se deforma); en el panal queda su contorno. Una
 * letra que no va llega a medio camino, rebota de regreso con la sacudida estándar y destella en ámbar con `close`.
 * La pista la enciende en `senal` un instante y va sola, con un rastro de luz. Todo va en valores compartidos:
 * el estado de la pantalla solo dice qué ficha vuela y hacia dónde. Con «reducir movimiento» no hay vuelo ni
 * rebote: la ficha se desvanece y la letra aparece en su ranura.
 */
export const Hexagono = memo(function Hexagono({ indice, letra, x, y, ancho, alto, toque, entrada, vuelo, rechazo, cae, retrasoCae, onTocar }: Props) {
  const reducido = useMovimientoReducido();
  const avance = useSharedValue(0);
  const vx = useSharedValue(0);
  const vy = useSharedValue(0);
  const rx = useSharedValue(1);
  const ry = useSharedValue(1);
  const fr = useSharedValue(1);
  const morph = useSharedValue(0);
  const opacidad = useSharedValue(0);
  const entra = useSharedValue(reducido ? 1 : ENTRA_DESDE);
  const brillo = useSharedValue(0);
  const destello = useSharedValue(0);
  const caida = useSharedValue(0);
  const [sacude, setSacude] = useState(false);
  // La capa del destello ámbar solo se monta si esta ficha llega a equivocarse: 26 SVG menos en reposo.
  const [conAviso, setConAviso] = useState(false);

  // Al armarse el panal: cada ficha crece y se aclara con el escalón de su distancia al centro.
  useEffect(() => {
    const espera = reducido ? 0 : entrada;
    const abrir = (valor: number) => (espera > 0 ? withDelay(espera, valor) : valor);
    opacidad.value = abrir(
      withTiming(1, { duration: reducido ? motionDuration.rapido : motionDuration.base, easing: motionEasing.entrar })
    );
    if (!reducido) entra.value = abrir(withSpring(1, motionSpring.rebote));
    // Solo cuenta la entrada del montaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Un señuelo, con la ronda ya resuelta: cae y se desvanece. Las fichas que se usaron ya se fueron volando.
  useEffect(() => {
    if (!cae || vuelo) return;
    const caer = withTiming(1, {
      duration: reducido ? motionDuration.rapido : motionColmena.cae,
      easing: motionEasing.salir,
    });
    caida.value = reducido || retrasoCae <= 0 ? caer : withDelay(retrasoCae, caer);
  }, [cae, vuelo, reducido, retrasoCae, caida]);

  // Vuela a su ranura.
  useEffect(() => {
    if (!vuelo) return;
    if (reducido) {
      opacidad.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir });
      return;
    }
    vx.value = vuelo.dx;
    vy.value = vuelo.dy;
    rx.value = vuelo.ranuraAncho / ancho;
    ry.value = vuelo.ranuraAlto / alto;
    fr.value = vuelo.fuente / font.size.xl;
    morph.value = 1;
    const llegar = withTiming(1, { duration: DURACION_VUELO, easing: motionEasing.entrar });
    avance.value = 0;
    avance.value = vuelo.retraso > 0 ? withDelay(vuelo.retraso, llegar) : llegar;
    // Al llegar la ficha se apaga y deja su lugar a la letra de la ranura.
    opacidad.value = withDelay(
      vuelo.retraso + DURACION_VUELO,
      withTiming(0, { duration: motionDuration.rapido / 2, easing: motionEasing.salir })
    );
    if (vuelo.tipo === 'pista') {
      brillo.value = withSequence(
        withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withDelay(
          Math.max(0, vuelo.retraso - motionDuration.rapido) + DURACION_VUELO,
          withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir })
        )
      );
    }
    // Un vuelo nuevo es un objeto nuevo: solo él lo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vuelo]);

  // Una letra que no va: llega, rebota de regreso y destella en ámbar.
  useEffect(() => {
    if (!rechazo) return undefined;
    setConAviso(true);
    setSacude(true);
    const t = setTimeout(() => setSacude(false), motionDuration.base);
    vx.value = rechazo.dx;
    vy.value = rechazo.dy;
    morph.value = 0;
    fr.value = 1;
    destello.value = withSequence(
      withTiming(1, { duration: motionDuration.rapido / 2, easing: motionEasing.entrar }),
      withDelay(motionDuration.base, withTiming(0, { duration: motionDuration.base, easing: motionEasing.salir }))
    );
    if (!reducido) {
      avance.value = withSequence(
        withTiming(LLEGA, { duration: motionDuration.rapido, easing: motionEasing.entrar }),
        withSpring(0, motionSpring.rebote)
      );
    }
    return () => clearTimeout(t);
    // Un rechazo nuevo es un objeto nuevo: solo él lo dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rechazo]);

  const lugar = useAnimatedStyle(() => {
    const p = avance.value;
    return {
      opacity: opacidad.value * (1 - caida.value),
      zIndex: p > 0 ? 10 : 0,
      transform: [
        { translateX: vx.value * p },
        { translateY: vy.value * p - ARCO * Math.sin(Math.PI * p) + (reducido ? 0 : caida.value * motionColmena.caeDp) },
        { scale: entra.value },
      ],
    };
  });
  // El hexágono se aplasta hasta la proporción de la ranura y se funde con ella en la segunda mitad del vuelo.
  const cara = useAnimatedStyle(() => {
    const q = morph.value * Math.min(1, Math.max(0, (avance.value - FUNDE_DESDE) / (1 - FUNDE_DESDE)));
    return { opacity: 1 - q, transform: [{ scaleX: 1 + (rx.value - 1) * q }, { scaleY: 1 + (ry.value - 1) * q }] };
  });
  const ranura = useAnimatedStyle(() => ({
    opacity: morph.value * Math.min(1, Math.max(0, (avance.value - FUNDE_DESDE) / (1 - FUNDE_DESDE))),
  }));
  const texto = useAnimatedStyle(() => ({ transform: [{ scale: 1 + (fr.value - 1) * avance.value }] }));
  const luz = useAnimatedStyle(() => ({ opacity: brillo.value }));
  const aviso = useAnimatedStyle(() => ({ opacity: destello.value }));

  const paleta = vuelo?.tipo === 'ayuda' ? CARA_AYUDA : CARA;
  const enPanal = vuelo === null;
  return (
    <Animated.View
      pointerEvents={enPanal ? 'auto' : 'none'}
      importantForAccessibility={enPanal ? 'auto' : 'no-hide-descendants'}
      style={[styles.abs, { left: x, top: y, width: ancho, height: alto }, lugar]}
    >
      <Animated.View style={[styles.abs, styles.llena, cara]}>
        <Svg width={ancho} height={alto}>
          <Polygon
            points={puntosHexagono(ancho, alto, FILO / 2)}
            fill={paleta.fondo}
            stroke={paleta.borde}
            strokeWidth={FILO}
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {vuelo ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ranura,
            {
              left: (ancho - vuelo.ranuraAncho) / 2,
              top: (alto - vuelo.ranuraAlto) / 2,
              width: vuelo.ranuraAncho,
              height: vuelo.ranuraAlto,
              backgroundColor: vuelo.tipo === 'ayuda' ? color.wrongSoft : color.accentSoft,
              borderBottomColor: vuelo.tipo === 'ayuda' ? color.wrong : color.accent,
            },
            ranura,
          ]}
        />
      ) : null}

      {conAviso ? (
        <Animated.View pointerEvents="none" style={[styles.abs, styles.llena, aviso]}>
          <Svg width={ancho} height={alto}>
            <Polygon
              points={puntosHexagono(ancho, alto, FILO / 2)}
              fill={color.wrongSoft}
              stroke={color.wrong}
              strokeWidth={FILO}
              strokeLinejoin="round"
            />
          </Svg>
          <View style={styles.icono}>
            <Icon name="close" size="sm" color={color.wrong} />
          </View>
        </Animated.View>
      ) : null}

      <Animated.Text allowFontScaling={false} style={[styles.letra, { lineHeight: alto, color: paleta.letra }, texto]}>
        {letra}
      </Animated.Text>

      {vuelo?.tipo === 'pista' ? (
        <>
          <Animated.View pointerEvents="none" style={[styles.abs, styles.llena, luz]}>
            <Svg width={ancho} height={alto}>
              <Defs>
                <LinearGradient id="senal" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={senal[0]} />
                  <Stop offset="0.5" stopColor={senal[1]} />
                  <Stop offset="1" stopColor={senal[2]} />
                </LinearGradient>
              </Defs>
              <Polygon points={puntosHexagono(ancho, alto, 2)} fill="none" stroke="url(#senal)" strokeWidth={3} strokeLinejoin="round" />
            </Svg>
          </Animated.View>
          <PuntoRastro avance={avance} vx={vx} vy={vy} atraso={0.1} opacidad={0.7} />
          <PuntoRastro avance={avance} vx={vx} vy={vy} atraso={0.2} opacidad={0.45} />
          <PuntoRastro avance={avance} vx={vx} vy={vy} atraso={0.3} opacidad={0.25} />
        </>
      ) : null}

      <Presionable
        onPress={() => onTocar(indice)}
        disabled={!enPanal}
        accessibilityRole="button"
        accessibilityLabel={`Letra ${letra}`}
        accessibilityState={{ disabled: !enPanal }}
        resultado={sacude ? 'fallo' : null}
        style={[styles.toque, { top: (alto - toque) / 2, height: toque }]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  abs: { position: 'absolute' },
  llena: { left: 0, top: 0, right: 0, bottom: 0 },
  letra: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    textAlign: 'center',
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
  },
  ranura: {
    position: 'absolute',
    borderRadius: radius.sm,
    borderBottomWidth: 2,
  },
  icono: { position: 'absolute', left: 0, right: 0, top: 4, alignItems: 'center' },
  toque: { position: 'absolute', left: 0, right: 0 },
  punto: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 8,
    height: 8,
    marginLeft: -4,
    marginTop: -4,
    borderRadius: radius.pill,
    backgroundColor: senal[1],
  },
});
