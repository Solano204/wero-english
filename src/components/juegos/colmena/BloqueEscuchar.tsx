import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/base/Button';
import { OndaVoz, type VozEnVivo } from '@/components/fx';
import { space } from '@/theme';
import { plural } from '@/utils/text';

const ANCHO_ONDA = 88;
const ALTO_ONDA = 32;
/** La onda se apaga sin escuchas. */
const OPACIDAD_APAGADA = 0.35;

interface Props {
  /** Las escuchas que quedan en la ronda. */
  escuchas: number;
  /** Suena la frase ahora mismo: el botón espera y la onda se enciende. */
  sonando: boolean;
  voz: VozEnVivo;
  /** La energía de la voz (`analizar().envolvente`). */
  envolvente: number[];
  onEscuchar: () => void;
}

/**
 * «Escuchar · quedan 2» con la onda de la voz al lado. La onda sube mientras suena la frase y se aplana al
 * terminar; sin escuchas el botón dice «Sin escuchas» y la onda se apaga. La cuenta de escuchas y el audio los
 * lleva la pantalla: aquí solo se ve.
 */
export function BloqueEscuchar({ escuchas, sonando, voz, envolvente, onEscuchar }: Props) {
  const sinEscuchas = escuchas <= 0;
  const etiqueta = sinEscuchas ? 'Sin escuchas' : `Escuchar · ${plural(escuchas, 'queda', 'quedan')} ${escuchas}`;
  return (
    <View style={styles.fila}>
      <Button icon="volume" label={etiqueta} variant="secondary" onPress={onEscuchar} disabled={sinEscuchas || sonando} />
      <View
        style={[styles.onda, sinEscuchas && styles.apagada]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <OndaVoz voz={voz} envolvente={envolvente} alto={ALTO_ONDA} tono={sinEscuchas ? 'neutro' : 'senal'} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  onda: { width: ANCHO_ONDA, height: ALTO_ONDA },
  apagada: { opacity: OPACIDAD_APAGADA },
});
