import React from 'react';
import { conteo } from '@/domain/texto';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Header, ProgressBar, Screen } from '@/shared/ui';
import { ANUNCIOS_ACTIVOS } from '@/config/monetizacion';
import { color, font, space } from '@/theme';
import { todoIncluido, useDescargas } from '@/features/ajustes/hooks/useDescargas';

/**
 * P-15, administrar descargas.
 *
 * Todos los packs son gratis. Lo único que se administra aquí es cuánto
 * espacio ocupan en el teléfono, no si se pagan.
 */
export function DownloadsScreen() {
  const { nav, progress, errors, cancelar, hoja, descargar, packs } = useDescargas();
  const incluido = todoIncluido();

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title="Descargas"
        subtitle="Audio e imágenes de cada pack"
      />

      <Text style={styles.intro}>
        {incluido
          ? 'Todo el audio y todas las imágenes ya vienen incluidos en la app. No hay nada que descargar: funciona sin internet.'
          : 'Todos los packs son gratis. Lo único que decides aquí es cuáles guardas en el teléfono para usarlos sin internet.'}
      </Text>

      <View style={styles.list}>
        {packs.map((p) => {
          const prog = progress[p.id];
          const err = errors[p.id];
          const bajando = Boolean(prog);

          return (
            <Card key={p.id} style={styles.item}>
              <View style={styles.head}>
                <View style={styles.headText}>
                  <Text style={styles.name}>{p.nombre}</Text>
                  <Text style={styles.meta}>
                    {conteo(p.total_entradas, 'frase')} · {p.peso_mb} MB
                  </Text>
                </View>
                {p.empaquetado ? (
                  <Text style={styles.included}>Ya incluido</Text>
                ) : bajando ? (
                  <Button
                    label="Cancelar"
                    variant="ghost"
                    onPress={() => cancelar(p.id)}
                  />
                ) : (
                  <Button
                    label={ANUNCIOS_ACTIVOS ? 'Ver anuncio y descargar' : 'Descargar'}
                    variant="secondary"
                    onPress={() => void descargar(p.id)}
                  />
                )}
              </View>

              {prog ? (
                <View style={styles.progress}>
                  <ProgressBar value={prog.done} total={prog.total} height={4} />
                  <Text style={styles.progressText}>
                    {prog.done} de {prog.total} archivos
                  </Text>
                </View>
              ) : null}

              {err ? <Text style={styles.error}>{err}</Text> : null}
            </Card>
          );
        })}
      </View>
      {hoja}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.6,
    marginBottom: space.lg,
  },
  list: { gap: space.sm },
  item: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1 },
  name: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  meta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  included: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.correct },
  progress: { gap: space.xs },
  progressText: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  error: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.wrong },
});
