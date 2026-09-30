import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button } from '@/components/base';
import { etiquetaProximoRepaso } from '@/domain/session';
import { aparecerSubiendo, color, font, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import { conteo } from '@/utils/text';

interface Props {
  /** El resumen de la sesión que acaba de terminar; null si no hubo sesión (no había nada que repasar). */
  resumen: { total: number; correct: number; streak: number } | null;
  /** Vencidas que todavía quedan (una sesión completa que no alcanzó para todas). */
  pendientes: number;
  /** Cuándo vuelve el próximo repaso (ms epoch), o null si no hay ninguno programado. */
  proximoRepaso: number | null;
  /** Frases nuevas que quedan en el catálogo con los filtros actuales. */
  nuevasCatalogo: number;
  onSeguirRepasando: () => void;
  onAprenderNuevas: () => void;
  onJugar: () => void;
  onFrasesSueltas: () => void;
  onVolver: () => void;
}

/**
 * El final de Estudiar, cuando la sesión se acabó o no había nada que armar. Nunca una pantalla
 * vacía: dice qué se hizo, cuándo vuelven los repasos y qué se puede hacer ahora. Con el tono de
 * siempre: sin exclamaciones y sin celebrar de más (la fiesta, si toca, es el confeti de la sesión).
 *
 * Una sola acción principal: seguir repasando si quedan vencidas; si no, aprender frases nuevas si
 * quedan en el catálogo; si tampoco, Frases sueltas.
 */
export function FinDelDia({
  resumen,
  pendientes,
  proximoRepaso,
  nuevasCatalogo,
  onSeguirRepasando,
  onAprenderNuevas,
  onJugar,
  onFrasesSueltas,
  onVolver,
}: Props) {
  const reducido = useMovimientoReducido();
  const quedan = pendientes > 0;
  const sinNuevas = nuevasCatalogo === 0;

  return (
    <Animated.View
      entering={reducido ? undefined : aparecerSubiendo()}
      style={styles.raiz}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.textos}>
        <Text style={styles.titulo} accessibilityRole="header">
          {quedan ? 'Sesión terminada' : 'Terminaste por hoy'}
        </Text>
        {resumen && resumen.total > 0 ? (
          <Text style={styles.linea}>
            {`${conteo(resumen.total, 'frase repasada', 'frases repasadas')} · ${conteo(resumen.correct, 'acierto')} · racha de ${conteo(resumen.streak, 'día')}`}
          </Text>
        ) : null}
        {quedan ? (
          <Text style={styles.linea}>{`Te quedan ${conteo(pendientes, 'repaso', 'repasos')} para hoy.`}</Text>
        ) : proximoRepaso !== null ? (
          <Text style={styles.linea}>{`Tus próximos repasos: ${etiquetaProximoRepaso(proximoRepaso)}.`}</Text>
        ) : null}
        {!quedan && sinNuevas ? (
          <Text style={styles.linea}>
            Ya viste todas las frases del catálogo con tus filtros actuales. Puedes seguir con Frases sueltas o con un
            juego.
          </Text>
        ) : null}
      </View>

      <View style={styles.acciones}>
        {quedan ? (
          <Button label={`Seguir repasando (${pendientes})`} onPress={onSeguirRepasando} full size="lg" />
        ) : sinNuevas ? (
          <Button label="Frases sueltas" onPress={onFrasesSueltas} full size="lg" />
        ) : (
          <Button label="Aprender frases nuevas" onPress={onAprenderNuevas} full size="lg" />
        )}
        <Button label="Jugar" variant="secondary" onPress={onJugar} full />
        <Button label="Volver" variant="ghost" onPress={onVolver} full />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xl },
  textos: { gap: space.sm },
  titulo: {
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
    color: color.text,
    textAlign: 'center',
  },
  linea: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
  acciones: { gap: space.sm },
});
