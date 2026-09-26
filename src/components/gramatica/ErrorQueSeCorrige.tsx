import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { Button, Card } from '@/components/base';
import { AudioButton } from '@/components/card';
import { useVisto } from '@/components/fx/useVisibilidad';
import { color, font, motionDuration, space } from '@/theme';
import { VistaCorreccion, useCorreccion } from './CorreccionFrase';

interface Props {
  mal: string;
  bien: string;
  porQue: string;
  audioBien: string;
  /** El scroll de la pantalla: la corrección arranca cuando el bloque entra a la vista. */
  scrollY: SharedValue<number>;
  /** Corre justo antes de pedir un audio: suelta la secuencia de «Escuchar todos». */
  antes: () => void;
}

/**
 * El momento héroe de la pantalla del tema: la frase incorrecta primero (ámbar, ícono x); al entrar a la vista o al
 * tocar «Escuchar», cada palabra que cambia se tacha de izquierda a derecha y la frase se transforma en la correcta: lo
 * igual se queda, lo que sobra sale y lo que falta llega en `correct`, y el ícono pasa a check. «Ver otra vez» la repite.
 * Si las dos frases se parecen poco (`diffFrase().claro` en false) no hay morph: se ven las dos, con un fundido. Con
 * «reducir movimiento» se ven las dos a la vez, sin animación. El lector de pantalla oye siempre «Incorrecta: … Correcta: …».
 * La corrección en sí (el diff, las tachas y los temporizadores) vive en `CorreccionFrase`, que también usa Errores.
 */
export function ErrorQueSeCorrige({ mal, bien, porQue, audioBien, scrollY, antes }: Props) {
  const correccion = useCorreccion(mal, bien);
  const { modo, jugar } = correccion;
  const arranque = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montado = useRef(Date.now());
  const yaJugo = useRef(false);
  const { ref, alAcomodar, visto } = useVisto(scrollY);

  // Arranca una sola vez, cuando el bloque llega a la vista. Si ya estaba a la vista al abrir la pantalla espera a que
  // termine la entrada de las secciones, para que se vea la incorrecta.
  useEffect(() => {
    if (!visto || yaJugo.current || modo === 'estatico') return;
    yaJugo.current = true;
    const espera = Math.max(0, motionDuration.coreografia - (Date.now() - montado.current));
    arranque.current = setTimeout(jugar, espera);
  }, [visto, modo, jugar]);

  useEffect(
    () => () => {
      if (arranque.current) clearTimeout(arranque.current);
    },
    []
  );

  const alEscuchar = () => {
    antes();
    if (modo !== 'estatico') jugar();
  };

  return (
    <Card>
      <Animated.View
        ref={ref}
        collapsable={false}
        onLayout={alAcomodar}
        accessible
        accessibilityLabel={`Incorrecta: ${mal}. Correcta: ${bien}.`}
      >
        <VistaCorreccion correccion={correccion} mal={mal} bien={bien} />
      </Animated.View>
      <Text style={styles.porQue}>{porQue}</Text>
      <View style={styles.controles}>
        <AudioButton path={audioBien} size="sm" label="Escuchar" onBeforePlay={alEscuchar} />
        <AudioButton path={audioBien} size="sm" slow label="Lento" onBeforePlay={antes} />
        {modo === 'estatico' ? null : <Button variant="ghost" icon="repeat" label="Ver otra vez" onPress={jugar} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  porQue: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.55,
  },
  controles: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
});
