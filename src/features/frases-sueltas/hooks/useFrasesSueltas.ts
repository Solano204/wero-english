import { useEffect, useRef, useState, useEffectEvent, useLayoutEffect } from 'react';
import { AppState } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { Modo, Sonando } from '@/features/frases-sueltas/components/CartaFrase';
import { type ManejadorMazo } from '@/features/frases-sueltas/components/MazoCartas';
import { getRandomEntries } from '@/data/repos/frases';
import { isFavorite, toggleFavorite } from '@/data/repos/tarjetas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

/** Sube la «vigencia» (invalida lo que va en camino). Función aparte: la limpieza de un efecto no toca
 *  `.current` de frente, que la regla de hooks confunde con una ref a un nodo. */
function invalidar(vigencia: { current: number }): void {
  vigencia.current++;
}

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Entre el fin del audio EN y el arranque del ES, en la secuencia automática. */
const PAUSA_EN_ES_MS = 700;

/** Retraso antes de que arranque el audio solo, al mostrarse la tarjeta. */
const RETRASO_AUTO_MS = 250;

/** Velocidad de "Lento", igual que playSlow() por defecto. */
const VELOCIDAD_LENTA = 0.7;

/** Pasos de la secuencia EN → ES de una frase. Sin ES, solo suena el inglés. */
function pasosSecuencia(entry: Entry): { path: string | null; pauseMs: number }[] {
  return entry.audio_es
    ? [
        { path: entry.audio_en, pauseMs: PAUSA_EN_ES_MS },
        { path: entry.audio_es, pauseMs: 0 },
      ]
    : [{ path: entry.audio_en, pauseMs: 0 }];
}

/**
 * Frases sueltas: la baraja al azar, guardar y deslizar.
 */
export function useFrasesSueltas() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  // Esta pantalla es puro oído: la música de fondo compite con la frase.
  useMusicaPantalla('silencio');

  const [pool, setPool] = useState<Entry[]>([]);
  const [i, setI] = useState(0);
  const [barajando, setBarajando] = useState(false);
  const [guardada, setGuardada] = useState(false);
  /** Sube en 1 cada vez que la frase de arriba pasa a guardada: dispara el anillo dorado del botón. */
  const [pulso, setPulso] = useState(0);
  const [sonando, setSonando] = useState<Sonando | null>(null);
  /** Cambia con cada baraja nueva: el mazo se arma de cero (sus valores compartidos nunca retroceden dentro de una tanda). */
  const [tanda, setTanda] = useState(0);
  const mazo = useRef<ManejadorMazo>(null);

  // Token de la reproducción de frase vigente (automática o manual). Cada
  // intento nuevo saca el suyo; el que ya no coincide con el vigente sabe
  // que otro le ganó el turno y se calla sin tocar el audio ni el state.
  const vozToken = useRef(0);

  const carga = useCarga(
    async () => {
      // Recargar la baraja corta cualquier voz de la tanda anterior.
      vozToken.current++;
      audio.stop();
      setSonando(null);
      // Se piden de golpe y se recorren en orden: pedir una por una haría
      // una consulta por toque y se sentiría el salto.
      const list = await getRandomEntries(filter(), 60);
      setPool(list);
      setI(0);
      setTanda((t) => t + 1);
      setBarajando(false);
    },
    [filter]
  );
  const loading = carga.estado === 'cargando';
  const cargar = carga.reintentar;

  const entry = pool[i];
  // Lo que el mazo avisa al terminar una salida puede llegar antes de que React pinte: la cuenta va también en una referencia.
  const iRef = useRef(0);
  useLayoutEffect(() => {
    iRef.current = i;
  }, [i]);
  const largoRef = useRef(0);
  useLayoutEffect(() => {
    largoRef.current = pool.length;
  }, [pool]);
  const arribaRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    arribaRef.current = entry?.id ?? null;
  }, [entry]);

  // Corta la voz al salir de la pantalla o al ir a background, e
  // igual al desmontar (recarga en caliente, navegación hacia atrás).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        vozToken.current++;
        audio.stop();
        setSonando(null);
      }
    });
    return () => {
      sub.remove();
      invalidar(vozToken);
      audio.stop();
    };
  }, []);

  // Perder el foco también corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir(() => {
    vozToken.current++;
    setSonando(null);
  });

  // El estado real de la frase de arriba: sin esto, «Guardar» quitaría de Mi mazo una que ya estaba guardada.
  const entryId = entry?.id;
  useEffect(() => {
    if (!user || entryId === undefined) return;
    let vigente = true;
    setGuardada(false);
    void isFavorite(user.id, entryId).then((v) => {
      if (vigente) setGuardada(v);
    });
    return () => {
      vigente = false;
    };
  }, [user, entryId]);

  /** Reproduce EN, pausa, ES (si hay), resaltando el texto que suena. */
  const reproduceSecuencia = async (e: Entry) => {
    const miToken = ++vozToken.current;
    await audio.playSequence(
      pasosSecuencia(e),
      () => vozToken.current === miToken,
      (idx) => setSonando({ modo: 'ambos', lengua: idx === 0 ? 'en' : 'es' })
    );
    if (vozToken.current === miToken) setSonando(null);
  };

  // Audio automático al mostrarse cada frase: arranca ~250ms después,
  // cancelable por entry.id para que pasar rápido no dispare audios
  // viejos, y solo si "Voz automática" está prendida en Ajustes.
  const efectoEntryid = useEffectEvent(() => {
    if (!entry || !autoAudio) return;
    const t = setTimeout(() => {
      void reproduceSecuencia(entry);
    }, RETRASO_AUTO_MS);
    return () => {
      clearTimeout(t);
      invalidar(vozToken);
      audio.stop();
      setSonando(null);
    };
  });
  useEffect(() => efectoEntryid(), [entry?.id, autoAudio]);

  /** Toque manual de un solo idioma: cancela lo que suene y reproduce solo eso. */
  const reproduceUna = async (lang: 'en' | 'es', lento: boolean) => {
    const path = lang === 'en' ? entry?.audio_en ?? null : entry?.audio_es ?? null;
    const miToken = ++vozToken.current;
    setSonando({ modo: lang === 'es' ? 'es' : lento ? 'lento' : 'en', lengua: lang });
    await audio.playAndWait(path, lento ? { rate: VELOCIDAD_LENTA } : undefined);
    if (vozToken.current === miToken) setSonando(null);
  };

  const sonar = (modo: Modo) => {
    if (!entry) return;
    haptics.tapLight();
    if (modo === 'ambos') void reproduceSecuencia(entry);
    else void reproduceUna(modo === 'es' ? 'es' : 'en', modo === 'lento');
  };

  /** La carta de arriba empieza a irse: se corta la voz ANTES de cambiar de frase (un salto rápido dejaría sonando la que ya no se ve). */
  const alLanzar = () => {
    haptics.tapLight();
    vozToken.current++;
    audio.stop();
    setSonando(null);
  };

  /** La carta ya salió. Al acabarse la baraja el mazo queda vacío y se pide otra: nunca se repite dentro de la misma tanda. */
  const alAvanzar = () => {
    const siguiente = iRef.current + 1;
    iRef.current = siguiente;
    if (siguiente >= largoRef.current) {
      setBarajando(true);
      setPool([]);
      void cargar();
      return;
    }
    setI(siguiente);
  };

  const pedirSiguiente = () => mazo.current?.siguiente();

  const alternarGuardada = async () => {
    if (!user || !entry) return;
    const ahora = await toggleFavorite(user.id, entry.id);
    // La frase de arriba pudo cambiar mientras se guardaba: el botón habla de la de ahora.
    if (arribaRef.current !== entry.id) return;
    setGuardada(ahora);
    if (ahora) {
      haptics.success();
      setPulso((p) => p + 1);
    }
  };

  /** Deslizar hacia arriba solo guarda: quitar una frase de Mi mazo se hace con el botón. */
  const guardarDeslizando = () => {
    if (guardada) haptics.tapLight();
    else void alternarGuardada();
  };

  return { nav, pool, i, barajando, guardada, pulso, sonando, tanda, mazo, carga, loading, entry, sonar, alLanzar, alAvanzar, pedirSiguiente, alternarGuardada, guardarDeslizando };
}
