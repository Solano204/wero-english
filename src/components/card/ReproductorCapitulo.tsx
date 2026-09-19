import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { Button, ProgressBar } from '@/components/base';
import * as audio from '@/services/audio';
import { color, font, space } from '@/theme';
import { hayAudio } from './AudioButton';

type Estado = 'idle' | 'cargando' | 'sonando' | 'pausado';

const TICK_MS = 250;
/** El player se queda un pelo antes de la duración al terminar. */
const FIN_MARGEN_S = 0.3;
const SIN_PROGRESO = { pos: 0, dur: 0 };

interface Props {
  path: string | null;
}

function mmss(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Reproductor del audio de un capítulo: escuchar, pausar, reanudar
 * donde iba y detener, con barra de avance.
 *
 * Usa el mismo player de frases que el resto de la app. Si otro botón
 * lo toma (cambia la generación), vuelve a reposo sin llamar a stop():
 * el audio ya es de otro. Al desmontarse corta lo suyo, por eso el
 * padre lo remonta con `key` al cambiar de capítulo.
 */
export function ReproductorCapitulo({ path }: Props) {
  const [estado, setEstado] = useState<Estado>('idle');
  const [progreso, setProgreso] = useState(SIN_PROGRESO);
  const [fallo, setFallo] = useState(false);
  // El cleanup y los intervalos no ven el state nuevo: necesitan refs.
  const estadoRef = useRef<Estado>('idle');
  const genRef = useRef(0);

  const cambiar = useCallback((e: Estado) => {
    estadoRef.current = e;
    setEstado(e);
  }, []);

  const aReposo = useCallback(() => {
    cambiar('idle');
    setProgreso(SIN_PROGRESO);
  }, [cambiar]);

  // Avance de la barra y fin natural: solo mientras suena.
  useEffect(() => {
    if (estado !== 'sonando') return;
    const id = setInterval(() => {
      if (audio.generacionActual() !== genRef.current) {
        aReposo();
        return;
      }
      const p = audio.progresoFrase();
      setProgreso(p);
      if (!audio.isPlaying() && p.dur > 0 && p.pos >= p.dur - FIN_MARGEN_S) aReposo();
    }, TICK_MS);
    return () => clearInterval(id);
  }, [estado, aReposo]);

  // Al irse a segundo plano se pausa (no se corta) para poder reanudar.
  useEffect(() => {
    if (estado !== 'sonando') return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') return;
      audio.pauseFrase();
      cambiar('pausado');
    });
    return () => sub.remove();
  }, [estado, cambiar]);

  useEffect(
    () => () => {
      if (estadoRef.current !== 'idle') audio.stop();
    },
    []
  );

  const escuchar = async () => {
    cambiar('cargando');
    const ok = await audio.play(path);
    if (!ok) {
      setFallo(true);
      aReposo();
      return;
    }
    genRef.current = audio.generacionActual();
    cambiar('sonando');
  };

  const pausar = () => {
    audio.pauseFrase();
    cambiar('pausado');
  };

  const reanudar = () => {
    if (audio.generacionActual() !== genRef.current || !audio.resumeFrase()) {
      aReposo();
      return;
    }
    cambiar('sonando');
  };

  const detener = () => {
    audio.stop();
    aReposo();
  };

  const activo = estado === 'sonando' || estado === 'pausado';
  const apagado = fallo || !hayAudio(path);

  return (
    <View style={styles.raiz}>
      <View style={styles.fila}>
        {activo ? (
          <>
            <Button
              label={estado === 'sonando' ? '❚❚ Pausar' : '▶ Reanudar'}
              onPress={estado === 'sonando' ? pausar : reanudar}
              variant="secondary"
            />
            <Button label="■ Detener" onPress={detener} variant="ghost" />
          </>
        ) : (
          <Button
            label={estado === 'cargando' ? 'Cargando…' : '▶ Escuchar el capítulo'}
            onPress={() => void escuchar()}
            variant="secondary"
            disabled={apagado || estado === 'cargando'}
          />
        )}
      </View>
      <ProgressBar value={progreso.pos} total={progreso.dur} height={4} />
      <Text style={styles.tiempo}>{`${mmss(progreso.pos)} / ${mmss(progreso.dur)}`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { gap: space.sm },
  fila: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tiempo: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
});
