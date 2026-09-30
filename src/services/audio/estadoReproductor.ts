import type { AudioPlayer } from 'expo-audio';

/* ---------- estado de cada player, por eventos ----------
   En Android, leer `playing`, `currentTime` o `duration` de un player de
   expo-audio NO es gratis: cada lectura hace runBlocking sobre el hilo
   principal (ver AudioModule.kt, `runOnMain`), así que el hilo de JS se
   queda parado hasta que el de UI le contesta. Al terminar una ronda de
   Colmena se juntaban cinco bucles leyendo esas propiedades cada 30-60 ms
   (la onda y el karaoke, la espera del efecto, dos esperas de la voz y la
   del ducking) mientras el hilo de UI iba lleno de animaciones: JS pasaba
   casi todo el tiempo esperando a UI, y un toque en «Siguiente» (que
   necesita a JS) cerraba el círculo. La app se congelaba entera.

   Ahora nadie lee esas propiedades en un bucle: cada player avisa su
   estado con `playbackStatusUpdate` (asíncrono, no bloquea a nadie) y aquí
   se guarda la última foto. La posición entre dos avisos se estima con el
   reloj y la velocidad. */
export interface EstadoReproductor {
  playing: boolean;
  /** Segundos, en la última foto. */
  currentTime: number;
  /** Segundos; 0 hasta que el player la conoce. */
  duration: number;
  rate: number;
  /** Se le dio play() y el player todavía no avisa que suena. */
  arrancando: boolean;
  /** Date.now() de la última foto. */
  en: number;
}

/** Cada cuánto avisa el player de frases mientras suena: lo que usan la onda y el karaoke para no desfasarse. */
export const INTERVALO_ESTADO_MS = 100;

export const estados = new Map<AudioPlayer, EstadoReproductor>();
const suscripciones = new Map<AudioPlayer, { remove: () => void }>();

export function vigilar(p: AudioPlayer): void {
  if (suscripciones.has(p)) return;
  estados.set(p, { playing: false, currentTime: 0, duration: 0, rate: 1, arrancando: false, en: Date.now() });
  try {
    const sub = p.addListener('playbackStatusUpdate', (s) => {
      const playing = Boolean(s.playing);
      estados.set(p, {
        playing,
        // Solo un aviso de "suena" termina el arranque: uno viejo de pausa
        // que llegue tarde no lo da por terminado.
        arrancando: (estados.get(p)?.arrancando ?? false) && !playing,
        currentTime: Number.isFinite(s.currentTime) ? s.currentTime : 0,
        duration: Number.isFinite(s.duration) && s.duration > 0 ? s.duration : 0,
        rate: s.playbackRate > 0 ? s.playbackRate : 1,
        en: Date.now(),
      });
    });
    suscripciones.set(p, sub);
  } catch {
    // Sin eventos el player suena igual; las esperas terminan por su tope.
  }
}

export function soltar(p: AudioPlayer): void {
  try {
    suscripciones.get(p)?.remove();
  } catch {
    /* sin consecuencia */
  }
  suscripciones.delete(p);
  estados.delete(p);
}

/** Dónde va el player según su última foto: si sonaba, lo que avanzó desde entonces. */
export function posicionDe(e: EstadoReproductor): number {
  if (!e.playing) return e.currentTime;
  const p = e.currentTime + ((Date.now() - e.en) / 1000) * e.rate;
  return e.duration > 0 ? Math.min(p, e.duration) : p;
}

/** Corrige la foto desde aquí mismo (pausa, rebobinado) sin esperar a que llegue el aviso del player. */
export function marcar(p: AudioPlayer, cambios: Partial<Omit<EstadoReproductor, 'en'>>): void {
  const e = estados.get(p);
  if (!e) return;
  estados.set(p, { ...e, currentTime: posicionDe(e), ...cambios, en: Date.now() });
}

export function suena(p: AudioPlayer | null | undefined): boolean {
  return p ? (estados.get(p)?.playing ?? false) : false;
}
