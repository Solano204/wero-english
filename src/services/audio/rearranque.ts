import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { INTERVALO_ESTADO_MS, estados, marcar, soltar, suena, vigilar } from './estadoReproductor';
import { ARRANQUE_TIMEOUT_MS, TOPE_ABSOLUTO_MS, TOPE_NATIVO_MS, conTope, frase } from './estado';

/** La red de seguridad del player de frases: si no arranca, se rehace (la usan reproducir() y resumeFrase()). */

/**
 * Un player que recibió play() y no arranca nunca (perdió el foco de audio, quedó en error tras ir a segundo plano, un
 * seek nativo que no volvió) se seguía reutilizando para el mismo audio: desde ahí nada sonaba hasta reiniciar la app.
 * Si a ARRANQUE_TIMEOUT_MS sigue sin sonar y nadie más tomó el player, se tira y se rehace desde la misma fuente, en la
 * misma posición, una sola vez. No cambia `reproduccionId`: para quien escucha es la misma reproducción.
 */
export function vigilarArranque(p: AudioPlayer, miId: number, rate: number, desde: number): void {
  setTimeout(() => {
    const e = estados.get(p);
    if (miId !== frase.reproduccionId || frase.player !== p || suena(p) || !e?.arrancando) return;
    frase.colaFrase = frase.colaFrase.then(() =>
      conTope(
        (async () => {
          // Otra vez dentro de la cola: mientras esperaba turno pudo arrancar o cambiar todo.
          if (miId !== frase.reproduccionId || frase.player !== p || suena(p) || !frase.fuente) return;
          if (__DEV__) console.warn('[audio] el player no arrancó: se rehace');
          try {
            p.pause();
          } catch {
            /* sin consecuencia */
          }
          soltar(p);
          try {
            p.remove();
          } catch {
            /* sin consecuencia */
          }
          const nuevo = createAudioPlayer(frase.fuente, { updateInterval: INTERVALO_ESTADO_MS });
          frase.player = nuevo;
          vigilar(nuevo);
          try {
            nuevo.setPlaybackRate(rate, 'high');
          } catch {
            /* suena a velocidad normal */
          }
          if (desde > 0) {
            try {
              await conTope(nuevo.seekTo(desde), TOPE_NATIVO_MS, undefined);
            } catch {
              /* desde el principio */
            }
          }
          if (miId !== frase.reproduccionId || frase.player !== nuevo) return;
          nuevo.play();
          marcar(nuevo, { arrancando: true });
        })().catch((err) => {
          if (__DEV__) console.warn('[audio] no se pudo rehacer el player', err);
        }),
        TOPE_ABSOLUTO_MS,
        undefined
      )
    );
  }, ARRANQUE_TIMEOUT_MS);
}
