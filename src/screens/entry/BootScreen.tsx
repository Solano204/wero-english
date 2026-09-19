import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Screen, ProgressBar } from '@/components/base';
import { seedCatalog } from '@/db/seed';
import { getDb } from '@/db/client';
import { loadContent } from '@/store/content';
import { useAuthStore } from '@/store';
import * as audio from '@/services/audio';
import * as notifications from '@/services/notifications';
import { color, font, space } from '@/theme';

/**
 * Arranque. Hace el trabajo pesado una sola vez:
 * migraciones, sembrado del catálogo, modo de audio y canal de notificación.
 *
 * Se muestra una barra real, no un spinner indefinido: sembrar 1,524
 * entradas toma unos segundos en la primera instalación y sin progreso
 * el usuario cree que se colgó.
 */
export function BootScreen() {
  const restore = useAuthStore((s) => s.restore);
  const [step, setStep] = useState('Preparando');
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setStep('Abriendo la base');
        await getDb();

        const content = loadContent();

        if (content.catalog.entries.length === 0) {
          // Sin datos la app arranca igual: la pantalla de diagnóstico
          // dice qué falta. Es preferible a una pantalla negra.
          console.warn('[boot] catalogo.json vacío');
        } else {
          // seedCatalog decide si hace falta sembrar (conteo, audio
          // faltante o versión de catálogo); aquí solo se llama siempre.
          setStep('Instalando el catálogo');
          setTotal(content.catalog.entries.length);
          await seedCatalog(content.catalog, (p) => {
            if (alive) setDone(p.done);
          });
        }

        setStep('Preparando el sonido');
        await audio.initAudio();
        await notifications.setupChannel();

        setStep('Casi listo');
        await restore();
      } catch (err) {
        if (!alive) return;
        setError(
          err instanceof Error ? err.message : 'No se pudo iniciar la app.'
        );
      }
    })();

    return () => {
      alive = false;
    };
  }, [restore]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.wrap}>
        <Text style={styles.logo}>Wero</Text>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <>
            <Text style={styles.step}>{step}</Text>
            {total > 0 ? (
              <View style={styles.bar}>
                <ProgressBar value={done} total={total} />
                <Text style={styles.count}>
                  {done} de {total}
                </Text>
              </View>
            ) : (
              <ActivityIndicator color={color.accent} />
            )}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
  },
  logo: {
    fontSize: 44,
    fontWeight: font.weight.bold,
    color: color.accent,
    letterSpacing: -1,
  },
  step: { fontSize: font.size.md, color: color.textMuted },
  bar: { width: 220, gap: space.sm, alignItems: 'center' },
  count: { fontSize: font.size.xs, color: color.textFaint },
  error: {
    fontSize: font.size.md,
    color: color.riskStrong,
    textAlign: 'center',
    paddingHorizontal: space.xl,
  },
});
