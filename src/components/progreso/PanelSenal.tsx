import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Badge, Card } from '@/components/base';
import { Marcador, MedidorSenal } from '@/components/fx';
import type { Stats } from '@/data/repos/estadisticas';
import { celebrarSiToca } from '@/data/local/celebracion';
import {
  aparecerSubiendo,
  color,
  font,
  motionDuration,
  motionEasing,
  motionEntrada,
  radius,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/utils/accessibility';
import {
  esRecordActual,
  etiquetaMedidor,
  ratio,
  textoDominadas,
  textoRacha,
  textoRecord,
  textoVistas,
} from './datos';

/** Lo que dice el medidor cuando todavía no hay ninguna frase vista. */
const TEXTO_VACIO = 'Una frase se domina cuando la sigues acertando semanas después.';
/** Cuánto se enciende el dorado en el destello del récord. */
const OPACIDAD_DESTELLO = 0.45;

interface Props {
  stats: Stats;
  usuarioId: number | null;
  /** Primera vez por sesión: coreografía de entrada. */
  entrada: boolean;
  scrollY: SharedValue<number>;
  /** Cada cambio da un empujón a la aguja (jalar para refrescar). */
  pulsos: number;
}

function ChipRecord({ texto, actual, celebrar, retraso }: { texto: string; actual: boolean; celebrar: boolean; retraso: number }) {
  const reducido = useMovimientoReducido();
  const destello = useSharedValue(0);

  useEffect(() => {
    if (!celebrar || reducido) return;
    // Un solo destello dorado.
    destello.value = withDelay(
      retraso,
      withSequence(
        withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionDuration.lento, easing: motionEasing.salir })
      )
    );
  }, [celebrar, reducido, retraso, destello]);

  const estilo = useAnimatedStyle(() => ({ opacity: destello.value * OPACIDAD_DESTELLO }));
  return (
    <View style={styles.record}>
      <Badge label={texto} tone={actual ? 'accent' : 'neutral'} />
      <Animated.View pointerEvents="none" style={[styles.destello, estilo]} />
    </View>
  );
}

/**
 * El héroe de Progreso (MOT-3): el medidor de señal con lo dominado, y debajo la
 * racha y el récord. Con 0 frases vistas, el medidor queda en reposo con una
 * explicación en vez de una cifra en cero.
 */
export function PanelSenal({ stats, usuarioId, entrada, scrollY, pulsos }: Props) {
  const [celebrar, setCelebrar] = useState(false);
  const actual = esRecordActual(stats.racha, stats.rachaMax);
  const racha = textoRacha(stats.racha);
  const record = textoRecord(stats.racha, stats.rachaMax);

  useEffect(() => {
    if (!actual || usuarioId === null) return;
    let vivo = true;
    void celebrarSiToca(usuarioId, 'record', String(stats.rachaMax)).then((toca) => {
      if (vivo && toca) setCelebrar(true);
    });
    return () => {
      vivo = false;
    };
  }, [actual, usuarioId, stats.rachaMax]);

  const retrasoChips = entrada ? motionEntrada.chipsProgreso : 0;

  return (
    <Animated.View entering={entrada ? aparecerSubiendo(motionEntrada.hoy) : undefined}>
      <Card>
        <MedidorSenal
          valor={ratio(stats.dominadas, stats.total)}
          activo
          retraso={entrada ? motionEntrada.hoy : 0}
          scrollY={scrollY}
          pulsos={pulsos}
          etiqueta={etiquetaMedidor(stats.dominadas, stats.total, stats.vistas)}
        >
          <View style={styles.centro}>
            <Marcador valor={stats.dominadas} tamano={font.size.display} color={color.text} retraso={entrada ? motionEntrada.hoy : 0} />
            {stats.vistas > 0 ? (
              <>
                <Text style={styles.linea}>{textoDominadas(stats.dominadas, stats.total)}</Text>
                <Text style={styles.suave}>{textoVistas(stats.vistas)}</Text>
              </>
            ) : (
              <Text style={styles.suave}>{TEXTO_VACIO}</Text>
            )}
          </View>
        </MedidorSenal>
        {racha || record ? (
          <Animated.View entering={entrada ? aparecerSubiendo(retrasoChips) : undefined} style={styles.chips}>
            {racha ? <Badge label={racha} icono="fire" iconoColor={color.star} /> : null}
            {record ? (
              <ChipRecord texto={record} actual={actual} celebrar={celebrar} retraso={entrada ? retrasoChips + motionDuration.base : 0} />
            ) : null}
          </Animated.View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  centro: { alignItems: 'center', gap: space.xs },
  linea: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text, textAlign: 'center' },
  suave: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.45,
    color: color.textMuted,
    textAlign: 'center',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.sm },
  record: { alignSelf: 'flex-start' },
  destello: { ...StyleSheet.absoluteFill, borderRadius: radius.pill, backgroundColor: color.star },
});
