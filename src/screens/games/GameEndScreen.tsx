import React, { useEffect, useMemo, useState } from 'react';
import { conteo } from '@/utils/text';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Button, Card, Header, Screen } from '@/components/base';
import { FilaEstrellas } from '@/components/card';
import { Confetti } from '@/components/feedback';
import { logGame } from '@/db/economy';
import { estrellasPara, guardarNivel } from '@/db/levels';
import { loadContent } from '@/store/content';
import { useAuthStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import { PARTIDA_PERFECTA, TRES_ESTRELLAS, elegirFrase } from '@/utils/frases';
import { color, font, space, aparecer, aparecerSubiendo, motionDuration } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'GameEnd'>;

/**
 * P-28, el cierre de cualquier partida.
 *
 * Tiene la misma forma que el de la competencia y tres diferencias que
 * importan:
 *
 * 1. Dice cuántas frases se movieron a repaso, que es el resultado real
 *    de haber jugado.
 * 2. El botón principal lleva al siguiente nivel sin pedir estrellas.
 * 3. Hay una salida debajo. La pantalla de ellos tiene dos botones y los
 *    dos te dejan adentro.
 *
 * Ya no hay monedas. Se quitaron a propósito: la moneda no compraba
 * nada que importara y llenaba de números una pantalla cuyo único
 * trabajo es decirte cómo te fue y llevarte al siguiente nivel.
 */
export function GameEndScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const [ocupado, setOcupado] = useState(false);

  const { juego, rondas, aciertos, nivel } = params;
  const content = useMemo(loadContent, []);
  useMusicaPantalla('juegos');

  /**
   * Las estrellas salen de los umbrales del nivel, que ya vienen
   * calculados en niveles.json. No se recalculan aquí: si la fórmula
   * viviera en dos lados, un día dirían cosas distintas.
   */
  const umbrales = useMemo(() => {
    if (!nivel) return null;
    const def = content.niveles.juegos[juego];
    return def?.niveles[nivel - 1]?.estrellas ?? null;
  }, [content, juego, nivel]);

  const estrellas = umbrales ? estrellasPara(aciertos, umbrales) : 0;

  useEffect(() => {
    if (!user) return;

    void (async () => {
      await logGame(user.id, juego, rondas, aciertos);
      if (nivel && umbrales) {
        await guardarNivel(user.id, juego, nivel, estrellas, aciertos);
      }
    })();
    // Solo al montar: guardar dos veces sumaría dos intentos.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const salir = () => nav.navigate('Main');

  const pct = rondas > 0 ? Math.round((aciertos / rondas) * 100) : 0;
  // Buen resultado: dos estrellas o más donde el juego las da (Niveles); en el
  // resto, cinco rondas o más con el 70 % de aciertos. Solo entonces hay fiesta.
  const merece = umbrales ? estrellas >= 2 : rondas >= 5 && pct >= 70;
  // Las felicitaciones se eligen una vez por pantalla, no en cada render.
  const perfecta = useMemo(
    () => elegirFrase(PARTIDA_PERFECTA).split('{n}').join(String(rondas)),
    [rondas]
  );
  const tresEstrellas = useMemo(() => elegirFrase(TRES_ESTRELLAS), []);

  useEffect(() => {
    // Una sola vez, al mostrar el resultado. Sin buen resultado no suena nada:
    // ni el acierto ni el fallo, terminar una partida no es ninguno de los dos.
    if (merece) void audio.playNivelCompleto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <Header onBack={() => nav.navigate('Main')} />
      <Confetti active={merece} />

      {/*
       * El resultado, en grande y arriba de todo.
       *
       * Antes iba como un renglón chico bajo el título y la gente salía
       * de la partida sin saber cómo le había ido. Lo primero que hay
       * que poder leer sin buscar es el marcador.
       */}
      {/* Con buen resultado el resumen sube; sin él, entra sobrio. */}
      <Animated.View entering={merece ? aparecerSubiendo() : aparecer()} style={styles.head}>
        <Text style={styles.marcador} maxFontSizeMultiplier={1.2}>
          {aciertos}
          <Text style={styles.marcadorTotal}> / {rondas}</Text>
        </Text>

        <Text style={styles.sub}>
          {aciertos === rondas
            ? perfecta
            : aciertos === 0
              ? 'Ninguna esta vez.'
              : `${pct}% de acierto`}
        </Text>

        <Text style={styles.donde}>
          {NOMBRE[juego] ?? 'Partida'}
          {nivel ? ` · nivel ${nivel}` : ''}
        </Text>

        {umbrales ? (
          <>
            <View style={styles.estrellas}>
              <FilaEstrellas
                llenas={estrellas}
                size="xl"
                color={color.star}
                colorVacia={color.border}
                gap={space.sm}
              />
            </View>
            <Text style={styles.estrellasNota}>
              {estrellas === 3
                ? tresEstrellas
                : estrellas === 0
                  ? `El siguiente ya está abierto. Con ${umbrales[0]} sacas tu primera estrella aquí.`
                  : `Con ${umbrales[estrellas]} sacas ${estrellas + 1}.`}
            </Text>
          </>
        ) : null}
      </Animated.View>

      {aciertos > 0 ? (
        <Animated.View entering={merece ? aparecerSubiendo(motionDuration.rapido) : aparecer(motionDuration.rapido)}>
          <Card style={styles.repaso}>
            <Text style={styles.repasoTexto}>
              {conteo(aciertos, 'frase avanzó', 'frases avanzaron')} en tu repaso
            </Text>
            <Text style={styles.repasoNota}>
              Jugar cuenta igual que estudiar. Es la misma tarjeta.
            </Text>
          </Card>
        </Animated.View>
      ) : null}

      <View style={styles.acciones}>
        {/* Terminar abre el siguiente, saques las estrellas que saques.
            Antes este botón solo salía con una estrella o más, que era
            justo el candado que se quitó del resto del sistema. */}
        {nivel ? (
          <Button
            label={`Nivel ${nivel + 1}`}
            icon="arrow-right"
            iconAlFinal
            onPress={() =>
              nav.replace(RUTA_JUEGO[juego] ?? 'Main', {
                nivel: nivel + 1,
              } as never)
            }
            full
            size="lg"
          />
        ) : null}
        {nivel && estrellas < 3 ? (
          <Button
            icon="repeat"
            accessibilityLabel={`Repetir el nivel ${nivel}`}
            variant="secondary"
            onPress={() =>
              nav.replace(RUTA_JUEGO[juego] ?? 'Main', { nivel } as never)
            }
            full
          />
        ) : null}
        <Button
          label="Volver a Practicar"
          variant={nivel ? 'secondary' : 'primary'}
          onPress={salir}
          full
          size={nivel ? 'md' : 'lg'}
        />

        <Button
          label="Listo por hoy"
          variant="ghost"
          onPress={salir}
          full
        />
      </View>

    </Screen>
  );
}

/** A qué pantalla vuelve el botón de siguiente nivel. */
const RUTA_JUEGO: Record<string, 'Colmena' | 'Pares' | 'Caida' | 'Dulces'> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caida',
  dulces: 'Dulces',
};

const NOMBRE: Record<string, string> = {
  caida: 'Caída',
  dulces: 'Dulces',
  colmena: 'Colmena',
  pares: 'Pares',
  judge: '¿Lo digo o no?',
  cazala: 'Cázala',
  pares_minimos: 'Di la palabra',
};

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: space.xs, marginBottom: space.lg },
  marcador: {
    fontSize: 68,
    letterSpacing: 68 * -0.015,
    lineHeight: 74,
    fontFamily: font.family.display,
    color: color.text,
  },
  marcadorTotal: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    color: color.textFaint,
    fontFamily: font.family.body,
  },
  donde: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },
  sub: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  estrellas: { alignSelf: 'center', marginTop: space.sm },
  estrellasNota: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
  },
  repaso: { gap: 4, marginBottom: space.sm },
  repasoTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  repasoNota: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  acciones: { gap: space.sm },
});
