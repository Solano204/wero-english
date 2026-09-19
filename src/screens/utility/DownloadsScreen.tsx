import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Button,
  Card,
  Header,
  ProgressBar,
  Screen,
  pedirRecompensa,
  razonMuro,
} from '@/components/base';
import { useAuthStore } from '@/store';
import { loadContent } from '@/store/content';
import * as downloads from '@/services/downloads';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-15, administrar descargas.
 *
 * Todos los packs son gratis. Lo único que se administra aquí es cuánto
 * espacio ocupan en el teléfono, no si se pagan.
 */
export function DownloadsScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const content = useMemo(loadContent, []);

  const [progress, setProgress] = useState<
    Record<string, downloads.DownloadProgress>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const cancel = useRef<Record<string, boolean>>({});

  const descargar = useCallback(
    async (packId: string) => {
      if (!user) return;
      const pack = content.packs.packs.find((p) => p.id === packId);
      if (!pack) return;

      /*
       * Antes de bajar el pack va un anuncio.
       *
       * Este es el único muro de la app y va aquí a propósito: es el
       * momento en que el usuario ya decidió que quiere ese contenido,
       * así que ver el video es un trato, no un peaje sorpresa.
       *
       * Si no hay proveedor conectado, `pedirRecompensa` devuelve
       * 'sin_anuncio' y la descarga procede. Bloquear contenido por un
       * anuncio que no existe es peor que no monetizar.
       *
       * Si el usuario cierra el video antes de tiempo, se cancela la
       * descarga sin regaño y puede volver a intentar.
       */
      setErrors((e) => ({ ...e, [packId]: '' }));
      const trato = await pedirRecompensa();
      if (trato !== 'visto') {
        // Sin anuncio no hay pack. Es el único muro de la app y es
        // duro a propósito: si se concediera igual, el anuncio dejaría
        // de ser un trato y sería un botón que a veces sale.
        setErrors((e) => ({ ...e, [packId]: razonMuro(trato) }));
        return;
      }

      cancel.current[packId] = false;

      const res = await downloads.downloadPack(
        user.id,
        pack,
        (p) => setProgress((s) => ({ ...s, [packId]: p })),
        () => !cancel.current[packId]
      );

      if (res.kind === 'error') {
        setErrors((e) => ({ ...e, [packId]: res.message }));
      }
      setProgress((s) => {
        const next = { ...s };
        delete next[packId];
        return next;
      });
    },
    [user, content]
  );

  const packs = [...content.packs.packs].sort(
    (a, b) => a.orden - b.orden || a.mundo.localeCompare(b.mundo)
  );

  return (
    <Screen scroll>
      <Header
        onBack={() => nav.goBack()}
        title="Descargas"
        subtitle="Audio e imágenes de cada pack"
      />

      <Text style={styles.intro}>
        Todos los packs son gratis. Lo único que decides aquí es cuáles
        guardas en el teléfono para usarlos sin internet.
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
                    {p.total_entradas} frases · {p.peso_mb} MB
                  </Text>
                </View>
                {p.empaquetado ? (
                  <Text style={styles.included}>Ya incluido</Text>
                ) : bajando ? (
                  <Button
                    label="Cancelar"
                    variant="ghost"
                    onPress={() => {
                      cancel.current[p.id] = true;
                    }}
                  />
                ) : (
                  <Button
                    label="Ver anuncio y descargar"
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
  error: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.riskStrong },
});
