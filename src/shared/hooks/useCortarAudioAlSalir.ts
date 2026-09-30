import { useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import * as audio from '@/services/audio';

/**
 * Corta TODO el audio (frase, SFX, secuencias, capítulo de Lecturas) al
 * perder el foco de la pantalla: cambiar de pestaña, abrir algo encima o
 * volver atrás. Úsala en cualquier pantalla que reproduzca sonido.
 *
 * El corte global de App.tsx (onStateChange) ya cubre la navegación en sí;
 * esta además sirve para que una pantalla con su propio bucle en curso
 * (Modo oído, "Escuchar todos" de Gramática) apague su propia bandera de
 * "sigo vigente" en el mismo instante, sin esperar a que el bucle note el
 * cambio de ruta por su cuenta.
 *
 * `alPerderFoco`, si viene, corre ANTES de detenerTodo(): ahí una pantalla
 * con su propio ref de "vigente" (playingRef, reproduciendoRef...) lo apaga.
 */
export function useCortarAudioAlSalir(alPerderFoco?: () => void): void {
  useFocusEffect(
    useCallback(() => {
      return () => {
        alPerderFoco?.();
        audio.detenerTodo();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );
}
