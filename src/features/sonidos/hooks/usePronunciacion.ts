import { useCallback, useEffect, useRef, useState, useEffectEvent } from 'react';
import { BackHandler, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { Rect } from '@/shared/ui/fx/useDesfaseVentana';
import { type Viaje } from '@/features/sonidos/components/ViajeSimbolo';
import { sinBarras } from '@/domain/vocales';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import { loadContent } from '@/data/contenido';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Fonema } from '@/types';
import type { RootStackParams } from '@/types/rutas';

/** Pausa entre vueltas del modo "Repetir". */
const PAUSA_REPETIR_MS = 700;

/** Lo más que puede durar el viaje del símbolo (esperar a que la página se mida y volar) antes de darlo por terminado. */
const VIAJE_TOPE_MS = motionDuration.coreografia + motionDuration.escena;

/**
 * Reproduce `path` en bucle hasta que `activo()` deje de dar true.
 *
 * También se apaga solo si alguien más toca cualquier otro audio
 * mientras tanto (otro botón, un ejemplo, otro fonema): compara la
 * generación de audio.ts antes y después de cada espera, y si cambió
 * más de lo que causó su propio play(), ya no es el dueño del player.
 */
async function repiteEnBucle(path: string, activo: () => boolean): Promise<void> {
  while (activo()) {
    const antes = audio.generacionActual();
    const sonó = await audio.play(path);
    if (!sonó || audio.generacionActual() !== antes + 1) return;

    await audio.waitUntilDone();
    if (audio.generacionActual() !== antes + 1) return;

    if (!activo()) return;
    await new Promise((r) => setTimeout(r, PAUSA_REPETIR_MS));
    if (audio.generacionActual() !== antes + 1) return;
  }
}

type Nav = NativeStackNavigationProp<RootStackParams>;

type Ruta = RouteProp<RootStackParams, 'Pronunciation'>;

/**
 * El laboratorio de sonidos: fonemas, el que está abierto y su audio.
 */
export function usePronunciacion() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const content = loadContent();
  const fonemas = content.fonemas.fonemas;
  const total = content.fonemas.total_fonemas;
  const reducido = useMovimientoReducido();
  const { width: ancho } = useWindowDimensions();

  // Solo cuenta con lo que llegó al abrir.
  const [inicial] = useState(() => {
    const i = params?.fonemaId ? fonemas.findIndex((f) => f.id === params.fonemaId) : -1;
    return i >= 0 ? i : null;
  });

  // La página abierta (null = el índice) y la última que se vio: la página sigue montada mientras se desvanece.
  const [pagina, setPagina] = useState<number | null>(inicial);
  const [montada, setMontada] = useState(inicial !== null);
  const ultima = useRef(inicial ?? 0);
  const [viaje, setViaje] = useState<Viaje | null>(null);
  const enPagina = pagina !== null;
  const transicion = useSharedValue(enPagina ? 1 : 0);

  // Este ejercicio es puro oído: la música compite con el sonido que hay
  // que distinguir.
  useMusicaPantalla('silencio');

  // Qué fonema está en modo "Repetir" ahorita, o null si ninguno.
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  // Fuente de verdad para repiteEnBucle: un state en un closure viejo no
  // sirve para cortar un bucle que ya está corriendo.
  const repiteRef = useRef(false);

  const cancelarRepetir = () => {
    repiteRef.current = false;
    setRepitiendo(null);
  };

  // Perder el foco apaga cualquier repetición en curso y corta todo el audio.
  useCortarAudioAlSalir(cancelarRepetir);

  const alternarRepetir = (fonema: Fonema) => {
    if (repiteRef.current) {
      cancelarRepetir();
      audio.stop();
      return;
    }
    repiteRef.current = true;
    setRepitiendo(fonema.id);
    void repiteEnBucle(fonema.audio, () => repiteRef.current).finally(() => {
      if (repiteRef.current) cancelarRepetir();
    });
  };

  // Cambiar de fonema (abrir otro, deslizar, volver al índice) corta cualquier repetición en curso: nunca debe
  // sonar la de uno mientras se lee otro.
  const efectoPagina = useEffectEvent(() => {
    cancelarRepetir();
    audio.stop();
  });
  useEffect(() => efectoPagina(), [pagina]);

  const alMontar = useEffectEvent(() => {
    return () => {
      cancelarRepetir();
      audio.stop();
    };
  });
  useEffect(() => alMontar(), []);

  // Índice y páginas se funden entre sí; al volver al índice la página sale del árbol cuando ya se apagó.
  useEffect(() => {
    const destino = enPagina ? 1 : 0;
    if (reducido) {
      transicion.set(destino);
      if (!enPagina) setMontada(false);
      return;
    }
    transicion.set(withTiming(
      destino,
      { duration: motionDuration.escena, easing: enPagina ? motionEasing.entrar : motionEasing.salir },
      (fin) => {
        if (fin && destino === 0) runOnJS(setMontada)(false);
      }
    ));
  }, [enPagina, reducido, transicion]);

  const abrir = (indice: number, rect: Rect) => {
    const f = fonemas[indice];
    if (!f) return;
    ultima.current = indice;
    setMontada(true);
    setPagina(indice);
    // El símbolo del chip viaja hasta el de la página; con «reducir movimiento» no hay viaje.
    if (!reducido) setViaje({ ipa: sinBarras(f.ipa), desde: rect, hasta: null });
  };

  const cambiarPagina = (indice: number) => {
    ultima.current = indice;
    setPagina(indice);
  };

  const volverAlIndice = useCallback(() => {
    setViaje(null);
    setPagina(null);
  }, []);

  const simboloMedido = (rect: Rect) => {
    setViaje((v) => (v && !v.hasta ? { ...v, hasta: rect } : v));
  };
  const finViaje = () => setViaje(null);

  // Red de seguridad: si la página nunca dice dónde está su símbolo, el viaje se da por terminado y el símbolo
  // de la página se ve (no puede quedarse oculto).
  useEffect(() => {
    if (!viaje) return undefined;
    const t = setTimeout(() => setViaje(null), VIAJE_TOPE_MS);
    return () => clearTimeout(t);
  }, [viaje]);

  // «Practicar estos pares»: «Di la palabra» con los pares de este fonema.
  const practicarPares = (fonema: Fonema) => nav.navigate('MinimalPairs', { fonemaId: fonema.id });

  // Con una página abierta, «atrás» del sistema vuelve al índice y no sale de la pantalla.
  useEffect(() => {
    if (!enPagina) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      volverAlIndice();
      return true;
    });
    return () => sub.remove();
  }, [enPagina, volverAlIndice]);

  const estiloIndice = useAnimatedStyle(() => ({ opacity: 1 - transicion.get() }));
  const estiloPagina = useAnimatedStyle(() => ({ opacity: transicion.get() }));

  return { nav, fonemas, total, ancho, pagina, montada, ultima, viaje, enPagina, repitiendo, alternarRepetir, abrir, cambiarPagina, volverAlIndice, simboloMedido, finViaje, practicarPares, estiloIndice, estiloPagina };
}
