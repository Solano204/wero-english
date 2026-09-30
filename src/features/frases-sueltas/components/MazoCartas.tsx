import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { BordePunteado } from '@/shared/ui/fx/BordePunteado';
import {
  MAZO,
  amortiguar,
  bajaDeProfundidad,
  decidirGesto,
  escalaDeProfundidad,
  giroDeArrastre,
  giroDeSalida,
  indicesVisibles,
  opacidadDeProfundidad,
} from '@/domain/mazo';
import { aparecerRapido, color, font, motionDuration, motionEasing, motionMazo, motionSpring, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';
import { CartaFrase, type Modo, type Sonando } from './CartaFrase';
import { IndicadorArrastre } from './IndicadorArrastre';

/** Lo que le quita al ancho de la zona el filo de la carta (1 dp a cada lado) y su padding de `lg`. */
const RESTA_ANCHO_TEXTO = 2 + space.lg * 2;
/** Lo que sale de más una carta lanzada, en dp, para que quede del todo fuera de la pantalla aunque gire. */
const SALIDA_EXTRA = 96;

export interface ManejadorMazo {
  /** Lanza la carta de arriba como un deslizamiento a la izquierda (el botón «Siguiente» y la acción del lector de pantalla). */
  siguiente: () => void;
}

interface Props {
  entradas: Entry[];
  /** La posición de la carta de arriba en `entradas`. */
  actual: number;
  sonando: Sonando | null;
  onSonar: (modo: Modo) => void;
  guardada: boolean;
  /** Guardar o quitar de Mi mazo: el botón y la acción del lector de pantalla. */
  onGuardar: () => void;
  /** Deslizar hacia arriba: solo guarda, nunca quita una frase ya guardada. */
  onGuardarDeslizando: () => void;
  /** La carta de arriba empieza a irse: corta la voz. */
  alLanzar: () => void;
  /** La carta ya salió y la de atrás quedó arriba (o se acabó la baraja). */
  alAvanzar: () => void;
}

interface CartaProps {
  n: number;
  entry: Entry;
  esActual: boolean;
  /** Su lugar en el mazo cuando este se armó (0, 1 o 2) si le toca el abanico de entrada; las que llegan después, null. */
  lugarInicial: number | null;
  alto: number;
  ancho: number;
  pos: SharedValue<number>;
  topIdx: SharedValue<number>;
  tx: SharedValue<number>;
  ty: SharedValue<number>;
  rot: SharedValue<number>;
  reducido: boolean;
  sonando: Sonando | null;
  onSonar: (modo: Modo) => void;
  guardada: boolean;
  onSiguiente: () => void;
  onGuardar: () => void;
}

/**
 * Una carta del mazo. Su lugar sale de `n - pos` (cuántos lugares hay entre ella y la de arriba, con decimales mientras
 * el mazo avanza): las de atrás se asoman, más chicas y más tenues; la de arriba (`topIdx`) sigue al dedo con `tx`, `ty`
 * y `rot`. Como `pos` nunca vuelve atrás, la carta de atrás sube sin parpadeo mientras la de arriba se va. Toda carta
 * nueva aparece con un fundido. Al armarse el mazo, las dos de atrás se abren en abanico (una a la izquierda y otra a la
 * derecha, `abre` en `motionMazo`) y se juntan, con un escalón entre carta y carta; la de arriba se queda quieta.
 */
const CartaEnMazo = memo(function CartaEnMazo({
  n,
  entry,
  esActual,
  lugarInicial,
  alto,
  ancho,
  pos,
  topIdx,
  tx,
  ty,
  rot,
  reducido,
  sonando,
  onSonar,
  guardada,
  onSiguiente,
  onGuardar,
}: CartaProps) {
  const llegada = useSharedValue(0);
  const abre = useSharedValue(0);
  // La segunda se abre a la izquierda y la tercera a la derecha; la de arriba no se mueve.
  const lado = lugarInicial === 1 ? -1 : lugarInicial === 2 ? 1 : 0;

  useEffect(() => {
    llegada.value = reducido ? 1 : withTiming(1, { duration: motionDuration.base, easing: motionEasing.entrar });
    return () => cancelAnimation(llegada);
  }, [reducido, llegada]);

  useEffect(() => {
    if (reducido || lugarInicial === null || lugarInicial === 0) return;
    abre.value = withDelay(
      motionMazo.escalon * lugarInicial,
      withSequence(
        withTiming(1, { duration: motionMazo.abre, easing: motionEasing.entrar }),
        withTiming(0, { duration: motionMazo.junta, easing: motionEasing.ciclo })
      )
    );
    return () => cancelAnimation(abre);
    // Solo al armarse el mazo: `lugarInicial` no cambia mientras la carta está montada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Las de atrás van tapadas con el color de la carta (en iOS el fondo es translúcido y se les vería el texto); al subir se destapan.
  const velo = useAnimatedStyle(() => ({ opacity: Math.min(1, Math.max(0, n - pos.value)) }));

  const estilo = useAnimatedStyle(() => {
    const d = n - pos.value;
    // La que ya salió no se ve, aunque su lugar en pantalla sea el último del lanzamiento.
    if (d <= -1) return { opacity: 0 };
    const arriba = topIdx.value === n;
    return {
      opacity: opacidadDeProfundidad(d) * llegada.value,
      transform: [
        { translateX: (arriba ? tx.value : 0) + lado * motionMazo.separa * abre.value },
        { translateY: (arriba ? ty.value : 0) + bajaDeProfundidad(d) },
        { rotate: `${(arriba ? rot.value : 0) + lado * motionMazo.abanico * abre.value}deg` },
        { scale: escalaDeProfundidad(d) },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents={esActual ? 'auto' : 'none'}
      accessibilityElementsHidden={!esActual}
      importantForAccessibility={esActual ? 'auto' : 'no-hide-descendants'}
      style={[styles.carta, { height: alto }, estilo]}
    >
      <CartaFrase
        entry={entry}
        activa={esActual}
        alto={alto}
        ancho={ancho}
        sonando={esActual ? sonando : null}
        onSonar={onSonar}
        guardada={guardada}
        onSiguiente={onSiguiente}
        onGuardar={onGuardar}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.velo, velo]} />
    </Animated.View>
  );
});

/**
 * El mazo de Frases sueltas: la carta de arriba de un mazo, con dos asomadas detrás (solo se montan tres). Deslizarla a la
 * izquierda la lanza fuera con un giro leve según la velocidad del dedo (pasa por distancia o por velocidad; si no,
 * regresa con resorte); deslizarla hacia arriba guarda la frase y la carta vuelve a su lugar sin pasar a la siguiente. Un
 * indicador sutil marca hacia dónde va. El gesto corre en el hilo de UI. Con «reducir movimiento» no hay mazo: una sola
 * carta que cambia con un fundido de 150 ms y sin deslizamiento (quedan los botones y las acciones del lector de pantalla).
 * El deslizamiento nunca es la única forma de hacer algo: `siguiente` y `onGuardar` los usan también los botones.
 */
export const MazoCartas = forwardRef<ManejadorMazo, Props>(function MazoCartas(
  { entradas, actual, sonando, onSonar, guardada, onGuardar, onGuardarDeslizando, alLanzar, alAvanzar },
  ref
) {
  const reducido = useMovimientoReducido();
  const [zona, setZona] = useState({ ancho: 0, alto: 0 });
  const pos = useSharedValue(actual);
  const topIdx = useSharedValue(actual);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const ocupada = useSharedValue(0);
  const anchoZona = useSharedValue(0);
  // Dónde estaba la carta al tomarla con el dedo (puede venir de un regreso a medias).
  const origenX = useSharedValue(0);
  const origenY = useSharedValue(0);

  // Los avisos van por una referencia: el gesto no se rearma cada vez que la pantalla cambia de frase.
  const avisos = useRef({ alLanzar, alAvanzar, onGuardarDeslizando });
  avisos.current = { alLanzar, alAvanzar, onGuardarDeslizando };
  const lanzado = useCallback(() => avisos.current.alLanzar(), []);
  const avanzado = useCallback(() => avisos.current.alAvanzar(), []);
  const guardado = useCallback(() => avisos.current.onGuardarDeslizando(), []);

  // Al desmontar (salir, otra tanda) se sueltan las animaciones: sus avisos ya no llegan a la pantalla.
  useEffect(
    () => () => {
      cancelAnimation(pos);
      cancelAnimation(tx);
      cancelAnimation(ty);
      cancelAnimation(rot);
    },
    [pos, tx, ty, rot]
  );

  const lanzar = useCallback(
    (vx: number) => {
      'worklet';
      if (ocupada.value === 1) return;
      ocupada.value = 1;
      const n = topIdx.value;
      tx.value = withTiming(-(anchoZona.value + SALIDA_EXTRA), { duration: motionMazo.lanzar, easing: motionEasing.salir });
      rot.value = withTiming(giroDeSalida(vx), { duration: motionMazo.lanzar, easing: motionEasing.salir });
      pos.value = withTiming(n + 1, { duration: motionMazo.lanzar, easing: motionEasing.entrar }, (fin) => {
        'worklet';
        if (!fin) return;
        // La de atrás pasa a ser la de arriba y el dedo vuelve a cero en el mismo cuadro: no hay salto.
        topIdx.value = n + 1;
        tx.value = 0;
        ty.value = 0;
        rot.value = 0;
        ocupada.value = 0;
        runOnJS(avanzado)();
      });
      runOnJS(lanzado)();
    },
    [ocupada, topIdx, tx, ty, rot, pos, anchoZona, avanzado, lanzado]
  );

  const regresar = useCallback(() => {
    'worklet';
    tx.value = withSpring(0, motionSpring.rebote);
    ty.value = withSpring(0, motionSpring.rebote);
    rot.value = withSpring(0, motionSpring.rebote);
  }, [tx, ty, rot]);

  const gesto = useMemo(() => {
    return Gesture.Pan()
      .minDistance(10)
      .onStart(() => {
        if (ocupada.value === 1) return;
        cancelAnimation(tx);
        cancelAnimation(ty);
        cancelAnimation(rot);
        origenX.value = tx.value;
        origenY.value = ty.value;
      })
      .onUpdate((e) => {
        if (ocupada.value === 1) return;
        tx.value = amortiguar(origenX.value + e.translationX);
        ty.value = amortiguar(origenY.value + e.translationY);
        rot.value = giroDeArrastre(tx.value);
      })
      .onEnd((e) => {
        if (ocupada.value === 1) return;
        const g = decidirGesto(tx.value, ty.value, e.velocityX, e.velocityY);
        if (g === 'siguiente') {
          lanzar(e.velocityX);
          return;
        }
        if (g === 'guardar') runOnJS(guardado)();
        regresar();
      })
      .onFinalize((_, exito) => {
        // Un gesto interrumpido (llamada, otro gesto) no deja la carta a medio camino.
        if (!exito && ocupada.value === 0) regresar();
      });
  }, [ocupada, tx, ty, rot, origenX, origenY, lanzar, regresar, guardado]);

  const siguiente = useCallback(() => {
    if (actual >= entradas.length) return;
    if (reducido) {
      lanzado();
      avanzado();
      return;
    }
    runOnUI(() => {
      'worklet';
      lanzar(-motionMazo.velocidadBoton);
    })();
  }, [actual, entradas.length, reducido, lanzar, lanzado, avanzado]);
  useImperativeHandle(ref, () => ({ siguiente }), [siguiente]);

  const alto = Math.max(0, zona.alto - MAZO.asoma * (MAZO.cartas - 1));
  const ancho = zona.ancho - RESTA_ANCHO_TEXTO;
  const listo = zona.alto > 0 && zona.ancho > 0;
  const alMedir = useCallback(
    (e: { nativeEvent: { layout: { width: number; height: number } } }) => {
      anchoZona.value = e.nativeEvent.layout.width;
      setZona({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height });
    },
    [anchoZona]
  );

  const cartaActual = entradas[actual];
  if (reducido) {
    return (
      <View style={styles.zona} onLayout={alMedir}>
        {listo && cartaActual ? (
          <Animated.View key={cartaActual.id} entering={aparecerRapido()} style={[styles.carta, { height: alto }]}>
            <CartaFrase
              entry={cartaActual}
              activa
              alto={alto}
              ancho={ancho}
              sonando={sonando}
              onSonar={onSonar}
              guardada={guardada}
              onSiguiente={siguiente}
              onGuardar={onGuardar}
            />
          </Animated.View>
        ) : null}
      </View>
    );
  }

  // La de arriba se dibuja al final: en React Native lo que va después queda encima.
  const actualAlArmar = useRef(actual).current;
  const pila = listo ? indicesVisibles(actual, entradas.length).reverse() : [];
  return (
    <GestureDetector gesture={gesto}>
      <View style={styles.zona} onLayout={alMedir}>
        {pila.map((n) => {
          const entry = entradas[n];
          if (!entry) return null;
          return (
            <CartaEnMazo
              key={entry.id}
              n={n}
              entry={entry}
              esActual={n === actual}
              lugarInicial={n - actualAlArmar < MAZO.cartas ? n - actualAlArmar : null}
              alto={alto}
              ancho={ancho}
              pos={pos}
              topIdx={topIdx}
              tx={tx}
              ty={ty}
              rot={rot}
              reducido={reducido}
              sonando={sonando}
              onSonar={onSonar}
              guardada={guardada}
              onSiguiente={siguiente}
              onGuardar={onGuardar}
            />
          );
        })}
        <IndicadorArrastre tx={tx} ty={ty} />
      </View>
    </GestureDetector>
  );
});

/**
 * El mazo vacío: el lugar de la carta de arriba con un contorno punteado y «Barajando…». Es lo que se ve mientras llega la
 * primera baraja y cuando se acaban las 60 frases y se pide otra. No se mueve: la carta nueva entra con el abanico.
 */
export function MazoVacio() {
  const [caja, setCaja] = useState({ ancho: 0, alto: 0 });
  return (
    <View
      style={styles.vacio}
      onLayout={(e) => setCaja({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}
    >
      {caja.ancho > 0 ? <BordePunteado ancho={caja.ancho} alto={caja.alto} tono={color.textFaint} /> : null}
      <Text style={styles.barajando}>Barajando…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  zona: { flex: 1 },
  // Las cartas comparten lugar; las de atrás se corren hacia abajo con `bajaDeProfundidad`. El origen abajo hace que
  // al achicarse conserven el borde de abajo y solo se asome eso.
  carta: { position: 'absolute', top: 0, left: 0, right: 0, transformOrigin: '50% 100%' },
  velo: { backgroundColor: color.surface, borderRadius: radius.lg },
  // Del alto de una carta: arriba, y lo que se asoma de las de atrás queda vacío.
  vacio: { flex: 1, marginBottom: MAZO.asoma * (MAZO.cartas - 1), alignItems: 'center', justifyContent: 'center' },
  barajando: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
