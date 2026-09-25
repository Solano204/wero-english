import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ALTO_ENCABEZADO,
  Card,
  Carga,
  EncabezadoComprimido,
  Screen,
  SkeletonLista,
} from '@/components/base';
import { SectionTitle } from '@/components/list';
import { PanelSenal } from '@/components/progreso/PanelSenal';
import { Espectrograma } from '@/components/fx';
import { useVisto } from '@/components/fx/useVisibilidad';
import { ventana } from '@/components/progreso/datos';
import { getStats, type Stats } from '@/db/queries';
import { getRecentDays } from '@/db/progress';
import { useCarga } from '@/hooks/useCarga';
import { useEntradaPantalla } from '@/hooks/useEntradaPantalla';
import { useAuthStore } from '@/store';
import { color, font, motionEntrada, space } from '@/theme';
import { dayKey } from '@/utils/date';
import { conteo } from '@/utils/text';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

interface Datos {
  stats: Stats | null;
  dias: { dia: string; respuestas: number; aciertos: number }[];
}

const SIN_DATOS: Datos = { stats: null, dias: [] };

/**
 * P-13, el progreso. Señal en vivo: el medidor de dominadas es el único momento
 * héroe; el resto responde al scroll y a los toques.
 */
export function ProgressScreen() {
  const nav = useNavigation<Nav>();
  const { top } = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const scrollY = useSharedValue(0);
  const { primera, estiloFundido } = useEntradaPantalla('progreso');
  const [pulsos, setPulsos] = useState(0);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      const [stats, dias] = await Promise.all([getStats(user.id), getRecentDays(user.id, 21)]);
      return { stats, dias };
    },
    [user],
    { alEnfocar: true }
  );

  // Jalar para refrescar: recarga sin esqueleto y la aguja da un empujón al terminar.
  const refrescar = useCallback(async () => {
    await carga.refrescar();
    setPulsos((n) => n + 1);
  }, [carga.refrescar]);

  const registrados = carga.datos?.dias ?? [];
  const dias = useMemo(() => ventana(registrados, dayKey()), [registrados]);
  // Sin días registrados, o ninguno dentro de las últimas tres semanas: nada de gráfica en ceros.
  const sinDias = registrados.length === 0 || dias.every((d) => d.respuestas === 0);
  const espectro = useVisto(scrollY);

  return (
    <Screen
      scroll
      edges={['bottom']}
      scrollY={scrollY}
      encabezado={<EncabezadoComprimido titulo="Tu progreso" scrollY={scrollY} entrada={primera} />}
      style={{ paddingTop: top + ALTO_ENCABEZADO }}
      alRefrescar={refrescar}
      desfaseRefresco={top + ALTO_ENCABEZADO}
    >
      <Animated.View style={[styles.bloques, estiloFundido]}>
        <Carga carga={carga} esqueleto={<SkeletonLista filas={3} alto={110} />}>
          {({ stats }) => (
            <>
              {stats ? (
                <PanelSenal stats={stats} usuarioId={user?.id ?? null} entrada={primera} scrollY={scrollY} pulsos={pulsos} />
              ) : null}

              <Animated.View ref={espectro.ref} collapsable={false} onLayout={espectro.alAcomodar} style={styles.bloque}>
                <SectionTitle title="Últimas tres semanas" variante="bloque" />
                <Card>
                  {sinDias ? (
                    <Text style={styles.noData}>Todavía no hay días registrados.</Text>
                  ) : (
                    <Espectrograma dias={dias} activo={espectro.visto} retraso={primera ? motionEntrada.espectro : 0} />
                  )}
                </Card>
              </Animated.View>

              <View style={styles.bloque}>
                <SectionTitle title="Detalle" variante="bloque" />
                <View style={styles.rows}>
                  <Row label="Precisión general" value={`${Math.round((stats?.precision ?? 0) * 100)}%`} />
                  <Row label="Racha más larga" value={conteo(stats?.rachaMax ?? 0, 'día')} />
                  <Row label="Guardadas con estrella" value={String(stats?.favoritas ?? 0)} onPress={() => nav.navigate('Deck')} />
                  <Row label="Se te atoran" value={String(stats?.atoradas ?? 0)} onPress={() => nav.navigate('Stuck')} />
                </View>
              </View>
            </>
          )}
        </Carga>
      </Animated.View>
    </Screen>
  );
}

function Row({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <Card onPress={onPress} style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Entre bloques 32; dentro de un bloque 16 (ESP-2).
  bloques: { gap: space.xxl },
  bloque: { gap: space.lg },
  noData: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.sm },
  rows: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  rowLabel: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  rowValue: { fontSize: font.size.md, color: color.textMuted, fontFamily: font.family.bodyStrong },
});
