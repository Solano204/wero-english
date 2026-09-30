import React, { useCallback, useEffect, useRef, useEffectEvent, useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { color, radius } from '@/theme';

interface OpcionesCuenta {
  /** Cuánto dura. Reiniciar el reloj se hace cambiando `llave`. */
  segundos: number;
  /** Cambiar este valor reinicia la barra desde cero. */
  llave: string | number;
  /** Se llama una sola vez cuando se agota. */
  onFin: () => void;
  /** Congela la cuenta donde va. Para cuando ya se respondió. */
  pausado?: boolean;
}

/**
 * La cuenta regresiva de los juegos: un valor de 0 (recién empieza) a 1 (se agotó) que
 * corre en el hilo de UI con reanimated. Con un setInterval en JS se traba justo cuando
 * SQLite escribe la respuesta anterior, que es el peor momento posible para que un
 * reloj se congele. Lo usan `RoundTimer` y el reloj de Pares.
 *
 * `onFin` se lee al agotarse, no al arrancar: si el efecto capturara la función de
 * cuando empezó, una partida que termina por tiempo contaría los aciertos de entonces.
 */
export function useCuentaRegresiva({ segundos, llave, onFin, pausado = false }: OpcionesCuenta): SharedValue<number> {
  const avance = useSharedValue(0);
  // Para distinguir "empieza una ronda nueva" de "se reanuda la misma":
  // solo la primera reinicia la barra a cero.
  const llaveAnterior = useRef(llave);
  const onFinRef = useRef(onFin);
  useLayoutEffect(() => {
    onFinRef.current = onFin;
  }, [onFin]);
  const alFin = useCallback(() => onFinRef.current(), []);

  const efectoLlave = useEffectEvent(() => {
    const rondaNueva = llaveAnterior.current !== llave;
    llaveAnterior.current = llave;

    if (rondaNueva) {
      cancelAnimation(avance);
      avance.set(0);
    }

    if (pausado) {
      // cancelAnimation congela el valor donde iba: por eso pausar y
      // reanudar no pierde ni regala tiempo.
      cancelAnimation(avance);
      return;
    }

    // Ronda nueva: la barra completa. Reanudación tras pausa: solo lo
    // que falta, para que el tiempo pausado no cuente ni de más ni de
    // menos.
    const restante = rondaNueva ? 1 : 1 - avance.get();
    if (restante <= 0) return;

    avance.set(withTiming(
      1,
      { duration: segundos * 1000 * restante, easing: Easing.linear },
      (terminada) => {
        if (terminada) runOnJS(alFin)();
      }
    ));

    return () => cancelAnimation(avance);
    // `llave` es lo que reinicia: cada ronda nueva trae una distinta.
  });
  useEffect(() => efectoLlave(), [llave, segundos, pausado]);

  return avance;
}

interface Props extends OpcionesCuenta {
  tint?: string;
}

/**
 * El reloj de los juegos.
 *
 * Es una barra que se vacía, no un número que baja. Un contador
 * numérico obliga a leer y a hacer una resta mental en medio del
 * ejercicio; una barra se entiende con la vista periférica sin dejar de
 * mirar el tablero, que es donde el usuario tiene que estar.
 *
 * Cambia a ámbar en el último tercio. No a rojo: rojo dice que fallaste
 * y todavía no ha pasado nada.
 */
export function RoundTimer({ segundos, llave, onFin, pausado = false, tint }: Props) {
  const avance = useCuentaRegresiva({ segundos, llave, onFin, pausado });

  const barra = useAnimatedStyle(() => ({
    width: `${Math.max(0, (1 - avance.get()) * 100)}%`,
    backgroundColor:
      avance.get() > 0.66 ? color.riskWarn : tint ?? color.accent,
  }));

  return (
    <View style={styles.pista}>
      <Animated.View style={[styles.relleno, barra]} />
    </View>
  );
}

const styles = StyleSheet.create({
  pista: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    overflow: 'hidden',
  },
  relleno: { height: '100%', borderRadius: radius.pill },
});
