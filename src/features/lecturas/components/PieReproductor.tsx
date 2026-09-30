import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Icon, Presionable, ProgressBar } from '@/shared/ui';
import { OndaVoz } from '@/shared/ui/fx/OndaVoz';
import { type VozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { analizar } from '@/domain/marcas';
import { color, font, layout, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { ReproductorCapitulo } from '@/features/lecturas/hooks/useReproductorCapitulo';

/** Alto de la onda mini, en dp. */
const ALTO_ONDA = 24;
/** Diámetro del botón circular, en dp. */
const DIAMETRO = 56;

/** Texto del botón mientras su lugar solo está reservado (no se ve). */
const ETIQUETA_RESERVA = 'Capítulo';
const nada = () => undefined;

function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

interface Props {
  rep: ReproductorCapitulo;
  /** El texto del capítulo: de él sale la forma de la onda. */
  texto: string;
  /** Cuando el capítulo terminó (el audio o la lectura): a dónde seguir. Sin ello el pie es solo el reproductor. */
  siguiente: { etiqueta: string; onPress: () => void } | null;
}

/**
 * El pie del lector, en la zona del pulgar: un botón circular `primary` con ícono y texto (Escuchar el capítulo, Pausar,
 * Reanudar), Detener como `ghost` mientras hay audio, una onda mini de la voz y la barra de tiempo. El tiempo total no
 * se muestra hasta conocer la duración («—:—»): antes decía «0:00 / 0:00». Al terminar el capítulo aparece «Capítulo N»
 * o «Ver las preguntas» y el botón circular pasa a `secondary`: nunca hay dos acciones principales a la vez.
 */
export function PieReproductor({ rep, texto, siguiente }: Props) {
  const reducido = useMovimientoReducido();
  const { estado, progreso, apagado } = rep;
  const activo = estado === 'sonando' || estado === 'pausado';
  const deshabilitado = apagado || estado === 'cargando';
  const principal = !siguiente;

  const etiqueta =
    estado === 'sonando' ? 'Pausar' : estado === 'pausado' ? 'Reanudar' : estado === 'cargando' ? 'Cargando…' : 'Escuchar el capítulo';
  const alTocar = estado === 'sonando' ? rep.pausar : estado === 'pausado' ? rep.reanudar : () => void rep.escuchar();

  // La onda sigue la posición del audio; su forma sale de los tiempos estimados de las palabras del capítulo.
  const envolvente = useMemo(
    () => (progreso.dur > 0 ? analizar(texto, texto, undefined, progreso.dur).envolvente : []),
    [texto, progreso.dur]
  );
  const voz = useMemo<VozEnVivo>(
    () => ({ pos: rep.pos, activa: rep.sonando, duracion: progreso.dur, lenta: false, sonando: estado === 'sonando', reducido }),
    [rep.pos, rep.sonando, progreso.dur, estado, reducido]
  );

  return (
    <View style={styles.pie}>
      <View style={styles.controles}>
        <Presionable
          key={principal ? 'principal' : 'secundaria'}
          onPress={alTocar}
          disabled={deshabilitado}
          accessibilityRole="button"
          accessibilityLabel={etiqueta}
          style={[styles.accion, deshabilitado && styles.apagado]}
        >
          <View style={[styles.circulo, principal ? styles.circuloPrincipal : styles.circuloSecundario]}>
            <Icon
              name={estado === 'sonando' ? 'pause' : 'play'}
              size="lg"
              color={principal ? color.onPrimario : color.text}
            />
          </View>
          <Text style={styles.etiquetaAccion} numberOfLines={1}>
            {etiqueta}
          </Text>
        </Presionable>
        {activo ? <Button icon="stop" label="Detener" onPress={rep.detener} variant="ghost" /> : null}
      </View>

      <View style={styles.onda}>
        <OndaVoz voz={voz} envolvente={envolvente} alto={ALTO_ONDA} />
      </View>
      <View style={styles.tiempoFila}>
        <View style={styles.barra}>
          <ProgressBar value={progreso.pos} total={progreso.dur} height={4} />
        </View>
        <Text style={styles.tiempo}>{`${mmss(progreso.pos)} / ${progreso.dur > 0 ? mmss(progreso.dur) : '—:—'}`}</Text>
      </View>

      {/* El lugar de «Capítulo N» / «Ver las preguntas» está desde el primer cuadro: si apareciera y empujara, el pie
          crecería y el texto de arriba brincaría (y al llegar al final, el cálculo de «al final» podía ir y volver). */}
      <View
        style={!siguiente && styles.reservado}
        pointerEvents={siguiente ? 'auto' : 'none'}
        accessibilityElementsHidden={!siguiente}
        importantForAccessibility={siguiente ? 'auto' : 'no-hide-descendants'}
      >
        <Button
          label={siguiente?.etiqueta ?? ETIQUETA_RESERVA}
          icon="arrow-right"
          iconAlFinal
          onPress={siguiente?.onPress ?? nada}
          disabled={!siguiente}
          full
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pie: { gap: space.sm },
  controles: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: DIAMETRO },
  reservado: { opacity: 0 },
  accion: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: layout.tapMin, flexShrink: 1 },
  apagado: { opacity: 0.45 },
  circulo: { width: DIAMETRO, height: DIAMETRO, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  circuloPrincipal: { backgroundColor: color.primario },
  circuloSecundario: { backgroundColor: color.surfaceAlt, borderWidth: 1, borderColor: color.borderStrong },
  etiquetaAccion: { flexShrink: 1, fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  onda: { height: ALTO_ONDA },
  tiempoFila: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  barra: { flex: 1 },
  tiempo: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint, fontVariant: ['tabular-nums'] },
});
