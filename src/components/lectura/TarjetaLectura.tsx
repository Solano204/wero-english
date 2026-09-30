import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated from 'react-native-reanimated';
import { Badge, Icon, LevelBadge, Presionable } from '@/shared/ui';
import { PuntoMundo } from '@/shared/ui/PuntoMundo';
import { etiquetaDificultad, nivelDificultad } from '@/domain/lectura';
import { aparecerSubiendo, color, escalon, font, gradiente, radius, space, text } from '@/theme';
import { conteo } from '@/domain/texto';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Lectura } from '@/types';
import { AnilloFrases } from './AnilloFrases';

/** Una historia con lo que la lista necesita saber de este usuario. */
export interface LecturaFila {
  lectura: Lectura;
  /** 0 a 100: solo para el lector de pantalla, nunca a la vista. */
  dificultad: number;
  dominadas: number;
  total: number;
  abierta: boolean;
  faltan: number;
}

const NOMBRE_MUNDO: Record<string, string> = {
  dia_a_dia: 'Día a día',
  calle: 'Calle y jerga',
  dinero: 'Dinero y trabajo',
  gente: 'Gente y vínculos',
  cultura: 'Cultura y escuela',
  tech: 'Tecnología',
  legal: 'Legal y trámites',
  fonetica: 'Pronunciación',
};

/** Alto de la portada y del anillo: la destacada de cada grupo es más grande (IA-2). */
const PORTADA = { normal: 72, destacada: 96 } as const;
const ANILLO = { normal: 44, destacada: 56 } as const;

interface Props {
  fila: LecturaFila;
  /** La abierta con más frases tuyas del grupo: va primero y más grande. */
  destacada: boolean;
  /** Posición en el grupo, para la entrada escalonada. */
  indice: number;
  onPress: () => void;
}

/**
 * Una historia de la biblioteca. Arriba una portada con un degradado neutro y una marca por capítulo (si algún día hay
 * ilustración de Wero irá ahí; sin ella no se reserva nada más) y, en «Niños», un `Badge` neutro con ícono. Debajo el
 * título con el punto del mundo, el subtítulo y el anillo «Te sabes N de M frases» con una etiqueta de una palabra
 * (Fácil, Media, Difícil): el número de 0 a 100 solo lo oye el lector de pantalla. Una historia cerrada se ve, con lo
 * que falta para abrirla. Entra con el escalón de las listas.
 */
export const TarjetaLectura = memo(function TarjetaLectura({ fila, destacada, indice, onPress }: Props) {
  const reducido = useMovimientoReducido();
  const l = fila.lectura;
  const tamano = destacada ? 'destacada' : 'normal';
  const tinte = color.world[l.mundo as keyof typeof color.world] ?? color.world.dia_a_dia;
  const mundo = NOMBRE_MUNDO[l.mundo] ?? l.mundo;
  const retraso = escalon(indice);
  const bloqueo = `Se abre al dominar ${conteo(l.desbloquea?.dominadas ?? 0, 'frase')} de ${mundo}, te faltan ${fila.faltan}`;

  const etiqueta = [
    l.titulo,
    l.subtitulo,
    l.publico === 'ninos' ? 'Para niños' : null,
    `${conteo(l.palabras, 'palabra')}, ${conteo(l.capitulos.length, 'capítulo')}`,
    mundo,
    fila.abierta
      ? `Te sabes ${fila.dominadas} de ${conteo(fila.total, 'frase')}. Dificultad ${fila.dificultad} de 100, ${etiquetaDificultad(fila.dificultad)}`
      : `Cerrada. ${bloqueo}`,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    // La entrada va en un `Animated.View` aparte: `Presionable` anima su propio transform (la escala al presionar).
    <Animated.View entering={reducido ? undefined : aparecerSubiendo(retraso)}>
      <Presionable
        onPress={onPress}
        disabled={!fila.abierta}
        accessibilityRole="button"
        accessibilityLabel={etiqueta}
        accessibilityState={{ disabled: !fila.abierta }}
        style={[styles.tarjeta, !fila.abierta && styles.cerrada]}
      >
        <View style={[styles.portada, { height: PORTADA[tamano] }]}>
          {gradiente.neutro ? (
            <LinearGradient
              colors={[gradiente.neutro[0], gradiente.neutro[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={styles.marcas} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {l.capitulos.map((c) => (
              <View key={c.n} style={styles.marca} />
            ))}
          </View>
          {l.publico === 'ninos' ? (
            <View style={styles.insignia}>
              <Badge label="Niños" icono="smile" small />
            </View>
          ) : null}
        </View>

        <View style={styles.cuerpo}>
          <View style={styles.titulo}>
            <PuntoMundo tinte={tinte} mundo={l.mundo} />
            <Text style={[destacada ? text.h2 : text.h3, styles.tituloTexto]}>{l.titulo}</Text>
          </View>
          <Text style={destacada ? styles.subtituloGrande : styles.subtitulo}>{l.subtitulo}</Text>
          <Text style={styles.meta}>
            {conteo(l.palabras, 'palabra')} · {conteo(l.capitulos.length, 'capítulo')}
          </Text>

          {fila.abierta ? (
            <View style={styles.progreso}>
              <AnilloFrases dominadas={fila.dominadas} total={fila.total} lado={ANILLO[tamano]} retraso={retraso} />
              <Text style={styles.frasesTuyas}>{`Te sabes ${fila.dominadas} de ${conteo(fila.total, 'frase')}`}</Text>
              <LevelBadge nivel={nivelDificultad(fila.dificultad)} />
            </View>
          ) : (
            <View style={styles.bloqueo}>
              <Icon name="lock" size="sm" color={color.textMuted} />
              <Text style={styles.bloqueoTexto}>{bloqueo}</Text>
            </View>
          )}
        </View>
      </Presionable>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: 'hidden',
  },
  cerrada: { opacity: 0.6 },
  portada: { justifyContent: 'flex-end', padding: space.md },
  marcas: { flexDirection: 'row', gap: space.xs },
  marca: { width: 16, height: 4, borderRadius: radius.pill, backgroundColor: color.textMuted },
  insignia: { position: 'absolute', top: space.md, right: space.md },
  cuerpo: { gap: space.xs, padding: space.lg },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tituloTexto: { flexShrink: 1 },
  subtitulo: { fontFamily: font.family.body, fontSize: font.size.sm, lineHeight: font.size.sm * 1.45, color: color.textMuted },
  subtituloGrande: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  meta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  progreso: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.sm },
  frasesTuyas: { flex: 1, fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  bloqueo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  bloqueoTexto: { flex: 1, fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
});
