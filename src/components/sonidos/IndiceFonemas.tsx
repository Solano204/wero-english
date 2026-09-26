import React, { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Header } from '@/components/base/Header';
import { Presionable } from '@/components/base/Presionable';
import type { Rect } from '@/components/fx';
import { sinBarras } from '@/domain/vocales';
import { color, font, layout, radius, space } from '@/theme';
import { conteo } from '@/utils/text';
import type { Fonema } from '@/types';

const COLUMNAS = 4;
const ALTO_CHIP = 56;
const PUNTO = 8;
/** El tamaño del símbolo en el chip: el viaje hacia la página parte de aquí. */
export const SIMBOLO_CHIP = font.size.xl;

type Grupo = 'Vocales' | 'Diptongos' | 'Consonantes';
const GRUPOS: readonly Grupo[] = ['Vocales', 'Diptongos', 'Consonantes'];

function grupoDe(f: Fonema): Grupo {
  if (f.tipo === 'vocal_simple') return 'Vocales';
  if (f.tipo === 'diptongo') return 'Diptongos';
  return 'Consonantes';
}

interface ChipProps {
  fonema: Fonema;
  ancho: number;
  onAbrir: (rect: Rect) => void;
}

function ChipFonema({ fonema, ancho, onAbrir }: ChipProps) {
  const caja = useRef<View>(null);
  const alTocar = () => caja.current?.measureInWindow((x, y, width, height) => onAbrir({ x, y, width, height }));
  return (
    <Presionable
      onPress={alTocar}
      accessibilityRole="button"
      accessibilityLabel={`${fonema.nombre}. ${fonema.existe_en_espanol ? 'También existe en español' : 'No existe en español'}`}
      style={{ width: ancho }}
    >
      <View ref={caja} collapsable={false} style={styles.chip}>
        <Text style={styles.simbolo}>{sinBarras(fonema.ipa)}</Text>
        {fonema.existe_en_espanol ? null : <View style={styles.punto} />}
      </View>
    </Presionable>
  );
}

interface Props {
  fonemas: Fonema[];
  /** Abre la página de ese fonema (su lugar en `fonemas`); `rect` es donde estaba su chip en la ventana. */
  onAbrir: (indice: number, rect: Rect) => void;
  onAtras: () => void;
}

/**
 * El índice del laboratorio: una cuadrícula de chips con el símbolo IPA en Charis SIL, agrupados en vocales,
 * diptongos y consonantes. Un punto marca los sonidos que no existen en español. Tocar un chip abre ese fonema.
 */
export function IndiceFonemas({ fonemas, onAbrir, onAtras }: Props) {
  const { width } = useWindowDimensions();
  const ancho = Math.floor((width - layout.screenPad * 2 - space.sm * (COLUMNAS - 1)) / COLUMNAS);
  const indexados = fonemas.map((f, i) => ({ f, i }));

  return (
    <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
      <Header onBack={onAtras} title="Los sonidos del inglés" subtitle={conteo(fonemas.length, 'sonido')} />
      <View style={styles.leyenda} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.punto2} />
        <Text style={styles.leyendaTexto}>No existe en español</Text>
      </View>

      {GRUPOS.map((grupo) => {
        const items = indexados.filter(({ f }) => grupoDe(f) === grupo);
        if (items.length === 0) return null;
        return (
          <View key={grupo} style={styles.grupo}>
            <View style={styles.titulo}>
              <Text style={styles.tituloTexto} accessibilityRole="header">
                {grupo}
              </Text>
              <Text style={styles.cuenta}>{items.length}</Text>
            </View>
            <View style={styles.rejilla}>
              {items.map(({ f, i }) => (
                <ChipFonema key={f.id} fonema={f} ancho={ancho} onAbrir={(rect) => onAbrir(i, rect)} />
              ))}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: layout.screenPad, paddingBottom: space.xxxl, gap: space.lg },
  leyenda: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  leyendaTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  punto2: { width: PUNTO, height: PUNTO, borderRadius: PUNTO / 2, backgroundColor: color.accent },
  grupo: { gap: space.md },
  titulo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  tituloTexto: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text },
  cuenta: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    height: ALTO_CHIP,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  simbolo: { fontFamily: font.family.ipa, fontSize: SIMBOLO_CHIP, color: color.text },
  punto: {
    position: 'absolute',
    top: space.sm,
    right: space.sm,
    width: PUNTO,
    height: PUNTO,
    borderRadius: PUNTO / 2,
    backgroundColor: color.accent,
  },
});
