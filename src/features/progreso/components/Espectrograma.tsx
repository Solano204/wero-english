import React, { useState } from 'react';
import { View } from 'react-native';
import { FxSeguro } from '@/shared/ui/fx/FxSeguro';
import { Grafica, type Props } from './GraficaEspectrograma';

/**
 * Espectrograma de las últimas tres semanas: 21 columnas en tres bloques, cada una con
 * los aciertos en `accent` y el resto de las respuestas en `accentSoft`. La altura sale
 * de la raíz cuadrada (un día muy alto no aplasta a los demás) y el máximo va como
 * referencia en una línea punteada. Los días sin práctica son un punto. Al entrar las
 * columnas suben de izquierda a derecha como un ecualizador; al deslizar el dedo sale
 * «Mar 15 · 42 respuestas · 30 aciertos» con un háptico por columna.
 */
export function Espectrograma({ dias, activo, retraso = 0 }: Props) {
  const [ancho, setAncho] = useState(0);
  return (
    <View onLayout={(e) => setAncho(e.nativeEvent.layout.width)}>
      {ancho > 0 ? (
        <FxSeguro>
          <Grafica dias={dias} ancho={ancho} activo={activo} retraso={retraso} />
        </FxSeguro>
      ) : null}
    </View>
  );
}
