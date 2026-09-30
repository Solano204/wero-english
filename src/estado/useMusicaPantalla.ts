import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useSettingsStore } from './useSettingsStore';
import * as music from '@/services/musica';
import type { Pista } from '@/services/musica';

/**
 * Declara qué música quiere esta pantalla mientras tenga el foco.
 *
 * No hace falta llamarla en cada pantalla: la que no la usa se queda
 * con lo que ya sonaba (por defecto, 'app', puesta por iniciar() en la
 * raíz). Solo declaran algo distinto los juegos ('juegos'), estudio
 * ('app' con volumenFactor más bajo) y los ejercicios de puro oído o
 * con mucha voz encima, como gramática ('silencio').
 *
 * 'juegos' cae a 'app' si el usuario apagó "Música en juegos distinta".
 */
export function useMusicaPantalla(
  pista: Pista | 'silencio',
  opts?: { volumenFactor?: number }
): void {
  const musicaJuegosDistinta = useSettingsStore((s) => s.musicaJuegosDistinta);
  const volumenFactor = opts?.volumenFactor;

  useFocusEffect(
    useCallback(() => {
      if (pista === 'silencio') {
        void music.pausar();
        return () => void music.reanudar();
      }

      const resuelta: Pista =
        pista === 'juegos' && !musicaJuegosDistinta ? 'app' : pista;
      void music.setPista(resuelta);

      if (volumenFactor !== undefined) {
        music.setFactorFoco(volumenFactor);
        return () => music.setFactorFoco(1);
      }
      return undefined;
    }, [pista, musicaJuegosDistinta, volumenFactor])
  );
}
