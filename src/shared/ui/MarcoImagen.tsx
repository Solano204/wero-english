import React, { useEffect, useState, useEffectEvent } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui/Icon';
import { Hueso, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { PuntoMundo } from '@/shared/ui/PuntoMundo';
import { hayImagen } from './SceneImage';
import { imageSource } from '@/services/media';
import { blur, color, motionDuration, radius } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

const RAZON = 16 / 9;
const FADE_MS = motionDuration.base;
const REVELA_MS = 320;
/** Al entrar en Detalle, la imagen se aleja un poco: de 1.06 a 1. */
const ZOOM_INICIAL = 1.06;
/** Se queda atrás con el scroll: da profundidad sin moverse 1:1. */
const PARALAJE = 0.3;
/** Tope del desplazamiento que cuenta para el paralaje (dp): más que esto no suma nada más. */
const TOPE_PARALAJE = 400;

const AnimatedImage = Animated.createAnimatedComponent(Image);

interface Props {
  path: string | null;
  /** El punto de color del mundo, esquina inferior izquierda del estado vacío. */
  tinte?: string;
  /** Id del mundo, para el ícono del estado vacío. */
  mundo?: string;
  /** Ancho fijo (p. ej. el de la carta del mazo o el tope de alto de Estudio, ya convertido a ancho). */
  ancho?: number;
  /** Alto fijo. Solo tiene efecto junto con `ancho`; sin él, se estira al contenedor con 16:9. */
  alto?: number;
  /** Antes de responder, en los ejercicios donde la imagen regala el significado (Estudio). */
  desenfocada?: boolean;
  /** Con esto, la imagen se queda atrás al hacer scroll (Detalle). */
  scrollY?: SharedValue<number>;
  /** Con esto, la imagen se aleja un poco al aparecer: de 1.06 a 1 (Detalle). */
  zoomEntrada?: boolean;
  style?: ViewStyle;
}

/**
 * El espacio de la imagen de una frase: siempre el mismo lugar y tamaño, con imagen o sin
 * ella, para que nada "brinque" al cargar. Un solo componente para Estudio, Detalle y
 * Frases sueltas.
 *
 * Sin archivo: fondo sobrio (degradado + patrón diagonal al 4 %) y un ícono chico, nunca
 * iniciales. Con archivo: mientras la foto carga, un hueso con brillo (del mismo
 * `surfaceAlt` que el fondo del marco, así que no hay salto de color) y luego un fundido
 * de 220 ms; si falla, el estado vacío. `desenfocada` la muestra con blur fuerte
 * y la imagen a mitad de opacidad; al quitarse, sube a opacidad completa en 320 ms.
 * `scrollY`/`zoomEntrada` son solo de Detalle. Con reducir movimiento no hay fundido,
 * paralaje ni zoom, y el desenfoque se quita de golpe.
 */
export function MarcoImagen({ path, tinte, mundo, ancho, alto, desenfocada = false, scrollY, zoomEntrada = false, style }: Props) {
  const reducido = useMovimientoReducido();
  const [cargada, setCargada] = useState(false);
  const [fallo, setFallo] = useState(false);
  const opacidadCarga = useSharedValue(0);
  const revelo = useSharedValue(desenfocada && !reducido ? 0 : 1);
  const zoom = useSharedValue(zoomEntrada && !reducido ? ZOOM_INICIAL : 1);

  const source = imageSource(path);
  const conImagen = Boolean(source) && !fallo && hayImagen(path);

  // Cambió la frase (o su imagen): se olvida el fallo/carga anterior y se vuelve a fundir.
  useEffect(() => {
    setCargada(false);
    setFallo(false);
    opacidadCarga.set(0);
  }, [path, opacidadCarga]);

  useEffect(() => {
    revelo.set(reducido ? (desenfocada ? 0 : 1) : withTiming(desenfocada ? 0 : 1, { duration: REVELA_MS }));
  }, [desenfocada, reducido, revelo]);

  const alMontar = useEffectEvent(() => {
    if (!zoomEntrada) return;
    zoom.set(reducido ? 1 : withTiming(1, { duration: motionDuration.escena }));
    // Solo al montar: es la llegada de la pantalla, no cada cambio de imagen.
  });
  useEffect(() => alMontar(), []);

  const imagenAnim = useAnimatedStyle(() => {
    const desplazamiento = scrollY ? Math.min(Math.max(scrollY.get(), 0), TOPE_PARALAJE) * PARALAJE : 0;
    return {
      // Antes de revelar queda a mitad de opacidad, no invisible: se ve que hay algo debajo del blur.
      opacity: opacidadCarga.get() * (0.5 + 0.5 * revelo.get()),
      transform: [{ translateY: reducido ? 0 : desplazamiento }, { scale: zoom.get() }],
    };
  });
  const blurAnim = useAnimatedStyle(() => ({ opacity: 1 - revelo.get() }));

  const caja: ViewStyle = ancho && alto ? { width: ancho, height: alto } : { alignSelf: 'stretch', aspectRatio: RAZON };

  return (
    <View style={[styles.marco, caja, style]} accessible={false} importantForAccessibility="no-hide-descendants">
      <EstadoVacio tinte={tinte} mundo={mundo} visible={!conImagen} />
      {conImagen && !cargada ? (
        <ProveedorEsqueleto etiqueta="Cargando la imagen" style={StyleSheet.absoluteFill}>
          <Hueso radius={0} style={StyleSheet.absoluteFill} />
        </ProveedorEsqueleto>
      ) : null}
      {conImagen ? (
        <AnimatedImage
          source={source ?? undefined}
          contentFit="cover"
          onLoad={() => {
            setCargada(true);
            opacidadCarga.set(reducido ? 1 : withTiming(1, { duration: FADE_MS }));
          }}
          onError={() => setFallo(true)}
          style={[StyleSheet.absoluteFill, imagenAnim]}
        />
      ) : null}
      {conImagen && desenfocada && !reducido ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, blurAnim]}>
          <BlurView intensity={blur.fuerte} tint="dark" style={StyleSheet.absoluteFill} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function EstadoVacio({ tinte, mundo, visible }: { tinte?: string; mundo?: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <LinearGradient colors={[color.surface, color.surfaceAlt]} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <Pattern id="marcoImagenPatron" width={14} height={14} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1="0" y1="0" x2="0" y2="14" stroke={color.textFaint} strokeOpacity={0.04} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#marcoImagenPatron)" />
      </Svg>
      <View style={styles.centro}>
        <Icon name="image" size="lg" color={color.textFaint} />
      </View>
      {tinte ? (
        <View style={styles.puntoWrap}>
          <PuntoMundo tinte={tinte} mundo={mundo} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  marco: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    overflow: 'hidden',
    backgroundColor: color.surfaceAlt,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  puntoWrap: { position: 'absolute', left: 10, bottom: 10 },
});
