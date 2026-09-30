import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/base';
import { AnilloMeta } from '@/components/fx';
import { SectionTitle } from '@/components/list';
import type { Stats } from '@/data/repos/estadisticas';
import { etiquetaCorregir } from '@/screens/extras/practicar/consola';
import { anillo, color, font, space } from '@/theme';
import { conteo, plural } from '@/domain/texto';
import { CuadroDato } from './CuadroDato';
import { precisionPct } from './datos';

interface Props {
  stats: Stats;
  /** El anillo de la precisión se llena al pasar a true (la sección entró a la vista). */
  visto: boolean;
  onGuardadas: () => void;
  onAtoradas: () => void;
}

/**
 * «Detalle»: una cuadrícula 2×2 donde el número manda. La precisión va como anillo con el
 * número al centro (o «—» si todavía no hay nada practicado); con frases atoradas aparece
 * la única acción principal de la pantalla, con el mismo verbo que HOY.
 */
export function Detalle({ stats, visto, onGuardadas, onAtoradas }: Props) {
  const precision = precisionPct(stats.precision);
  const sinPractica = stats.vistas === 0;
  return (
    <>
      <SectionTitle title="Detalle" variante="bloque" />
      <View style={styles.cuadricula}>
        <View style={styles.par}>
          {sinPractica ? (
            <CuadroDato etiqueta="Precisión general" valor="—" accessibilityLabel="Precisión general: todavía sin datos" />
          ) : (
            <CuadroDato
              etiqueta="Precisión general"
              accessibilityLabel={`Precisión general: ${precision} %`}
              medidor={
                <AnilloMeta
                  valor={visto ? precision : 0}
                  total={100}
                  diametro={anillo.reto}
                  trazo={anillo.trazoReto}
                  etiqueta={`Precisión general: ${precision} %`}
                >
                  <Text style={styles.anilloNumero}>{precision}%</Text>
                </AnilloMeta>
              }
            />
          )}
          <CuadroDato
            etiqueta="Racha más larga"
            icono="fire"
            iconoColor={color.star}
            valor={String(stats.rachaMax)}
            unidad={plural(stats.rachaMax, 'día')}
            accessibilityLabel={`Racha más larga: ${conteo(stats.rachaMax, 'día')}`}
          />
        </View>
        <View style={styles.par}>
          <CuadroDato
            etiqueta="Guardadas con estrella"
            icono="star-filled"
            iconoColor={color.star}
            valor={String(stats.favoritas)}
            onPress={onGuardadas}
            accessibilityLabel={`Guardadas con estrella: ${stats.favoritas}`}
          />
          <CuadroDato
            etiqueta="Se te atoran"
            punto={color.wrong}
            valor={String(stats.atoradas)}
            onPress={onAtoradas}
            accessibilityLabel={`Se te atoran: ${stats.atoradas}`}
          />
        </View>
      </View>
      {stats.atoradas > 0 ? <Button label={etiquetaCorregir(stats.atoradas)} size="lg" full onPress={onAtoradas} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  cuadricula: { gap: space.md },
  par: { flexDirection: 'row', gap: space.md },
  anilloNumero: { fontFamily: font.family.display, fontSize: font.size.md, fontVariant: ['tabular-nums'], color: color.text },
});
