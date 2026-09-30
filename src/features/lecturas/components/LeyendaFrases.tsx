import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { IconButton } from '@/shared/ui';
import { aparecer, font, layout, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { ESTILO_FRASE_NUEVA, ESTILO_FRASE_VISTA } from './Oracion';

interface Props {
  /** Ya se mostró alguna vez: entonces arranca plegada. */
  vista: boolean;
  /** Avisa la primera vez que se muestra, para guardarlo en ajustes. */
  onVista: () => void;
}

/**
 * La leyenda de las frases subrayadas, una línea compacta bajo el título del capítulo con dos muestras: «ya la viste» y
 * «nueva», con el mismo estilo que tienen en el texto. La primera vez se muestra abierta y se guarda que ya se vio; las
 * siguientes arranca plegada y un botón de 48 dp la abre o la cierra. El texto del lector dice siempre si una frase es
 * nueva o ya se vio: la leyenda es para quien mira.
 */
export function LeyendaFrases({ vista, onVista }: Props) {
  const reducido = useMovimientoReducido();
  const [abierta, setAbierta] = useState(!vista);

  useEffect(() => {
    if (!vista) onVista();
  }, [vista, onVista]);

  return (
    <View style={styles.fila}>
      {abierta ? (
        <Animated.View
          entering={reducido ? undefined : aparecer()}
          style={styles.muestras}
          accessible
          accessibilityLabel="Las frases subrayadas se pueden tocar: ya la viste, o nueva. Toca una para abrir su ficha."
        >
          <Text style={styles.leyenda}>
            <Text style={ESTILO_FRASE_VISTA}>ya la viste</Text>
            {'   ·   '}
            <Text style={ESTILO_FRASE_NUEVA}>nueva</Text>
          </Text>
        </Animated.View>
      ) : (
        <View style={styles.muestras} />
      )}
      <IconButton
        icono="info"
        etiqueta={abierta ? 'Ocultar la leyenda de las frases' : 'Mostrar la leyenda de las frases'}
        tamano="sm"
        onPress={() => setAbierta((a) => !a)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md, minHeight: layout.tapMin, marginBottom: space.sm },
  muestras: { flex: 1 },
  leyenda: { fontFamily: font.family.body, fontSize: font.size.md },
});
