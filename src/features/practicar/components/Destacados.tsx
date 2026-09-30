import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { type SharedValue } from 'react-native-reanimated';
import { Presionable, ProgressBar } from '@/shared/ui';
import { PortadaJuego } from '@/features/practicar/components/PortadaJuego';
import { TarjetaTilt } from '@/features/practicar/components/TarjetaTilt';
import { useVisibilidad } from '@/shared/hooks/useVisibilidad';
import {
  aparecerSubiendo,
  color,
  escalon,
  filoLuz,
  font,
  layout,
  motionDuration,
  motionEntrada,
  radius,
  shadow,
  sol,
  space,
  tarjeta,
} from '@/theme';
import { TOTAL_NIVELES, resumenNivel, type Niveles } from '@/domain/resumenNiveles';
import type { ModoId } from '@/features/practicar/logic/hoy';
import { ICONO_MODO } from '@/features/practicar/logic/iconos';
import { MODOS } from '@/features/practicar/logic/modos';

interface Props {
  /** El más usado primero: va de héroe. */
  ids: ModoId[];
  niveles: Record<string, Niveles>;
  datoDe: (id: ModoId) => string | null;
  scrollY: SharedValue<number>;
  /** Primera vez por sesión: entran escalonados y los bucles esperan a que termine la coreografía. */
  entrada: boolean;
  onIr: (id: ModoId) => void;
}

interface TarjetaProps {
  id: ModoId;
  heroe: boolean;
  indice: number;
  ancho: number;
  resumenNiveles: Niveles | undefined;
  dato: string | null;
  scrollY: SharedValue<number>;
  entrada: boolean;
  ambiente: boolean;
  onPress: () => void;
}

function TarjetaJuego({ id, heroe, indice, ancho, resumenNiveles, dato, scrollY, entrada, ambiente, onPress }: TarjetaProps) {
  const modo = MODOS[id];
  const { ref, visible, desfase, alAcomodar } = useVisibilidad(scrollY);
  const resumen = resumenNivel(resumenNiveles);
  const linea = resumen?.texto ?? dato ?? modo.cuerpo;

  return (
    <Animated.View
      ref={ref}
      collapsable={false}
      onLayout={alAcomodar}
      entering={entrada ? aparecerSubiendo(motionEntrada.destacados + escalon(indice)) : undefined}
      style={heroe ? styles.heroe : styles.compacta}
    >
      <TarjetaTilt style={styles.llena}>
        <Presionable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${modo.titulo}. ${linea}`}
          style={styles.llena}
        >
          <LinearGradient
            colors={filoLuz}
            start={sol.start}
            end={sol.end}
            style={[styles.filo, { minHeight: heroe ? tarjeta.heroe : tarjeta.compacta }]}
          >
            <View style={styles.cuerpo}>
              <PortadaJuego
                modo={id}
                icono={ICONO_MODO[id]}
                ancho={ancho - 2}
                alto={heroe ? tarjeta.portadaHeroe : tarjeta.portadaCompacta}
                bucle={heroe}
                ambiente={ambiente}
                visible={visible}
                desfase={desfase}
              />
              <View style={styles.texto}>
                <Text style={styles.titulo} numberOfLines={2}>
                  {modo.titulo}
                </Text>
                <Text style={styles.linea} numberOfLines={2}>
                  {linea}
                </Text>
                {resumen ? <ProgressBar value={resumen.nivel} total={TOTAL_NIVELES} height={4} /> : null}
              </View>
            </View>
          </LinearGradient>
        </Presionable>
      </TarjetaTilt>
    </Animated.View>
  );
}

/**
 * Destacados asimétricos (IA-2): el más usado va en una tarjeta héroe a todo el
 * ancho y los otros dos en dos columnas más bajas. Cada portada es una escena de
 * Skia (Pares, Caída, Dulces) o el ícono del modo; solo la héroe hace bucle.
 */
export function Destacados({ ids, niveles, datoDe, scrollY, entrada, onIr }: Props) {
  const { width } = useWindowDimensions();
  const [ambiente, setAmbiente] = useState(!entrada);

  useEffect(() => {
    if (!entrada) return;
    const espera = setTimeout(() => setAmbiente(true), motionDuration.coreografia);
    return () => clearTimeout(espera);
  }, [entrada]);

  const contenido = width - layout.screenPad * 2;
  const anchoCompacta = (contenido - space.md) / 2;
  const [heroe, ...resto] = ids;

  return (
    <View style={styles.bloque}>
      {heroe ? (
        <TarjetaJuego
          id={heroe}
          heroe
          indice={0}
          ancho={contenido}
          resumenNiveles={niveles[heroe]}
          dato={datoDe(heroe)}
          scrollY={scrollY}
          entrada={entrada}
          ambiente={ambiente}
          onPress={() => onIr(heroe)}
        />
      ) : null}
      <View style={styles.fila}>
        {resto.map((id, i) => (
          <TarjetaJuego
            key={id}
            id={id}
            heroe={false}
            indice={i + 1}
            ancho={anchoCompacta}
            resumenNiveles={niveles[id]}
            dato={datoDe(id)}
            scrollY={scrollY}
            entrada={entrada}
            ambiente={ambiente}
            onPress={() => onIr(id)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bloque: { gap: space.md },
  fila: { flexDirection: 'row', gap: space.md, alignItems: 'stretch' },
  heroe: { alignSelf: 'stretch' },
  compacta: { flex: 1 },
  llena: { flex: 1 },
  filo: { flex: 1, borderRadius: radius.lg, padding: 1, ...shadow.card },
  cuerpo: { flex: 1, borderRadius: radius.lg - 1, backgroundColor: color.surface, overflow: 'hidden' },
  texto: { padding: space.md, gap: space.xs },
  titulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  linea: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.45,
    color: color.textMuted,
  },
});
