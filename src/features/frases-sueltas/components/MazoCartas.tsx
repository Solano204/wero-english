import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, runOnUI, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BordePunteado } from '@/shared/ui/fx/BordePunteado';
import { PrecargaImagen } from '@/shared/ui/PrecargaImagen';
import { MAZO, alturaImagen, amortiguar, decidirGesto, giroDeArrastre, giroDeSalida, indicesVisibles } from '@/domain/mazo';
import { aparecerRapido, color, font, motionEasing, motionMazo, motionSpring, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';
import { CartaFrase, type Modo, type Sonando } from './CartaFrase';
import { IndicadorArrastre } from './IndicadorArrastre';
import { CartaEnMazo } from './CartaEnMazo';

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
  'use no memo';
  // Fuera del React Compiler a propósito: los callbacks del gesto leen refs con los avisos más recientes (así el
  // gesto no se rearma a media partida, lo que cortaría un arrastre en curso) y el compilador no sabe que esos
  // callbacks corren después del render. Se queda con su memorización a mano (useMemo del gesto, useCallback).
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
  useLayoutEffect(() => {
    avisos.current = { alLanzar, alAvanzar, onGuardarDeslizando };
  }, [alLanzar, alAvanzar, onGuardarDeslizando]);
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
      if (ocupada.get() === 1) return;
      ocupada.set(1);
      const n = topIdx.get();
      tx.set(withTiming(-(anchoZona.get() + SALIDA_EXTRA), { duration: motionMazo.lanzar, easing: motionEasing.salir }));
      rot.set(withTiming(giroDeSalida(vx), { duration: motionMazo.lanzar, easing: motionEasing.salir }));
      pos.set(withTiming(n + 1, { duration: motionMazo.lanzar, easing: motionEasing.entrar }, (fin) => {
        'worklet';
        if (!fin) return;
        // La de atrás pasa a ser la de arriba y el dedo vuelve a cero en el mismo cuadro: no hay salto.
        topIdx.set(n + 1);
        tx.set(0);
        ty.set(0);
        rot.set(0);
        ocupada.set(0);
        runOnJS(avanzado)();
      }));
      runOnJS(lanzado)();
    },
    [ocupada, topIdx, tx, ty, rot, pos, anchoZona, avanzado, lanzado]
  );

  const regresar = useCallback(() => {
    'worklet';
    tx.set(withSpring(0, motionSpring.rebote));
    ty.set(withSpring(0, motionSpring.rebote));
    rot.set(withSpring(0, motionSpring.rebote));
  }, [tx, ty, rot]);

  const gesto = useMemo(() => {
    return Gesture.Pan()
      .minDistance(10)
      .onStart(() => {
        if (ocupada.get() === 1) return;
        cancelAnimation(tx);
        cancelAnimation(ty);
        cancelAnimation(rot);
        origenX.set(tx.get());
        origenY.set(ty.get());
      })
      .onUpdate((e) => {
        if (ocupada.get() === 1) return;
        tx.set(amortiguar(origenX.get() + e.translationX));
        ty.set(amortiguar(origenY.get() + e.translationY));
        rot.set(giroDeArrastre(tx.get()));
      })
      .onEnd((e) => {
        if (ocupada.get() === 1) return;
        const g = decidirGesto(tx.get(), ty.get(), e.velocityX, e.velocityY);
        if (g === 'siguiente') {
          lanzar(e.velocityX);
          return;
        }
        if (g === 'guardar') runOnJS(guardado)();
        regresar();
      })
      .onFinalize((_, exito) => {
        // Un gesto interrumpido (llamada, otro gesto) no deja la carta a medio camino.
        if (!exito && ocupada.get() === 0) regresar();
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
      anchoZona.set(e.nativeEvent.layout.width);
      setZona({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height });
    },
    [anchoZona]
  );

  const cartaActual = entradas[actual];
  // Qué carta iba arriba al armar el mazo (antes del return de reducir movimiento: los hooks no van condicionados).
  const actualAlArmar = useRef(actual).current;
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
  const pila = listo ? indicesVisibles(actual, entradas.length).reverse() : [];
  const sigueFueraDelMazo = listo ? entradas[actual + MAZO.cartas]?.imagen ?? null : null;
  return (
    <GestureDetector gesture={gesto}>
      <View style={styles.zona} onLayout={alMedir}>
        <PrecargaImagen path={sigueFueraDelMazo} ancho={ancho} alto={alturaImagen(ancho)} />
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
      onLayout={(e) => {
        const { width: ancho, height: alto } = e.nativeEvent.layout;
        setCaja((c) => (c.ancho === ancho && c.alto === alto ? c : { ancho, alto }));
      }}
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
  vacio: { flex: 1, marginBottom: MAZO.asoma * (MAZO.cartas - 1), alignItems: 'center', justifyContent: 'center' },
  barajando: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },

});
