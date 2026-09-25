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
import { FichaJuego, FilaMundo, PanelSenal } from '@/components/progreso';
import { Espectrograma } from '@/components/fx';
import { useVisto } from '@/components/fx/useVisibilidad';
import {
  JUEGOS_PROGRESO,
  filasMundo,
  resumenJuego,
  ventana,
  type ProgresoMundo,
} from '@/components/progreso/datos';
import { getGameRecords } from '@/db/economy';
import { resumenTodos } from '@/db/levels';
import { getProgresoPorMundo, getStats, type Stats } from '@/db/queries';
import { getRecentDays } from '@/db/progress';
import { ICONO_MODO } from '@/screens/extras/practicar/iconos';
import { MODOS } from '@/screens/extras/practicar/modos';
import type { Niveles } from '@/screens/extras/practicar/resumenNiveles';
import type { JuegoRecord } from '@/types';
import { useCarga } from '@/hooks/useCarga';
import { useEntradaPantalla } from '@/hooks/useEntradaPantalla';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { color, font, motionEntrada, radius, space, type WorldId } from '@/theme';
import { dayKey } from '@/utils/date';
import { conteo } from '@/utils/text';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

interface Datos {
  stats: Stats | null;
  dias: { dia: string; respuestas: number; aciertos: number }[];
  mundos: Record<string, ProgresoMundo>;
  niveles: Record<string, Niveles>;
  records: Record<string, JuegoRecord>;
}

const SIN_DATOS: Datos = { stats: null, dias: [], mundos: {}, niveles: {}, records: {} };

/** Las fichas de «Por juego», de dos en dos. */
const FILAS_JUEGOS = [JUEGOS_PROGRESO.slice(0, 2), JUEGOS_PROGRESO.slice(2, 4), JUEGOS_PROGRESO.slice(4)];

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
  const filter = useSettingsStore((s) => s.filter);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      const [stats, dias, mundos, niveles, records] = await Promise.all([
        getStats(user.id),
        getRecentDays(user.id, 21),
        getProgresoPorMundo(user.id, filter()),
        resumenTodos(user.id),
        getGameRecords(user.id),
      ]);
      return { stats, dias, mundos, niveles, records };
    },
    [user, filter],
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
  const seccionMundos = useVisto(scrollY);
  const seccionJuegos = useVisto(scrollY);

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
          {({ stats, mundos, niveles, records }) => (
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

              <Animated.View ref={seccionMundos.ref} collapsable={false} onLayout={seccionMundos.alAcomodar} style={styles.bloque}>
                <SectionTitle title="Por mundo" variante="bloque" />
                <View style={styles.grupo}>
                  {filasMundo(loadContent().packs.mundos, mundos).map((m, i) => (
                    <FilaMundo
                      key={m.id}
                      nombre={m.nombre}
                      tinte={color.world[m.id as WorldId] ?? color.accent}
                      dominadas={m.dominadas}
                      total={m.total}
                      fraccion={m.fraccion}
                      primera={i === 0}
                      indice={i}
                      activo={seccionMundos.visto}
                      onPress={() => nav.navigate('WorldDetail', { worldId: m.id })}
                    />
                  ))}
                </View>
              </Animated.View>

              <Animated.View ref={seccionJuegos.ref} collapsable={false} onLayout={seccionJuegos.alAcomodar} style={styles.bloque}>
                <SectionTitle title="Por juego" variante="bloque" />
                <View style={styles.cuadricula}>
                  {FILAS_JUEGOS.map((par, r) => (
                    <View key={r} style={styles.parFichas}>
                      {par.map((id, c) => (
                        <FichaJuego
                          key={id}
                          nombre={MODOS[id].titulo}
                          icono={ICONO_MODO[id]}
                          resumen={resumenJuego(id, niveles, records)}
                          conNiveles={id !== 'cazala'}
                          indice={r * 2 + c}
                          activo={seccionJuegos.visto}
                          onPress={() => (id === 'cazala' ? nav.navigate('Cazala') : nav.navigate('Niveles', { juego: id }))}
                        />
                      ))}
                      {par.length === 1 ? <View style={styles.hueco} /> : null}
                    </View>
                  ))}
                </View>
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
  cuadricula: { gap: space.md },
  parFichas: { flexDirection: 'row', gap: space.md },
  hueco: { flex: 1 },
  grupo: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    overflow: 'hidden',
  },
  rows: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: space.md },
  rowLabel: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  rowValue: { fontSize: font.size.md, color: color.textMuted, fontFamily: font.family.bodyStrong },
});
