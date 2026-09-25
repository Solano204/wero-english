import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Extrapolation,
  FadeIn,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Skeleton } from '@/components/base';
import {
  AnilloMeta,
  BotonSenal,
  Marcador,
  OndaSenal,
  iniciarTransicionHoy,
} from '@/components/fx';
import {
  anillo,
  aparecerSubiendo,
  color,
  font,
  motionDuration,
  motionEasing,
  motionEntrada,
  motionSenal,
  radius,
  reflejo,
  shadow,
  space,
} from '@/theme';
import { conteo, plural, useMovimientoReducido } from '@/utils';
import { dayKey } from '@/utils/date';
import { energiaOnda, metaCumplida } from './consola';
import { celebrarSiToca } from './celebracion';
import type { Modo } from './modos';

interface Props {
  modo: Modo;
  etiquetaBoton: string;
  pendientes: number;
  hoyFrases: number;
  meta: number;
  racha: number;
  usuarioId: number | null;
  /** Hasta que carga, HOY se maqueta pero no se ve ni se toca. */
  listo: boolean;
  /** Pasó la demora de carga: toca el esqueleto. */
  cargando: boolean;
  /** Primera vez por sesión: coreografía de entrada. */
  entrada: boolean;
  /** Cuántas veces se refrescó la pantalla: cada una da un pulso de interferencia en la onda. */
  refrescos?: number;
  onIr: () => void;
}

interface ChipProps {
  valor: number;
  antes?: string;
  despues?: string;
  tinte: string;
  retraso: number;
}

/** Un dato de HOY: el número rueda como un marcador y el resto es texto. */
function ChipDato({ valor, antes, despues, tinte, retraso }: ChipProps) {
  const etiqueta = [antes, valor, despues].filter((p) => p !== undefined).join(' ');
  return (
    <View style={styles.chip} accessible accessibilityLabel={etiqueta}>
      {antes ? <Text style={styles.chipTexto}>{antes}</Text> : null}
      <Marcador valor={valor} tamano={font.size.md} color={tinte} retraso={retraso} etiqueta={String(valor)} />
      {despues ? <Text style={styles.chipTexto}>{despues}</Text> : null}
    </View>
  );
}

/** Barrido de luz que cruza la tarjeta una sola vez al entrar. */
function BarridoLuz({ ancho, activo }: { ancho: number; activo: boolean }) {
  const avance = useSharedValue(0);
  useEffect(() => {
    if (!activo) return;
    avance.value = withDelay(
      motionEntrada.hoy + motionDuration.base,
      withTiming(1, { duration: motionDuration.escena, easing: motionEasing.entrar })
    );
  }, [activo, avance]);
  const estilo = useAnimatedStyle(() => ({
    opacity: interpolate(avance.value, [0, 0.1, 0.9, 1], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateX: interpolate(avance.value, [0, 1], [-ancho, ancho * 1.2]) }, { skewX: '-20deg' }],
  }));
  if (!activo) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.barrido, estilo]}>
      <LinearGradient colors={reflejo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
}

/**
 * HOY como consola de señal: la única pieza destacada de Practicar (ACC-2).
 * Ecualizador de fondo cuya energía sale de las frases pendientes, anillo de
 * meta diaria, tres datos que ruedan como marcador y el botón que abre el modo
 * con la tarjeta expandiéndose a pantalla completa.
 */
export function ConsolaHoy({
  modo,
  etiquetaBoton,
  pendientes,
  hoyFrases,
  meta,
  racha,
  usuarioId,
  listo,
  cargando,
  entrada,
  refrescos = 0,
  onIr,
}: Props) {
  const reducido = useMovimientoReducido();
  const tarjeta = useRef<View>(null);
  const [ancho, setAncho] = useState(0);
  const [celebrar, setCelebrar] = useState(false);

  const encendido = useSharedValue(0);
  const interferencia = useSharedValue(0);
  const contenido = useSharedValue(0);

  useEffect(() => {
    if (!listo) return;
    if (reducido) {
      encendido.value = 1;
      contenido.value = 1;
      return;
    }
    const espera = entrada ? motionEntrada.onda : 0;
    encendido.value = withDelay(espera, withTiming(1, { duration: motionDuration.lento, easing: motionEasing.entrar }));
    contenido.value = withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
  }, [listo, entrada, reducido, encendido, contenido]);

  const cumplida = metaCumplida(hoyFrases, meta);
  useEffect(() => {
    if (!listo || !cumplida || usuarioId === null) return;
    let vivo = true;
    void celebrarSiToca(usuarioId, 'meta', dayKey()).then((toca) => {
      if (vivo && toca) setCelebrar(true);
    });
    return () => {
      vivo = false;
    };
  }, [listo, cumplida, usuarioId]);

  const estiloContenido = useAnimatedStyle(() => ({ opacity: contenido.value }));

  const interferir = () => {
    if (reducido) return;
    const mitad = motionSenal.interferencia / 2;
    interferencia.value = withSequence(
      withTiming(1, { duration: mitad }),
      withTiming(0, { duration: mitad })
    );
  };

  const primerRefresco = useRef(true);
  useEffect(() => {
    if (primerRefresco.current) {
      primerRefresco.current = false;
      return;
    }
    interferir();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refrescos]);

  const alTocar = () => {
    if (reducido) {
      onIr();
      return;
    }
    tarjeta.current?.measureInWindow((x, y, width, height) => {
      if (width === 0) onIr();
      else iniciarTransicionHoy({ x, y, width, height }, onIr);
    });
  };

  const retrasoChips = entrada ? motionEntrada.chips : 0;

  return (
    <Animated.View
      entering={entrada ? aparecerSubiendo(motionEntrada.hoy) : FadeIn.duration(motionDuration.rapido)}
      style={styles.sombra}
    >
      <View
        ref={tarjeta}
        collapsable={false}
        style={styles.hoy}
        onLayout={(e) => setAncho(e.nativeEvent.layout.width)}
        onTouchStart={interferir}
      >
        <View style={styles.recorte} pointerEvents="none">
          <OndaSenal energia={energiaOnda(pendientes)} encendido={encendido} interferencia={interferencia} />
          <BarridoLuz ancho={ancho} activo={entrada && !reducido} />
        </View>
        {cargando ? <Skeleton relleno style={styles.esqueleto} /> : null}
        <Animated.View
          style={[styles.contenido, estiloContenido, !listo && styles.oculto]}
          accessibilityElementsHidden={!listo}
          importantForAccessibility={listo ? 'auto' : 'no-hide-descendants'}
        >
          <View style={styles.fila}>
            <View style={styles.texto}>
              <Text style={styles.etiqueta}>Hoy</Text>
              <Text style={styles.titulo}>{modo.titulo}</Text>
              <Text style={styles.cuerpo}>{modo.cuerpo}</Text>
            </View>
            <AnilloMeta
              valor={hoyFrases}
              total={meta}
              diametro={anillo.hoy}
              trazo={anillo.trazo}
              celebrar={celebrar}
              etiqueta={`Meta diaria: ${hoyFrases} de ${conteo(meta, 'frase')}`}
            >
              <Text style={styles.anilloNumero} numberOfLines={1} adjustsFontSizeToFit>
                {hoyFrases}
                <Text style={styles.anilloMeta}>/{meta}</Text>
              </Text>
            </AnilloMeta>
          </View>
          <View style={styles.chips}>
            {pendientes > 0 ? (
              <ChipDato
                valor={pendientes}
                despues={plural(pendientes, 'pendiente')}
                tinte={color.accent}
                retraso={retrasoChips}
              />
            ) : null}
            {hoyFrases > 0 ? <ChipDato valor={hoyFrases} despues="hoy" tinte={color.accent} retraso={retrasoChips} /> : null}
            {racha > 0 ? (
              <ChipDato
                valor={racha}
                antes="Racha:"
                despues={plural(racha, 'día')}
                tinte={color.star}
                retraso={retrasoChips}
              />
            ) : null}
          </View>
          <BotonSenal label={etiquetaBoton} onPress={alTocar} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // La única superficie de color de la app (ver tokens.ts, decisión 5). La sombra vive
  // fuera de la tarjeta: con `overflow: hidden` en la misma vista, iOS la recortaría.
  sombra: { borderRadius: radius.lg, backgroundColor: color.contraste, ...shadow.card },
  hoy: {
    backgroundColor: color.contraste,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.lg,
  },
  recorte: { ...StyleSheet.absoluteFill, borderRadius: radius.lg, overflow: 'hidden' },
  esqueleto: { borderRadius: radius.lg },
  contenido: { gap: space.lg },
  oculto: { pointerEvents: 'none' },
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  texto: { flex: 1, gap: space.sm },
  etiqueta: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: color.accent,
  },
  titulo: {
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
    color: color.onContraste,
  },
  cuerpo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.onContraste,
  },
  anilloNumero: {
    fontFamily: font.family.display,
    fontSize: font.size.xl,
    fontVariant: ['tabular-nums'],
    color: color.onContraste,
    maxWidth: anillo.hoy - anillo.trazo * 2,
    textAlign: 'center',
  },
  anilloMeta: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.contraste200,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    backgroundColor: color.contraste900,
  },
  chipTexto: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.md,
    color: color.onContraste,
  },
  barrido: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '40%' },
});
