import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ParIndices } from '@/features/juegos/pares/components/CableSenal';
import { centroSegmento } from '@/features/juegos/pares/components/SegmentosPares';
import type { Rect } from '@/features/juegos/pares/logic/geometria';
import { fasePares } from '@/features/juegos/pares/logic/partida';
import { useTableroPares } from './useTableroPares';
import { buildTablero, sonPareja } from '@/domain/pares';
import { useNivel } from '@/features/juegos/comun/useNivel';
import { applyGameGrade } from '@/data/repos/juegos';
import { getRandomEntries } from '@/data/repos/frases';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { useReaccion } from '@/shared/hooks/useReaccion';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { escalon, motionDuration, space } from '@/theme';
import type { Entry, NivelPares, ParFicha, ParesTablero } from '@/types';
import type { RootStackParams } from '@/types/rutas';
import { conFinal, conFinalAsync } from '@/shared/utils/conFinal';
import { sinEsperar } from '@/services/fallas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Pares'>;

/** Un par que se acaba de juntar y cuya voz aún suena: la tarjeta de fusión lo lleva hasta su segmento. */
interface Fusion {
  a: number;
  b: number;
  /** El segmento del progreso que se enciende cuando la tarjeta llega. */
  segmento: number;
  entry: Entry;
}

/**
 * Tope duro: si el audio no carga o se atora, esto suelta la pausa igual.
 * Tiene que alcanzar para efecto + inglés + español.
 */
const PAUSA_MAXIMA_MS = 10000;
/** Tope de la unión de un par (el cable tarda unos 370 ms): pasado esto se suelta el tablero igual. */
const UNION_MAXIMA_MS = 1500;
/** Tope del vuelo de la tarjeta de un par después de su voz: entrada de 450 ms más 320 ms de vuelo, con margen. */
const FUSION_MAXIMA_MS = 2000;
/** Lo que tarda el cierre del tablero (la ola de segmentos y los sellos que se van) antes de pasar al resumen. */
const CIERRE_MS = escalon(8) + motionDuration.rapido + motionDuration.base;
/** Bloqueo de "Saltar" contra doble toque. */
const SALTAR_DEBOUNCE_MS = 400;

/**
 * Toda la partida de Pares: tablero, jugadas, fallos, la unión del par, la voz y el cierre. La pantalla
 * solo la pinta. La fase con nombre (`logic/partida.ts`) dice cuándo el tablero acepta toques.
 *
 * Se califica como reconocimiento y nunca da grado 4: resolver un
 * tablero de ocho fichas por descarte no es recordar la frase en frío.
 */
export function usePartidaPares() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const { nivel, config, filtrar } = useNivel('pares', params?.nivel);
  const nv = config as NivelPares | null;
  const filter = useSettingsStore((s) => s.filter);
  // Se necesita oír bien las dos frases al acertar un par: la música,
  // aunque fuera baja, competiría justo en ese momento.
  useMusicaPantalla('silencio');
  useCortarAudioAlSalir();

  const [tablero, setTablero] = useState<ParesTablero | null>(null);
  // Cara y cubitos. El numero se relanza en cada respuesta;
  // no hace falta apagarlo con un temporizador.
  const reaccion = useReaccion();
  const [elegida, setElegida] = useState<ParFicha | null>(null);
  const [resueltas, setResueltas] = useState<number[]>([]);
  const [fallando, setFallando] = useState<string[]>([]);
  const [jugadas, setJugadas] = useState(0);
  // Pausa al acertar un par: congela reloj y tablero mientras se oyen
  // las dos frases. La tarjeta de fusión es lo que se ve mientras dura.
  const [enPausa, setEnPausa] = useState(false);
  const [saltando, setSaltando] = useState(false);
  const reducido = useMovimientoReducido();
  const medidas = useTableroPares(tablero, reducido);
  const { repartido } = medidas;
  // Las dos fichas de un acierto siguen en el tablero mientras el cable las une, y el par sigue
  // «en vuelo» (sin encender su segmento) hasta que su tarjeta llega.
  const [union, setUnion] = useState<ParIndices | null>(null);
  const [fusion, setFusion] = useState<Fusion | null>(null);
  const alTerminarUnion = () => setUnion(null);
  const alAterrizar = () => setFusion(null);
  // Si el aviso del cable no llega (app en segundo plano a media unión), el tablero no se queda bloqueado.
  useEffect(() => {
    if (!union) return undefined;
    const t = setTimeout(() => setUnion(null), UNION_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [union]);
  const libres = (tablero?.fichas.map((f) => !resueltas.includes(f.entryId)) ?? []);
  const fallo = useMemo(() => {
    if (!tablero || fallando.length !== 2) return null;
    const a = tablero.fichas.findIndex((f) => f.id === fallando[0]);
    const b = tablero.fichas.findIndex((f) => f.id === fallando[1]);
    return a >= 0 && b >= 0 ? { a, b } : null;
  }, [tablero, fallando]);

  const empezoEn = useRef(Date.now());
  // Las fichas solo traen entryId, no el Entry completo: hace falta este
  // mapa para llegar a audio_en/audio_es al emparejar.
  const entradas = useRef(new Map<number, Entry>());
  // Se incrementa cada vez que arranca o se corta una pausa: una
  // secuencia vieja que sigue esperando un await la revisa y aborta.
  const pausaToken = useRef(0);
  const limiteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saltarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // El candado de "Saltar" de verdad: el estado `saltando` solo deshabilita
  // el botón, y dos toques en el mismo cuadro todavía lo ven en false.
  const candadoSaltar = useRef(false);
  const falloTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Evita setState después de desmontar mientras una pausa sigue en
  // camino (los await de audio no se cancelan solos).
  const montado = useRef(true);

  /** Corta la voz en camino y quita la pausa. Saltar, salir o background. */
  const abortarPausa = useCallback(() => {
    pausaToken.current++;
    audio.stop();
    if (limiteTimer.current) clearTimeout(limiteTimer.current);
    if (montado.current) setEnPausa(false);
  }, []);

  useEffect(() => {
    montado.current = true;
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') abortarPausa();
    });
    return () => {
      montado.current = false;
      sub.remove();
      abortarPausa();
      if (saltarTimer.current) clearTimeout(saltarTimer.current);
      if (falloTimer.current) clearTimeout(falloTimer.current);
    };
  }, [abortarPausa]);

  const carga = useCarga(
    async () => {
      if (!user || !nv) return;
      const pool = await getRandomEntries(filter(), 120, {
        maxWords: 4,
        maxLen: 30,
      });
      const dentro = filtrar(pool, nv.pares);
      entradas.current = new Map(dentro.map((e) => [e.id, e]));
      const t = buildTablero(dentro, nv.pares);
      // El colchón de jugadas lo pone el nivel, no el dominio.
      setTablero({ ...t, jugadas: nv.jugadas });
      empezoEn.current = Date.now();
    },
    [user, filter, nv, filtrar]
  );
  const loading = carga.estado === 'cargando';

  // El tablero se cierra cuando el último par ya se oyó y su tarjeta llegó al segmento: primero se
  // oye la frase, después la ola de segmentos y los sellos que se van, y al final el resumen.
  const cerrando = tablero !== null && resueltas.length > 0 && resueltas.length === tablero.totalPares && !enPausa && !union && !fusion;
  const fase = fasePares({
    cargando: loading,
    repartido,
    fallando: fallando.length,
    uniendo: union !== null,
    enPausa,
    enVuelo: fusion !== null,
    completo: cerrando,
  });

  /**
   * Al acertar: suena el efecto de acierto, luego la frase en inglés y
   * luego la española, con el tablero y el reloj congelados. Se puede
   * cortar en cualquier punto (saltarPausa, salir, background); un tope
   * de PAUSA_MAXIMA_MS evita quedarse pegado si el audio no carga.
   */
  const pausarConVoz = async (entry: Entry) => {
    const miToken = ++pausaToken.current;
    setEnPausa(true);

    // Se guarda también en local: el finally solo debe apagar SU tope,
    // no el de una pausa nueva que arrancó mientras esta se desenredaba.
    const limite = setTimeout(() => {
      if (pausaToken.current === miToken) abortarPausa();
    }, PAUSA_MAXIMA_MS);
    limiteTimer.current = limite;

    await conFinalAsync(async () => {
      await audio.playRoundResultBilingue(true, entry.audio_en, entry.audio_es);
    }, () => {
      clearTimeout(limite);
      // Si nadie más tomó el token (ni saltarPausa ni un abort externo
      // ya lo hicieron), esta es la que cierra la pausa.
      if (pausaToken.current === miToken && montado.current) setEnPausa(false);
    });
  };

  const saltarPausa = () => {
    if (candadoSaltar.current) return;
    candadoSaltar.current = true;
    setSaltando(true);
    conFinal(() => {
      abortarPausa();
    }, () => {
      // El candado se suelta siempre, aunque cortar la pausa fallara.
      if (saltarTimer.current) clearTimeout(saltarTimer.current);
      saltarTimer.current = setTimeout(() => {
        candadoSaltar.current = false;
        setSaltando(false);
      }, SALTAR_DEBOUNCE_MS);
    });
  };

  const tocar = (f: ParFicha) => {
    // Solo en `jugando` el tablero acepta toques: repartiendo, con un fallo parpadeando, con el cable
    // uniendo un par, con su voz sonando o con su tarjeta en vuelo, no.
    if (!tablero || fase !== 'jugando') return;
    if (resueltas.includes(f.entryId)) return;

    if (!elegida) {
      haptics.tapLight();
      void audio.playTap();
      setElegida(f);
      return;
    }

    if (elegida.id === f.id) {
      setElegida(null);
      return;
    }

    setJugadas((j) => j + 1);

    if (sonPareja(elegida, f)) {
      haptics.success();
      reaccion.celebra();
      setResueltas((prev) => [...prev, f.entryId]);
      const a = tablero.fichas.findIndex((x) => x.id === elegida.id);
      const b = tablero.fichas.findIndex((x) => x.id === f.id);
      setUnion({ a, b });
      setElegida(null);
      const entry = entradas.current.get(f.entryId);
      // Siempre se oyen las dos frases al acertar un par, sin mirar
      // "Audio automático": es la recompensa del acierto, no un
      // extra opcional. El efecto de acierto lo pone la propia pausa:
      // sonarlo aparte cancelaría la frase en inglés (playSfx hace
      // stop()). Solo si no hay voz que oír suena suelto.
      if (entry && (entry.audio_en || entry.audio_es)) {
        setFusion({ a, b, segmento: resueltas.length, entry });
        void pausarConVoz(entry);
      } else {
        void audio.playSuccess();
      }
      if (user) {
        sinEsperar(applyGameGrade(
          user.id,
          f.entryId,
          true,
          Date.now() - empezoEn.current,
          'reconocer'
        ), 'juego:pares');
      }
      return;
    }

    // Falló: las dos parpadean en ámbar y se sueltan. Ámbar y no
    // rojo, por la misma razón que en la tarjeta de estudio. Sin
    // pausa ni voz: solo el SFX suave, igual que siempre.
    haptics.failure();
    void audio.playFail();
    setFallando([elegida.id, f.id]);
    if (user) {
      sinEsperar(applyGameGrade(
        user.id,
        elegida.entryId,
        false,
        Date.now() - empezoEn.current,
        'reconocer'
      ), 'juego:pares');
    }
    if (falloTimer.current) clearTimeout(falloTimer.current);
    falloTimer.current = setTimeout(() => {
      setFallando([]);
      setElegida(null);
    }, 520);
  };

  // El cable arrastra: soltar sobre una ficha es el segundo toque, y una ficha que no tenía
  // par elegida al arrancar el arrastre es el primero.
  const tocarIndice = (i: number) => {
    const f = tablero?.fichas[i];
    if (f) tocar(f);
  };
  const cancelarArrastre = () => setElegida(null);

  const terminar = useCallback(() => {
    audio.stop();
    nav.replace('GameEnd', {
      juego: 'pares',
      rondas: tablero?.totalPares ?? 0,
      aciertos: resueltas.length,
      nivel: nivel ?? undefined,
    });
  }, [nav, tablero, resueltas.length, nivel]);

  // Si la tarjeta no avisa que llegó, el tablero no se queda bloqueado (el vuelo tarda unos 800 ms tras la voz).
  useEffect(() => {
    if (!fusion || enPausa) return undefined;
    const t = setTimeout(() => setFusion(null), FUSION_MAXIMA_MS);
    return () => clearTimeout(t);
  }, [fusion, enPausa]);

  useEffect(() => {
    if (!cerrando) return undefined;
    const t = setTimeout(terminar, CIERRE_MS);
    return () => clearTimeout(t);
  }, [cerrando, terminar]);

  // Dónde están las fichas de un par en la capa de la pantalla (el tablero está centrado en su zona y puede ir scrolleado).
  const { zona, geo, capa, segmentos } = medidas;
  const vuelo = (() => {
    if (!tablero || !fusion) return null;
    const desplazo = Math.max(0, (zona.alto - geo.altoContenido) / 2);
    const enCapa = (i: number): Rect | null => {
      const r = geo.rectas[i];
      return r ? { x: zona.x + r.x, y: zona.y + desplazo + r.y - medidas.scrollY.current, width: r.width, height: r.height } : null;
    };
    const meta = centroSegmento(fusion.segmento);
    return {
      fichaA: tablero.fichas[fusion.a],
      fichaB: tablero.fichas[fusion.b],
      rectaA: enCapa(fusion.a),
      rectaB: enCapa(fusion.b),
      destino: segmentos && meta ? { x: segmentos.x + meta.x, y: segmentos.y + meta.y } : { x: capa.ancho - space.xl, y: space.xl },
    };
  })();

  return {
    nav,
    carga,
    loading,
    fase,
    nivel,
    nv,
    tablero,
    elegida,
    resueltas,
    fallando,
    jugadas,
    enPausa,
    saltando,
    union,
    fusion,
    libres,
    fallo,
    cerrando,
    vuelo,
    reaccion,
    medidas,
    alTerminarUnion,
    alAterrizar,
    tocar,
    tocarIndice,
    cancelarArrastre,
    terminar,
    saltarPausa,
  };
}
