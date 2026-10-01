import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import type { Paso } from '@/domain/match3Pasos';
import { ANIMACION_DULCES, DEPURACION_DULCES } from '@/config/dulces';
import { registrarFalla } from '@/services/fallas';
import { motionDuration, motionDulces } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { CapaDepuracion } from './CapaDepuracion';
import { ChipCascada } from './ChipCascada';
import { Pieza } from './Pieza';
import {
  invariantesVista,
  piezasMarcarExplota,
  piezasTrasIntercambio,
  piezasTrasPaso,
  piezasTrasRebaraje,
  vistaDesdeModelo,
  vistaInicial,
  volcarModelo,
  volcarVista,
  type Jugada,
  type PiezaVista,
  type TableroDulcesRef,
} from '@/features/juegos/dulces/logic/vistaTablero';

export type { Jugada, TableroDulcesRef } from '@/features/juegos/dulces/logic/vistaTablero';
import {
  REBOTE_MS,
  TROZOS_RETRASO_MS,
  celdaEn,
  duracionCaida,
  esperaDeCaida,
  retrasoDeColumna,
  umbralDeslizar,
  vecinaHacia,
} from '@/features/juegos/dulces/logic/tablero';

/** Sube la «vigencia» (invalida lo que va en camino). Función aparte: la limpieza de un efecto no toca
 *  `.current` de frente, que la regla de hooks confunde con una ref a un nodo. */
function invalidar(vigencia: { current: number }): void {
  vigencia.current++;
}

/** El rastro de depuración va por console.error: es el único console que sobrevive a un APK de release (adb logcat). */
const trazar = (texto: string) => console.error(texto);

/** Los registros y la capa de depuración: siempre en `__DEV__` y, en un APK de prueba, con `DEPURACION_DULCES`. */
const DEPURANDO = __DEV__ || DEPURACION_DULCES;

/** Cuánto se espera, además de lo calculado, antes de dar una jugada por terminada a la fuerza. */
const VIGILANTE_BASE_MS = 2500;
const VIGILANTE_POR_PASO_MS = 1800;

interface Props {
  ref?: Ref<TableroDulcesRef>;
  /** El modelo: colores e ids por celda. Se lee al montar y cada vez que cambia `llave`. */
  celdas: number[];
  ids: number[];
  cols: number;
  rows: number;
  lado: number;
  hueco: number;
  /** Cambia cuando la pantalla arma otro tablero (otra partida): se reparten piezas nuevas. */
  llave: number;
  elegida: number | null;
  /** Sin toques ni deslizamientos: hay una animación, una pregunta o ya no quedan jugadas. */
  bloqueado: boolean;
  /** El tablero scrollea con la pantalla: solo los deslizamientos horizontales intercambian. */
  soloHorizontal: boolean;
  onTocar: (celda: number) => void;
  onDeslizar: (origen: number, destino: number) => void;
}

/**
 * El tablero de Dulces: SOLO DIBUJA el modelo. Cada pieza tiene el id que le dio el dominio y su lugar sale de
 * los ids del modelo (`piezasTrasPaso`…); las animaciones solo van de la posición anterior a la nueva y no
 * deciden nada: el modelo ya tiene el resultado final antes de que empiece la jugada. Al terminar cada paso, y
 * al final con un vigilante por si una animación se pierde, la vista se reconcilia con el modelo: una pieza por
 * celda, del color y con el id que dice el modelo, cero huecos. `ANIMACION_DULCES` en `false` dibuja cada paso
 * de inmediato. El deslizamiento del dedo (Gesture Handler) intercambia con la vecina hacia donde va; tocar y
 * tocar lo resuelve la pantalla como siempre.
 */
export function TableroDulces({
  ref,
  celdas,
  ids,
  cols,
  rows,
  lado,
  hueco,
  llave,
  elegida,
  bloqueado,
  soloHorizontal,
  onTocar,
  onDeslizar,
}: Props) {
  'use no memo';
  // Fuera del React Compiler a propósito: los callbacks del gesto leen refs con los avisos más recientes (así el
  // gesto no se rearma a media partida, lo que cortaría un arrastre en curso) y el compilador no sabe que esos
  // callbacks corren después del render. Se queda con su memorización a mano (useMemo del gesto, useCallback).
  const reducido = useMovimientoReducido();
  const paso = lado + hueco;
  const ancho = cols * paso - hueco;
  const alto = rows * paso - hueco;

  const [piezas, setPiezas] = useState<PiezaVista[]>(() => vistaInicial(celdas, ids, cols, rows, true));
  // Lo que ve el jugador, al día en el mismo instante en que se decide (el estado de React llega un render después).
  const vistaRef = useRef(piezas);
  const nonce = useRef(0);
  const rechazoRef = useRef(0);
  const jugadaToken = useRef(0);
  const montado = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [chip, setChip] = useState<{ id: number; texto: string } | null>(null);
  // Sube cada vez que el tablero queda quieto: todas las piezas se plantan en su celda (`Pieza`, `asiento`).
  const [asiento, setAsiento] = useState(0);
  const [jugando, setJugando] = useState(false);
  const chipId = useRef(0);

  // Lo último que trae la pantalla, para que ni el gesto ni la jugada en curso usen valores viejos.
  const datos = useRef({ cols, rows, reducido, onTocar, onDeslizar });
  datos.current = { cols, rows, reducido, onTocar, onDeslizar };

  useEffect(() => {
    montado.current = true;
    const pendientes = timers.current;
    return () => {
      montado.current = false;
      invalidar(jugadaToken);
      pendientes.forEach((t) => clearTimeout(t));
      pendientes.clear();
    };
  }, []);

  const poner = useCallback((siguiente: PiezaVista[]) => {
    vistaRef.current = siguiente;
    setPiezas(siguiente);
  }, []);
  const cambiar = useCallback((f: (ps: PiezaVista[]) => PiezaVista[]) => poner(f(vistaRef.current)), [poner]);

  /** La vista contra el modelo: si algo no coincide (hueco, pieza de más, color o id distinto) se rehace desde el modelo. */
  const reconciliar = useCallback(
    (modelo: readonly number[], idsModelo: readonly number[], cuando: string) => {
      const { cols: columnas, rows: filas } = datos.current;
      const fallas = invariantesVista(vistaRef.current, modelo, idsModelo, columnas, filas);
      if (DEPURANDO) {
        const linea = `[dulces] ${cuando}: modelo=${volcarModelo(modelo, columnas)} vista=${volcarVista(vistaRef.current, columnas, filas)}`;
        if (fallas.length === 0) trazar(linea);
        else {
          trazar(`${linea} FALLAS: ${fallas.join(' | ')}`);
          void registrarFalla(new Error(`${linea} ${fallas.join(' | ')}`), 'dulces:invariante');
        }
      }
      if (fallas.length > 0) poner(vistaDesdeModelo(modelo, idsModelo, columnas));
    },
    [poner]
  );

  // Otra partida: piezas nuevas (el modelo reparte ids nuevos, así ninguna hereda la posición de la de antes).
  const llaveAnterior = useRef(llave);
  useEffect(() => {
    if (llaveAnterior.current === llave) return;
    llaveAnterior.current = llave;
    jugadaToken.current++;
    poner(vistaInicial(celdas, ids, cols, rows, true));
    setChip(null);
    setJugando(false);
  }, [llave, celdas, ids, cols, rows, poner]);

  // Mientras cae el reparto no se aceptan toques: el tablero está en el aire.
  const [entrando, setEntrando] = useState(true);
  useEffect(() => {
    setEntrando(true);
    const espera = reducido || !ANIMACION_DULCES ? motionDuration.rapido : retrasoDeColumna(cols - 1) + duracionCaida(rows) + REBOTE_MS;
    const t = setTimeout(() => {
      setEntrando(false);
      setAsiento((n) => n + 1);
    }, espera);
    return () => clearTimeout(t);
  }, [llave, cols, rows, reducido]);

  const dormir = useCallback(
    (ms: number) =>
      new Promise<void>((resolver) => {
        const t = setTimeout(() => {
          timers.current.delete(t);
          resolver();
        }, Math.max(0, ms));
        timers.current.add(t);
      }),
    []
  );

  const jugar = useCallback(
    (j: Jugada) => {
      const token = ++jugadaToken.current;
      const vive = () => montado.current && jugadaToken.current === token;
      const { cols: columnas, reducido: sinMovimiento } = datos.current;
      const animada = ANIMACION_DULCES;
      const ms = (t: number) => (sinMovimiento ? motionDuration.rapido : t);
      const llegaron = new Set<number>();
      let ultimaLlegada = 0;
      let terminada = false;
      let vigilante: ReturnType<typeof setTimeout> | undefined;

      const mostrarChip = (texto: string) => {
        const id = ++chipId.current;
        setChip({ id, texto });
      };
      const llegan = (p: Paso, k: number) => {
        if (llegaron.has(k)) return;
        llegaron.add(k);
        j.onLlegan?.(p, k);
      };

      /** Una sola vez: lo que no llegó llega, la vista se reconcilia con el modelo y se avisa que terminó. */
      const terminar = (cuando: string) => {
        if (terminada) return;
        terminada = true;
        if (vigilante) {
          clearTimeout(vigilante);
          timers.current.delete(vigilante);
        }
        j.pasos.forEach((p, k) => llegan(p, k));
        reconciliar(j.final, j.idsFinal, cuando);
        jugadaToken.current++;
        setJugando(false);
        setAsiento((n) => n + 1);
        j.onFin();
      };

      // Respaldo: si una animación se corta, la jugada termina igual y el tablero queda como el modelo.
      const tope = VIGILANTE_BASE_MS + j.pasos.length * VIGILANTE_POR_PASO_MS + (j.rebarajado ? VIGILANTE_BASE_MS : 0);
      vigilante = setTimeout(() => {
        if (vive()) terminar('vigilante');
      }, tope);
      timers.current.add(vigilante);

      void (async () => {
        setJugando(true);
        // 1. Las dos piezas se deslizan una a la otra.
        if (animada) {
          cambiar((ps) => piezasTrasIntercambio(ps, j.a, j.c, j.idsAntes, columnas, ++nonce.current, false));
          await dormir(ms(motionDuration.base));
          if (!vive()) return;
        }

        // 2. Cada paso: estallan, y mientras sus trozos vuelan a las barras, caen las de arriba.
        let idsPrevios = j.idsIntercambio;
        for (const [k, p] of j.pasos.entries()) {
          const idsPaso = j.idsPasos[k] as number[];
          if (k >= 1) mostrarChip(`Cascada ×${k + 1}`);
          j.onEstallido?.(p, k);
          if (animada) {
            const quitados = p.quitar.map((i) => idsPrevios[i] as number);
            cambiar((ps) => piezasMarcarExplota(ps, quitados));
            if (sinMovimiento) {
              llegan(p, k);
            } else {
              const llegada = motionDulces.pulso + TROZOS_RETRASO_MS + motionDulces.vuelo;
              ultimaLlegada = Math.max(ultimaLlegada, Date.now() + llegada);
              const t = setTimeout(() => {
                timers.current.delete(t);
                if (vive()) llegan(p, k);
              }, llegada);
              timers.current.add(t);
            }
            await dormir(ms(motionDulces.pulso + motionDulces.estallido));
            if (!vive()) return;
            cambiar((ps) => piezasTrasPaso(ps, p, idsPaso, columnas, ++nonce.current));
            await dormir(sinMovimiento ? motionDuration.rapido : esperaDeCaida(p, columnas));
            if (!vive()) return;
          } else {
            llegan(p, k);
            poner(vistaDesdeModelo(p.tablero, idsPaso, columnas));
            setAsiento((n) => n + 1);
            await dormir(motionDuration.rapido);
            if (!vive()) return;
          }
          idsPrevios = idsPaso;
          reconciliar(p.tablero, idsPaso, `paso ${k + 1}`);
          setAsiento((n) => n + 1);
        }

        // 3. Sin movimientos posibles: se avisa y las piezas giran a su nuevo lugar.
        if (j.rebarajado && j.idsRebaraje) {
          const { rebarajado, idsRebaraje } = j;
          mostrarChip('Rebarajando el tablero');
          if (animada) {
            await dormir(ms(motionDuration.base));
            if (!vive()) return;
            cambiar((ps) => piezasTrasRebaraje(ps, rebarajado, idsRebaraje, columnas, ++nonce.current));
            await dormir(ms(motionDuration.lento));
            if (!vive()) return;
          } else {
            poner(vistaDesdeModelo(rebarajado, idsRebaraje, columnas));
          }
          reconciliar(rebarajado, idsRebaraje, 'rebarajado');
        }

        // Los trozos del último paso tienen que llegar antes de dar por terminada la jugada.
        const falta = ultimaLlegada - Date.now();
        if (falta > 0) await dormir(falta);
        if (!vive()) return;
        terminar('fin de la jugada');
      })();
    },
    [cambiar, dormir, poner, reconciliar]
  );

  // Un intercambio que no arma línea: las dos piezas «van» hacia la otra, cabecean y regresan, sin moverse de su celda.
  const rechazar = useCallback(
    (a: number, c: number) => {
      const { cols: columnas } = datos.current;
      const n = ++rechazoRef.current;
      const hacia = (de: number, a2: number) => ({
        dx: Math.sign((a2 % columnas) - (de % columnas)),
        dy: Math.sign(Math.floor(a2 / columnas) - Math.floor(de / columnas)),
      });
      cambiar((ps) =>
        ps.map((p) => {
          const celda = p.fila * columnas + p.col;
          if (celda === a) return { ...p, rechazo: n, ida: hacia(a, c) };
          if (celda === c) return { ...p, rechazo: n, ida: hacia(c, a) };
          return p;
        })
      );
    },
    [cambiar]
  );

  useImperativeHandle(ref, () => ({ jugar, rechazar }), [jugar, rechazar]);

  const alTocar = useCallback((celda: number) => datos.current.onTocar(celda), []);
  const alDeslizar = useCallback((origen: number, destino: number) => datos.current.onDeslizar(origen, destino), []);
  // El deslizamiento no tenía a dónde ir (el borde del tablero): la pieza cabecea y se sacude.
  const alBorde = useCallback(
    (origen: number, dx: number, dy: number) => {
      const { cols: columnas } = datos.current;
      const n = ++rechazoRef.current;
      cambiar((ps) => ps.map((p) => (p.fila * columnas + p.col === origen ? { ...p, rechazo: n, ida: { dx, dy } } : p)));
    },
    [cambiar]
  );

  const origen = useSharedValue(-1);
  const hecho = useSharedValue(0);
  const gesto = useMemo(() => {
    const umbral = umbralDeslizar(lado);
    const base = Gesture.Pan().enabled(!bloqueado && !entrando).minDistance(6).activeOffsetX([-8, 8]);
    // Si el tablero scrollea, un movimiento vertical es del scroll: el gesto se rinde y no roba el dedo.
    const conEje = soloHorizontal ? base.failOffsetY([-10, 10]) : base.activeOffsetY([-8, 8]);
    return conEje
      .onBegin((e) => {
        origen.set(celdaEn(e.x, e.y, paso, cols, rows));
        hecho.set(0);
      })
      .onUpdate((e) => {
        if (hecho.get() === 1 || origen.get() < 0) return;
        if (Math.max(Math.abs(e.translationX), Math.abs(e.translationY)) < umbral) return;
        hecho.set(1);
        const destino = vecinaHacia(origen.get(), e.translationX, e.translationY, cols, rows, soloHorizontal);
        if (!destino) return;
        if (destino.celda >= 0) runOnJS(alDeslizar)(origen.get(), destino.celda);
        else runOnJS(alBorde)(origen.get(), destino.dx, destino.dy);
      })
      .onFinalize(() => {
        origen.set(-1);
      });
  }, [bloqueado, entrando, soloHorizontal, lado, paso, cols, rows, origen, hecho, alDeslizar, alBorde]);

  // En orden de lectura (de izquierda a derecha y de arriba abajo): así lo recorre el lector de pantalla.
  const enOrden = useMemo(() => [...piezas].sort((a, b) => a.fila - b.fila || a.col - b.col), [piezas]);

  return (
    <View style={styles.recorte}>
      <GestureDetector gesture={gesto}>
        <View style={[styles.tablero, { width: ancho, height: alto }]} pointerEvents={bloqueado || entrando ? 'none' : 'auto'}>
          {enOrden.map((p) => (
            <Pieza
              key={p.id}
              id={p.id}
              color={p.color}
              celda={p.fila * cols + p.col}
              fila={p.fila}
              col={p.col}
              paso={paso}
              lado={lado}
              elegida={elegida === p.fila * cols + p.col}
              explota={p.explota}
              mov={p.mov}
              entrada={p.entrada}
              rechazo={p.rechazo}
              ida={p.ida}
              asiento={asiento}
              onTocar={alTocar}
            />
          ))}
          {chip ? (
            <ChipCascada
              key={chip.id}
              texto={chip.texto}
              onFin={() => setChip((actual) => (actual?.id === chip.id ? null : actual))}
            />
          ) : null}
          {DEPURANDO ? (
            <CapaDepuracion celdas={celdas} ids={ids} piezas={piezas} cols={cols} rows={rows} paso={paso} lado={lado} enReposo={!jugando && !entrando} />
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

/** Lo que crece una pieza al pulsar o elevarse: el recorte le deja este margen a los lados y abajo. */
const MARGEN_RECORTE = 6;

const styles = StyleSheet.create({
  // Recorta por arriba: el reparto y las piezas nuevas de cada paso entran por el borde de arriba del tablero.
  // A los lados y abajo deja un margen, con el que el pulso y el realce de las piezas de la orilla no se cortan.
  recorte: {
    alignSelf: 'center',
    overflow: 'hidden',
    marginHorizontal: -MARGEN_RECORTE,
    marginBottom: -MARGEN_RECORTE,
    paddingHorizontal: MARGEN_RECORTE,
    paddingBottom: MARGEN_RECORTE,
  },
  tablero: {},
});
