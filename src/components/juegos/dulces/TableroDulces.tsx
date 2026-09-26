import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { idsTrasPaso, idsTrasRebaraje, type Paso } from '@/domain/match3Pasos';
import { motionDuration, motionDulces } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { ChipCascada } from './ChipCascada';
import { Pieza, type Entrada, type Movimiento } from './Pieza';
import { TROZOS_RETRASO_MS, celdaEn, esperaDeCaida, retrasoDeColumna, umbralDeslizar, vecinaHacia } from './tablero';

/** Lo que una jugada le pide al tablero que anime. */
export interface Jugada {
  /** Las dos celdas que se intercambian. */
  a: number;
  c: number;
  /** Los pasos de la cascada; vacío si el intercambio no armó nada (las piezas se quedan intercambiadas). */
  pasos: Paso[];
  /** Los colores del tablero rebarajado, si al terminar no quedaba ningún movimiento posible. */
  rebarajado: number[] | null;
  /** Cómo debe quedar el tablero al final: si lo animado no coincide, se corrige. */
  final: number[];
  /** Las piezas de un paso empiezan a estallar: de ahí salen los trozos hacia las barras. */
  onEstallido?: (paso: Paso, indice: number) => void;
  /** Los trozos de un paso llegaron a sus barras: se suman a las metas. */
  onLlegan?: (paso: Paso, indice: number) => void;
  /** Terminó toda la jugada: se puede volver a tocar. */
  onFin: () => void;
}

export interface TableroDulcesRef {
  /** Anima una jugada: el intercambio, cada paso de la cascada y, si hizo falta, el rebarajado. */
  jugar: (jugada: Jugada) => void;
}

interface PiezaVista {
  id: number;
  color: number;
  fila: number;
  col: number;
  explota: boolean;
  mov: Movimiento | null;
  entrada?: Entrada;
  rechazo: number;
}

interface Props {
  ref?: Ref<TableroDulcesRef>;
  /** El tablero de partida: solo se lee al montar y cada vez que cambia `llave`. */
  celdas: number[];
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

function vistaInicial(celdas: readonly number[], cols: number, nuevoId: () => number): PiezaVista[] {
  return celdas.map((color, i) => ({
    id: nuevoId(),
    color,
    fila: Math.floor(i / cols),
    col: i % cols,
    explota: false,
    mov: null,
    rechazo: 0,
  }));
}

/**
 * El tablero de Dulces. Las piezas tienen un id estable y se mueven con valores compartidos (`Pieza`): aquí solo
 * se decide qué pasa en cada momento de una jugada, con la misma resolución que produce el dominio pero
 * paso a paso (`resolverPorPasos`): intercambio → las que forman línea pulsan y estallan → las de arriba caen y
 * entran las nuevas → si formaron otra línea, el paso siguiente. `setState` solo al empezar cada etapa, nunca por
 * cuadro. El deslizamiento del dedo (Gesture Handler) intercambia con la vecina hacia donde va; tocar y tocar lo
 * resuelve la pantalla como siempre.
 */
export function TableroDulces({
  ref,
  celdas,
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
  const reducido = useMovimientoReducido();
  const paso = lado + hueco;
  const ancho = cols * paso - hueco;
  const alto = rows * paso - hueco;

  const siguienteId = useRef(0);
  const nuevoId = useCallback(() => siguienteId.current++, []);
  const [piezas, setPiezas] = useState<PiezaVista[]>(() => vistaInicial(celdas, cols, () => siguienteId.current++));
  // Qué pieza hay en cada celda y de qué color, por índice: lo que ve el jugador en este momento de la animación.
  const idsRef = useRef<number[]>(piezas.map((p) => p.id));
  const celdasRef = useRef<number[]>([...celdas]);
  const nonce = useRef(0);
  const rechazoRef = useRef(0);
  const jugadaToken = useRef(0);
  const montado = useRef(true);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const [chip, setChip] = useState<{ id: number; texto: string } | null>(null);
  const chipId = useRef(0);

  // Lo último que trae la pantalla, para que ni el gesto ni la jugada en curso usen valores viejos.
  const datos = useRef({ cols, reducido, onTocar, onDeslizar });
  datos.current = { cols, reducido, onTocar, onDeslizar };

  useEffect(() => {
    montado.current = true;
    const pendientes = timers.current;
    return () => {
      montado.current = false;
      jugadaToken.current++;
      pendientes.forEach((t) => clearTimeout(t));
      pendientes.clear();
    };
  }, []);

  const reiniciar = useCallback(
    (nuevas: readonly number[], columnas: number) => {
      const vista = vistaInicial(nuevas, columnas, nuevoId);
      idsRef.current = vista.map((p) => p.id);
      celdasRef.current = [...nuevas];
      setPiezas(vista);
      setChip(null);
    },
    [nuevoId]
  );

  // Otra partida: piezas nuevas (ids nuevos, así ninguna hereda la posición de la de antes).
  const llaveAnterior = useRef(llave);
  useEffect(() => {
    if (llaveAnterior.current === llave) return;
    llaveAnterior.current = llave;
    jugadaToken.current++;
    reiniciar(celdas, cols);
  }, [llave, celdas, cols, reiniciar]);

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
      const ms = (t: number) => (sinMovimiento ? motionDuration.rapido : t);
      const filaDe = (i: number) => Math.floor(i / columnas);
      const colDe = (i: number) => i % columnas;
      let ultimaLlegada = 0;

      const mostrarChip = (texto: string) => {
        const id = ++chipId.current;
        setChip({ id, texto });
      };

      const intercambiar = (a: number, c: number, asienta: boolean) => {
        const ida = idsRef.current[a];
        const idc = idsRef.current[c];
        if (ida === undefined || idc === undefined) return;
        idsRef.current[a] = idc;
        idsRef.current[c] = ida;
        const cel = celdasRef.current;
        [cel[a], cel[c]] = [cel[c] as number, cel[a] as number];
        const n = ++nonce.current;
        const mov: Movimiento = { tipo: 'intercambio', filas: 0, asienta, nonce: n };
        setPiezas((ps) =>
          ps.map((p) => {
            if (p.id === ida) return { ...p, fila: filaDe(c), col: colDe(c), mov };
            if (p.id === idc) return { ...p, fila: filaDe(a), col: colDe(a), mov };
            return p;
          })
        );
      };

      const marcarExplota = (p: Paso) => {
        const quitar = new Set(p.quitar.map((i) => idsRef.current[i]));
        setPiezas((ps) => ps.map((v) => (quitar.has(v.id) ? { ...v, explota: true } : v)));
      };

      const aplicarPaso = (p: Paso) => {
        const antes = idsRef.current;
        const quitar = new Set(p.quitar.map((i) => antes[i]));
        const n = ++nonce.current;
        const bajan = new Map(
          p.caidas.map((c) => [antes[c.desde] as number, { celda: c.hasta, filas: (c.hasta - c.desde) / columnas }])
        );
        const creados: number[] = [];
        idsRef.current = idsTrasPaso(antes, p, () => {
          const id = siguienteId.current++;
          creados.push(id);
          return id;
        });
        celdasRef.current = [...p.tablero];
        setPiezas((ps) => {
          const quedan = ps
            .filter((v) => !quitar.has(v.id))
            .map((v) => {
              const baja = bajan.get(v.id);
              if (!baja) return v;
              const mov: Movimiento = { tipo: 'caida', filas: baja.filas, asienta: false, nonce: n };
              return { ...v, fila: filaDe(baja.celda), col: colDe(baja.celda), mov };
            });
          const nuevas: PiezaVista[] = p.nuevas.map((nv, k) => ({
            id: creados[k] as number,
            color: nv.color,
            fila: filaDe(nv.indice),
            col: colDe(nv.indice),
            explota: false,
            mov: null,
            entrada: { desde: nv.desde, retraso: retrasoDeColumna(colDe(nv.indice)) },
            rechazo: 0,
          }));
          return [...quedan, ...nuevas];
        });
      };

      const aplicarRebaraje = (despues: readonly number[]) => {
        const antes = celdasRef.current;
        const ids = idsRef.current;
        const vieja = new Map<number, number>();
        ids.forEach((id, i) => vieja.set(id, i));
        const r = idsTrasRebaraje(antes, ids, despues, nuevoId);
        const n = ++nonce.current;
        const sobran = new Set(r.sobran);
        setPiezas((ps) => {
          const porId = new Map(ps.filter((p) => !sobran.has(p.id)).map((p) => [p.id, p]));
          return r.ids.map((id, i) => {
            const existente = porId.get(id);
            if (existente) {
              if (vieja.get(id) === i) return existente;
              const mov: Movimiento = { tipo: 'rebaraja', filas: 0, asienta: false, nonce: n };
              return { ...existente, fila: filaDe(i), col: colDe(i), mov };
            }
            return {
              id,
              color: despues[i] as number,
              fila: filaDe(i),
              col: colDe(i),
              explota: false,
              mov: null,
              entrada: { desde: filaDe(i), retraso: 0 },
              rechazo: 0,
            };
          });
        });
        idsRef.current = r.ids;
        celdasRef.current = [...despues];
      };

      void (async () => {
        // 1. Las dos piezas se deslizan una a la otra. Si no armó nada se quedan así y se asientan.
        const sinLinea = j.pasos.length === 0;
        intercambiar(j.a, j.c, sinLinea);
        await dormir(ms(motionDuration.base) + (sinLinea && !sinMovimiento ? motionDuration.rapido : 0));
        if (!vive()) return;

        // 2. Cada paso: estallan, y mientras sus trozos vuelan a las barras, caen las de arriba.
        for (let k = 0; k < j.pasos.length; k++) {
          const p = j.pasos[k];
          if (!p) continue;
          if (k >= 1) mostrarChip(`Cascada ×${k + 1}`);
          marcarExplota(p);
          j.onEstallido?.(p, k);
          if (sinMovimiento) {
            j.onLlegan?.(p, k);
          } else {
            const llegada = motionDulces.pulso + TROZOS_RETRASO_MS + motionDulces.vuelo;
            ultimaLlegada = Math.max(ultimaLlegada, Date.now() + llegada);
            const t = setTimeout(() => {
              timers.current.delete(t);
              if (vive()) j.onLlegan?.(p, k);
            }, llegada);
            timers.current.add(t);
          }
          await dormir(ms(motionDulces.pulso + motionDulces.estallido));
          if (!vive()) return;
          aplicarPaso(p);
          await dormir(sinMovimiento ? motionDuration.rapido : esperaDeCaida(p, columnas));
          if (!vive()) return;
        }

        // 3. Sin movimientos posibles: se avisa y las piezas giran a su nuevo lugar.
        if (j.rebarajado) {
          mostrarChip('Rebarajando el tablero');
          await dormir(ms(motionDuration.base));
          if (!vive()) return;
          aplicarRebaraje(j.rebarajado);
          await dormir(ms(motionDuration.lento));
          if (!vive()) return;
        }

        // Los trozos del último paso tienen que llegar antes de dar por terminada la jugada.
        const falta = ultimaLlegada - Date.now();
        if (falta > 0) await dormir(falta);
        if (!vive()) return;

        if (!celdasRef.current.every((v, i) => v === j.final[i])) {
          if (__DEV__) console.warn('[dulces] el tablero animado no coincide con el del dominio: se corrige');
          reiniciar(j.final, columnas);
        }
        j.onFin();
      })();
    },
    [dormir, nuevoId, reiniciar]
  );

  useImperativeHandle(ref, () => ({ jugar }), [jugar]);

  const alTocar = useCallback((celda: number) => datos.current.onTocar(celda), []);
  const alDeslizar = useCallback((origen: number, destino: number) => datos.current.onDeslizar(origen, destino), []);
  // El deslizamiento no tenía a dónde ir (el borde del tablero): la pieza cabecea y se sacude.
  const alBorde = useCallback((origen: number) => {
    const id = idsRef.current[origen];
    if (id === undefined) return;
    const n = ++rechazoRef.current;
    setPiezas((ps) => ps.map((p) => (p.id === id ? { ...p, rechazo: n } : p)));
  }, []);

  const origen = useSharedValue(-1);
  const hecho = useSharedValue(0);
  const gesto = useMemo(() => {
    const umbral = umbralDeslizar(lado);
    const base = Gesture.Pan().enabled(!bloqueado).minDistance(6).activeOffsetX([-8, 8]);
    // Si el tablero scrollea, un movimiento vertical es del scroll: el gesto se rinde y no roba el dedo.
    const conEje = soloHorizontal ? base.failOffsetY([-10, 10]) : base.activeOffsetY([-8, 8]);
    return conEje
      .onBegin((e) => {
        origen.value = celdaEn(e.x, e.y, paso, cols, rows);
        hecho.value = 0;
      })
      .onUpdate((e) => {
        if (hecho.value === 1 || origen.value < 0) return;
        if (Math.max(Math.abs(e.translationX), Math.abs(e.translationY)) < umbral) return;
        hecho.value = 1;
        const destino = vecinaHacia(origen.value, e.translationX, e.translationY, cols, rows, soloHorizontal);
        if (!destino) return;
        if (destino.celda >= 0) runOnJS(alDeslizar)(origen.value, destino.celda);
        else runOnJS(alBorde)(origen.value);
      })
      .onFinalize(() => {
        origen.value = -1;
      });
  }, [bloqueado, soloHorizontal, lado, paso, cols, rows, origen, hecho, alDeslizar, alBorde]);

  // En orden de lectura (de izquierda a derecha y de arriba abajo): así lo recorre el lector de pantalla.
  const enOrden = useMemo(() => [...piezas].sort((a, b) => a.fila - b.fila || a.col - b.col), [piezas]);

  return (
    <GestureDetector gesture={gesto}>
      <View style={[styles.tablero, { width: ancho, height: alto }]} pointerEvents={bloqueado ? 'none' : 'auto'}>
        {enOrden.map((p) => (
          <Pieza
            key={p.id}
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
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  tablero: { alignSelf: 'center' },
});
