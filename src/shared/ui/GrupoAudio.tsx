import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Icon, Presionable, type IconName } from '@/shared/ui';
import { color, font, layout, radius, space } from '@/theme';
import { hayAudio } from './AudioButton';

export interface ControlAudio {
  clave: string;
  etiqueta: string;
  /** Lo que dice el lector de pantalla («Escuchar en inglés»). */
  descripcion: string;
  icono: IconName;
  ruta: string;
  lento: boolean;
  /** Este audio está sonando ahora: su segmento se enciende. */
  suena: boolean;
}

interface Props {
  controles: ControlAudio[];
  alSonar: (ruta: string, lento: boolean) => void;
  /** `centro` pone el grupo en medio de una columna centrada (la carta de Frases sueltas); por omisión va a la izquierda. */
  alinear?: 'inicio' | 'centro';
}

/**
 * Los botones de audio de una frase como un grupo segmentado compacto (Escuchar · Lento, o Inglés · Lento · Español):
 * una píldora con segmentos del mismo alto de 48 dp, separados por una línea fina. El que suena se enciende con
 * `accentSoft`; uno sin archivo se ve apagado y no se toca. `alSonar` corre al tocar, y quien lo usa reproduce.
 */
export function GrupoAudio({ controles, alSonar, alinear = 'inicio' }: Props) {
  return (
    <View style={[styles.grupo, alinear === 'centro' && styles.centro]}>
      {controles.map((c, i) => {
        const sinAudio = !hayAudio(c.ruta);
        return (
          <Presionable
            key={c.clave}
            onPress={() => alSonar(c.ruta, c.lento)}
            disabled={sinAudio}
            accessibilityRole="button"
            accessibilityLabel={c.descripcion}
            accessibilityState={{ disabled: sinAudio, selected: c.suena }}
            style={[styles.control, c.suena && styles.controlSuena, sinAudio && styles.sinAudio]}
          >
            {i === 0 ? null : <View style={styles.division} />}
            <Icon name={c.icono} size="sm" color={sinAudio ? color.textFaint : color.accent} />
            <Text style={styles.etiqueta}>{c.etiqueta}</Text>
          </Presionable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grupo: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    overflow: 'hidden',
  },
  centro: { alignSelf: 'center' },
  control: {
    minHeight: layout.tapMin,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
  },
  controlSuena: { backgroundColor: color.accentSoft },
  sinAudio: { opacity: 0.4 },
  division: { position: 'absolute', left: 0, top: space.sm, bottom: space.sm, width: 1, backgroundColor: color.border },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.accent },
});
