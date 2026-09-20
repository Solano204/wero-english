import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AudioButton } from '@/components/card';
import { Icon, RiskBadge } from '@/components/base';
import { color, font, radius, space, aparecerSubiendo, escalon } from '@/theme';
import type { Entry } from '@/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Tope del stagger: en una lista de 120 renglones nadie espera a que
 *  le toque el turno al último. Pasado esto, todos entran igual de
 *  rápido. FadeInDown ya respeta ReduceMotion.System por su cuenta. */

interface Props {
  entry: Entry;
  onPress: (entry: Entry) => void;
  dominada?: boolean;
  showAudio?: boolean;
  /** Segundo botón para escuchar la frase en español, junto al de inglés.
   *  Apagado por defecto: en una lista de 100+ renglones (Explorar, un
   *  pack) un segundo botón por fila es puro ruido. */
  showSpanishAudio?: boolean;
  /** Posición en la lista, para la entrada escalonada. Sin ella, entra sin demora. */
  index?: number;
  /** 'compacta': renglón de una línea para listas largas. 'mazo': tarjeta
   *  con el texto a ancho completo y los audios etiquetados debajo; en
   *  esa variante el botón en español siempre va (ignora showSpanishAudio). */
  variant?: 'compacta' | 'mazo';
}

/** Cuerpo de la variante 'mazo': texto arriba, acciones abajo. */
function ContenidoMazo({
  entry,
  dominada,
  showAudio,
}: Pick<Props, 'entry' | 'dominada' | 'showAudio'>) {
  return (
    <>
      <View style={styles.bodyMazo}>
        <View style={styles.head}>
          <Text style={styles.phrase} numberOfLines={2}>
            {entry.phrase}
          </Text>
          {dominada ? <Icon name="check" size="md" color={color.correct} /> : null}
        </View>
        <Text style={styles.spanish} numberOfLines={2}>
          {entry.spanish_main}
        </Text>
        {entry.vulgaridad > 0 ? (
          <View style={styles.badges}>
            <RiskBadge vulgaridad={entry.vulgaridad} />
          </View>
        ) : null}
      </View>

      <View style={styles.separador} />

      <View style={styles.acciones}>
        {showAudio && entry.audio_en ? (
          <AudioButton path={entry.audio_en} size="sm" label="Inglés" />
        ) : null}
        {entry.audio_es ? (
          <AudioButton path={entry.audio_es} size="sm" label="Español" />
        ) : null}
        <View style={styles.ver}>
          <Text style={styles.verTexto}>Ver</Text>
          <Icon name="chevron-right" size="sm" color={color.textMuted} />
        </View>
      </View>
    </>
  );
}

/**
 * Renglón de una lista de frases.
 *
 * Va memoizado porque las listas de packs llegan a 120 renglones y sin
 * memo cualquier cambio de estado del padre los repinta todos.
 */
export const EntryRow = memo(function EntryRow({
  entry,
  onPress,
  dominada,
  showAudio = true,
  showSpanishAudio = false,
  index = 0,
  variant = 'compacta',
}: Props) {
  const esMazo = variant === 'mazo';
  return (
    <AnimatedPressable
      entering={aparecerSubiendo(escalon(index))}
      onPress={() => onPress(entry)}
      accessibilityRole="button"
      accessibilityLabel={`${entry.phrase}. ${entry.spanish_main}`}
      style={({ pressed }: { pressed: boolean }) => [
        styles.row,
        esMazo && styles.rowMazo,
        pressed && styles.pressed,
      ]}
    >
      {esMazo ? (
        <ContenidoMazo entry={entry} dominada={dominada} showAudio={showAudio} />
      ) : (
        <>
          <View style={styles.body}>
            <View style={styles.head}>
              <Text style={styles.phrase} numberOfLines={2}>
                {entry.phrase}
              </Text>
              {dominada ? <Icon name="check" size="md" color={color.correct} /> : null}
            </View>
            <Text style={styles.spanish} numberOfLines={2}>
              {entry.spanish_main}
            </Text>
            {entry.vulgaridad > 0 ? (
              <View style={styles.badges}>
                <RiskBadge vulgaridad={entry.vulgaridad} />
              </View>
            ) : null}
          </View>

          {showAudio && entry.audio_en ? (
            <AudioButton path={entry.audio_en} size="sm" />
          ) : null}
          {showSpanishAudio && entry.audio_es ? (
            <AudioButton path={entry.audio_es} size="sm" />
          ) : null}
        </>
      )}
    </AnimatedPressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
  },
  // Pisa el flexDirection, el alineado y el gap de `row`: en columna, con
  // alignItems 'center' el texto se encogería a su contenido.
  rowMazo: { flexDirection: 'column', alignItems: 'stretch', gap: space.sm },
  pressed: { opacity: 0.7 },
  body: { flex: 1, gap: 3 },
  bodyMazo: { gap: 3 },
  separador: { height: StyleSheet.hairlineWidth, backgroundColor: color.border },
  acciones: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  ver: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm },
  verTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  phrase: {
    flex: 1,
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  spanish: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  badges: { flexDirection: 'row', gap: space.xs, marginTop: 2 },
});
