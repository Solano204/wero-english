import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Icon } from '@/shared/ui';
import {
  aparecer,
  aparecerSubiendo,
  color,
  desaparecer,
  entraSube,
  escalon,
  font,
  motionDuration,
  motionEasing,
  motionError,
  reacomodar,
  saleArriba,
  space,
} from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { diffFrase, numerarCambios, type PiezaNumerada } from '@/domain/diffFrase';

type Fase = 'mal' | 'bien';
/** `morph`: la frase se transforma. `fundido`: las dos se ven, una tras otra (se parecen poco). `estatico`: reducir movimiento. */
export type ModoCorreccion = 'morph' | 'fundido' | 'estatico';

// Copias locales: un worklet captura estos colores, no el objeto de tema entero.
const COLOR_MAL = color.wrong;
const COLOR_BIEN = color.text;
const REACOMODO = reacomodar();

interface TachaProps {
  indice: number;
  tacha: SharedValue<number>;
  /** Lo que dura en total el tramo de las tachas (ms). */
  total: number;
}

/** La línea que tacha una palabra de izquierda a derecha, a su turno. */
function Tacha({ indice, tacha, total }: TachaProps) {
  const inicio = escalon(indice);
  const duracion = motionError.tacha;
  const estilo = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.min(1, Math.max(0, (tacha.get() * total - inicio) / duracion)) }],
  }));
  // El fundido de salida va en el nodo exterior y la escala en el interior: una animación de layout y un transform
  // animado en el mismo nodo se pisan.
  return (
    <Animated.View exiting={desaparecer(motionDuration.rapido)} pointerEvents="none" style={styles.tachaCaja}>
      <Animated.View style={[styles.tacha, estilo]} />
    </Animated.View>
  );
}

/** Texto que se queda: pasa de ámbar al color de la frase correcta cuando se resuelve. */
function TextoIgual({ texto, resuelto }: { texto: string; resuelto: SharedValue<number> }) {
  const estilo = useAnimatedStyle(() => ({ color: interpolateColor(resuelto.get(), [0, 1], [COLOR_MAL, COLOR_BIEN]) }));
  return (
    <Animated.Text layout={REACOMODO} style={[styles.palabra, estilo]}>
      {texto}
    </Animated.Text>
  );
}

/** Texto que llega, en `correct`: sube con un fundido tras `motionError.entra` y su escalón. */
function TextoEntra({ texto, indice }: { texto: string; indice: number }) {
  return (
    <Animated.Text
      entering={entraSube(motionError.entra + escalon(indice))}
      layout={REACOMODO}
      style={[styles.palabra, styles.entra]}
    >
      {texto}
    </Animated.Text>
  );
}

interface FraseProps {
  plan: PiezaNumerada[];
  fase: Fase;
  tacha: SharedValue<number>;
  resuelto: SharedValue<number>;
  totalTachas: number;
}

/**
 * La frase como piezas con clave estable: las palabras iguales no se vuelven a montar, las que sobran salen y las que
 * faltan entran, y el resto se reacomoda con `reacomodar()`. Una palabra que cambia de letras es una fila de trozos:
 * los iguales se quedan, los que sobran suben y se van, los nuevos llegan en `correct`.
 */
function FraseTransformada({ plan, fase, tacha, resuelto, totalTachas }: FraseProps) {
  return (
    <View style={styles.frase}>
      {plan.map(({ pieza, tacha: lugarTacha, entra }, i) => {
        if (pieza.tipo === 'igual') return <TextoIgual key={i} texto={pieza.texto} resuelto={resuelto} />;
        if (pieza.tipo === 'sale') {
          return fase === 'mal' ? (
            <Animated.View key={i} exiting={saleArriba()}>
              <Text style={[styles.palabra, styles.sale]}>{pieza.texto}</Text>
              <Tacha indice={lugarTacha} tacha={tacha} total={totalTachas} />
            </Animated.View>
          ) : null;
        }
        if (pieza.tipo === 'entra') return fase === 'bien' ? <TextoEntra key={i} texto={pieza.texto} indice={entra} /> : null;
        // El lugar de cada palabra que entra, contado desde `entra` (sin mutar nada dentro del map).
        const lugares: number[] = [];
        let n = entra;
        for (const parte of pieza.partes) {
          lugares.push(n);
          if (parte.tipo !== 'igual' && parte.tipo !== 'sale') n += 1;
        }
        return (
          <Animated.View key={i} layout={REACOMODO} style={styles.letras}>
            {pieza.partes.map((parte, p) => {
              if (parte.tipo === 'igual') return <TextoIgual key={p} texto={parte.texto} resuelto={resuelto} />;
              if (parte.tipo === 'sale') {
                return fase === 'mal' ? (
                  <Animated.Text key={p} exiting={saleArriba()} layout={REACOMODO} style={[styles.palabra, styles.sale]}>
                    {parte.texto}
                  </Animated.Text>
                ) : null;
              }
              return fase === 'bien' ? <TextoEntra key={p} texto={parte.texto} indice={lugares[p] ?? entra} /> : null;
            })}
            {fase === 'mal' ? <Tacha indice={lugarTacha} tacha={tacha} total={totalTachas} /> : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

interface DosLineasProps {
  mal: string;
  bien: string;
  /** Con la correcta a la vista. */
  resuelta: boolean;
  animada: boolean;
  resuelto: SharedValue<number>;
}

/** Las dos frases, una bajo la otra: la incorrecta se apaga y tacha, la correcta llega con un fundido. Sin morph. */
function DosLineas({ mal, bien, resuelta, animada, resuelto }: DosLineasProps) {
  const estiloMal = useAnimatedStyle(() => ({ opacity: 1 - 0.4 * resuelto.get() }));
  return (
    <View style={styles.lineas}>
      <View style={styles.linea}>
        <View style={styles.icono}>
          <Icon name="close" size="md" color={color.wrong} />
        </View>
        <Animated.Text style={[styles.textoLinea, styles.sale, resuelta && styles.tachada, estiloMal]}>{mal}</Animated.Text>
      </View>
      {resuelta ? (
        <Animated.View entering={animada ? aparecerSubiendo() : undefined} style={styles.linea}>
          <View style={styles.icono}>
            <Icon name="check" size="md" color={color.correct} />
          </View>
          <Text style={[styles.textoLinea, styles.correcta]}>{bien}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Lo que devuelve `useCorreccion`: el estado de la corrección de una frase y cómo ponerla en marcha. */
export interface Correccion {
  modo: ModoCorreccion;
  /** La fase que se ve: con «reducir movimiento» siempre la correcta. */
  faseVista: Fase;
  /** Sube en 1 cada vez que se juega: cada vuelta monta la frase de cero. */
  ciclo: number;
  plan: PiezaNumerada[];
  totalTachas: number;
  tacha: SharedValue<number>;
  resuelto: SharedValue<number>;
  /** Cuántas palabras se tachan (0 si la frase no se transforma) y cuántos trozos llegan. */
  tachas: number;
  entradas: number;
  /** Empieza la corrección desde la frase incorrecta. */
  jugar: () => void;
  /** Suelta los temporizadores y las animaciones. */
  detener: () => void;
}

/**
 * El núcleo de la corrección de una frase: el diff entre la incorrecta y la correcta, cuándo se tacha y cuándo se
 * resuelve. Si las dos frases se parecen poco (`diffFrase().claro` en false) no hay morph: se ven las dos, con un
 * fundido. Con «reducir movimiento» se ven las dos a la vez, sin animación. Quien lo usa decide cuándo `jugar()`.
 */
export function useCorreccion(mal: string, bien: string): Correccion {
  const reducido = useMovimientoReducido();
  const diff = useMemo(() => diffFrase(mal, bien), [mal, bien]);
  const { plan, tachas, entradas } = useMemo(() => numerarCambios(diff.piezas), [diff]);
  const modo: ModoCorreccion = reducido ? 'estatico' : diff.claro ? 'morph' : 'fundido';
  const totalTachas = tachas === 0 ? 0 : motionError.tacha + escalon(tachas - 1);
  const retrasoCambio = modo === 'morph' ? totalTachas + motionError.pausa : motionDuration.escena;

  const [fase, setFase] = useState<Fase>('mal');
  const [ciclo, setCiclo] = useState(0);
  const tacha = useSharedValue(0);
  const resuelto = useSharedValue(0);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  const detener = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = null;
    cancelAnimation(tacha);
    cancelAnimation(resuelto);
  }, [tacha, resuelto]);

  const jugar = () => {
    detener();
    tacha.set(0);
    resuelto.set(0);
    setFase('mal');
    setCiclo((c) => c + 1);
    if (totalTachas > 0) tacha.set(withTiming(1, { duration: totalTachas, easing: motionEasing.lineal }));
    temporizador.current = setTimeout(() => {
      setFase('bien');
      resuelto.set(withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar }));
    }, retrasoCambio);
  };

  useEffect(() => detener, [detener]);

  return {
    modo,
    faseVista: modo === 'estatico' ? 'bien' : fase,
    ciclo,
    plan,
    totalTachas,
    tacha,
    resuelto,
    tachas,
    entradas,
    jugar,
    detener,
  };
}

interface VistaProps {
  correccion: Correccion;
  mal: string;
  bien: string;
}

/** La frase de una corrección: transformándose (morph) o en dos líneas (fundido, o las dos a la vez con reducir movimiento). */
export function VistaCorreccion({ correccion, mal, bien }: VistaProps) {
  const { modo, faseVista, ciclo, plan, totalTachas, tacha, resuelto } = correccion;
  if (modo !== 'morph') {
    return (
      <DosLineas
        key={ciclo}
        mal={mal}
        bien={bien}
        resuelta={faseVista === 'bien'}
        animada={modo === 'fundido'}
        resuelto={resuelto}
      />
    );
  }
  return (
    <View key={ciclo} style={styles.linea}>
      <View style={styles.icono}>
        {faseVista === 'mal' ? (
          <Animated.View exiting={desaparecer(motionDuration.rapido)}>
            <Icon name="close" size="md" color={color.wrong} />
          </Animated.View>
        ) : (
          <Animated.View entering={aparecer(motionError.entra)}>
            <Icon name="check" size="md" color={color.correct} />
          </Animated.View>
        )}
      </View>
      <FraseTransformada plan={plan} fase={faseVista} tacha={tacha} resuelto={resuelto} totalTachas={totalTachas} />
    </View>
  );
}

const styles = StyleSheet.create({
  linea: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  lineas: { gap: space.md },
  icono: { marginTop: space.xs },
  frase: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: space.xs },
  letras: { flexDirection: 'row' },
  palabra: { fontFamily: font.family.bodyStrong, fontSize: font.size.lg, lineHeight: font.size.lg * 1.4 },
  textoLinea: { flex: 1, fontFamily: font.family.bodyStrong, fontSize: font.size.lg, lineHeight: font.size.lg * 1.4 },
  sale: { color: color.wrong },
  entra: { color: color.correct },
  correcta: { color: color.text },
  tachada: { textDecorationLine: 'line-through' },
  tachaCaja: { position: 'absolute', left: 0, right: 0, top: '55%', height: 2 },
  tacha: { flex: 1, backgroundColor: color.text, transformOrigin: 'left' },
});
