import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ErrorCarga, Screen } from '@/components/base';
import { SectionTitle } from '@/components/list';
import { FondoAurora } from '@/components/fx';
import { getGameRecords, getHablaResumen, getRetoSemanal, getUsoModos } from '@/db/economy';
import { resumenTodos } from '@/db/levels';
import { getRecentDays } from '@/db/progress';
import { countDue, getStats } from '@/db/queries';
import { filtroEstudio } from '@/domain/cola';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { motionDuration, motionEasing, space, tarjeta } from '@/theme';
import { conteo, useMovimientoReducido } from '@/utils';
import { dayKey } from '@/utils/date';
import type { JuegoRecord, RetoSemanal } from '@/types';
import type { RootStackParams } from '@/navigation/routes';
import { ConsolaHoy } from './practicar/ConsolaHoy';
import { etiquetaCorregir } from './practicar/consola';
import { Destacados } from './practicar/Destacados';
import { EncabezadoPracticar, ALTO_ENCABEZADO } from './practicar/EncabezadoPracticar';
import { tomarEntrada } from './practicar/entrada';
import { FilaModo } from './practicar/FilaModo';
import { GrupoPlegable } from './practicar/GrupoPlegable';
import { ICONO_GRUPO, ICONO_MODO } from './practicar/iconos';
import { metaDe, textoMeta, type FuentesMeta } from './practicar/metadatos';
import { RetoSemana } from './practicar/RetoSemana';
import { ORDEN, elegirDestacados, elegirHoy, type ModoId, type MotivoHoy, type Uso } from './practicar/hoy';
import { GRUPOS, MODOS } from './practicar/modos';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Resumen = Awaited<ReturnType<typeof getStats>>;

interface Datos {
  records: Record<string, JuegoRecord>;
  reto: RetoSemanal | null;
  habla: { intentos: number; dominados: number };
  niveles: Record<string, { jugados: number; estrellas: number; siguiente: number }>;
  stats: Resumen | null;
  uso: Uso;
  hoyFrases: number;
  vencidas: number;
}

const SIN_DATOS: Datos = {
  records: {},
  reto: null,
  habla: { intentos: 0, dominados: 0 },
  niveles: {},
  stats: null,
  uso: {},
  hoyFrases: 0,
  vencidas: 0,
};

/** El botón de HOY dice qué va a pasar al tocarlo. */
function etiquetaHoy(
  motivo: MotivoHoy,
  modo: ModoId,
  atoradas: number,
  vencidas: number,
  meta: number
): string {
  if (motivo === 'vencidas') {
    // El botón lleva lo que cabe en una sesión; el total pendiente va aparte.
    const n = Math.min(vencidas, meta);
    return `Repasar ${conteo(n, 'frase')}`;
  }
  if (motivo === 'ultimo' && modo === 'study') return 'Seguir estudiando';
  if (motivo === 'atoradas') return etiquetaCorregir(atoradas);
  if (motivo === 'ultimo') return `Seguir con ${MODOS[modo].titulo}`;
  return 'Empezar';
}

/**
 * Practicar: una sola cosa destacada (HOY), tres modos a mano y el resto
 * en grupos plegados. Ningún modo se quitó: solo cambió la jerarquía.
 *
 * HOY sale de lo que la app ya guarda (ver `elegirHoy`): frases atoradas,
 * el último modo usado o, sin historial, Estudiar.
 */
export function PracticeScreen() {
  const nav = useNavigation<Nav>();
  const { top } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const [primeraEntrada] = useState(tomarEntrada);
  const reducido = useMovimientoReducido();
  const fundido = useSharedValue(1);
  const yaEnfoco = useRef(false);

  // Primera vez: coreografía. Las visitas siguientes de la sesión solo hacen un fundido.
  useFocusEffect(
    useCallback(() => {
      if (yaEnfoco.current && !reducido) {
        fundido.value = 0;
        fundido.value = withTiming(1, { duration: motionDuration.rapido, easing: motionEasing.entrar });
      }
      yaEnfoco.current = true;
    }, [fundido, reducido])
  );
  const estiloFundido = useAnimatedStyle(() => ({ opacity: fundido.value }));
  const user = useAuthStore((s) => s.user);
  const abiertos = useSettingsStore((s) => s.practicarGruposAbiertos);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const filter = useSettingsStore((s) => s.filter);
  const metaDiaria = useSettingsStore((s) => s.metaDiaria);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      const [records, reto, habla, niveles, stats, uso, dias, vencidas] = await Promise.all([
        getGameRecords(user.id),
        getRetoSemanal(user.id),
        getHablaResumen(user.id),
        resumenTodos(user.id),
        getStats(user.id),
        getUsoModos(user.id),
        getRecentDays(user.id, 1),
        countDue(user.id, filtroEstudio(filter())),
      ]);
      const hoyFrases = dias[0]?.dia === dayKey() ? dias[0].respuestas : 0;
      return { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas };
    },
    [user, filter],
    { alEnfocar: true }
  );
  // Hasta que carga, HOY se maqueta pero no se ve ni se toca: si no, pintaría
  // el caso "usuario nuevo" un instante y luego saltaría a otro.
  const listo = carga.estado === 'listo';

  // Jalar para refrescar: recarga sin esqueleto y la onda de HOY da un pulso al terminar.
  const [refrescos, setRefrescos] = useState(0);
  const refrescar = useCallback(async () => {
    await carga.refrescar();
    setRefrescos((n) => n + 1);
  }, [carga.refrescar]);
  const { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas } = carga.datos ?? SIN_DATOS;

  const atoradas = stats?.atoradas ?? 0;
  const racha = stats?.racha ?? 0;
  const hoy = elegirHoy(vencidas, atoradas, uso);
  const destacados = elegirDestacados(uso, hoy.modo);
  const modoHoy = MODOS[hoy.modo];

  const fuentesMeta: FuentesMeta = {
    niveles,
    records,
    paresLimpios: habla.dominados,
    atoradas,
    guardadas: stats?.favoritas ?? 0,
    frasesPhrasal: loadContent().phrasal.verbos.length,
  };
  /** El dato de un modo como línea de texto (la de una tarjeta destacada sin niveles). */
  const datoDe = (id: ModoId): string | null => textoMeta(metaDe(id, fuentesMeta));

  const alternar = (grupo: string) => {
    if (!user) return;
    const siguiente = abiertos.includes(grupo)
      ? abiertos.filter((g) => g !== grupo)
      : [...abiertos, grupo];
    void guardarAjuste(user.id, 'practicarGruposAbiertos', siguiente);
  };

  return (
    <Screen
      scroll
      edges={['bottom']}
      scrollY={scrollY}
      fondo={<FondoAurora />}
      encabezado={<EncabezadoPracticar scrollY={scrollY} racha={racha} entrada={primeraEntrada} />}
      style={{ paddingTop: top + ALTO_ENCABEZADO }}
      alRefrescar={refrescar}
      desfaseRefresco={top + ALTO_ENCABEZADO}
    >
      <Animated.View style={[styles.bloques, estiloFundido]}>
        <View style={styles.bloque}>
          {carga.estado === 'error' ? (
            <ErrorCarga onReintentar={carga.reintentar} />
          ) : (
            <ConsolaHoy
              modo={modoHoy}
              etiquetaBoton={etiquetaHoy(hoy.motivo, hoy.modo, atoradas, vencidas, metaDiaria)}
              pendientes={vencidas}
              hoyFrases={hoyFrases}
              meta={metaDiaria}
              racha={racha}
              usuarioId={user?.id ?? null}
              listo={listo}
              cargando={carga.estado === 'cargando' && carga.demora}
              entrada={primeraEntrada}
              refrescos={refrescos}
              onIr={() => modoHoy.ir(nav)}
            />
          )}
        </View>

        <View style={styles.bloque}>
          <SectionTitle title="Destacados" variante="bloque" />
          {carga.estado === 'cargando' ? (
            <View style={styles.reservaDestacados} />
          ) : (
            <Destacados
              ids={destacados}
              niveles={niveles}
              datoDe={datoDe}
              scrollY={scrollY}
              entrada={primeraEntrada}
              onIr={(id) => MODOS[id].ir(nav)}
            />
          )}
        </View>

        <View style={styles.bloque}>
          <SectionTitle title="Todo lo demás" variante="bloque" />
          {GRUPOS.map((g) => {
            const ids = ORDEN.filter((id) => MODOS[id].grupo === g.id && !destacados.includes(id));
            return (
              <GrupoPlegable
                key={g.id}
                titulo={g.titulo}
                icono={ICONO_GRUPO[g.id]}
                total={ids.length}
                abierto={abiertos.includes(g.id)}
                onAlternar={() => alternar(g.id)}
              >
                {(avance) =>
                  ids.map((id, i) => (
                    <FilaModo
                      key={id}
                      titulo={MODOS[id].titulo}
                      corta={MODOS[id].corta}
                      icono={ICONO_MODO[id]}
                      meta={metaDe(id, fuentesMeta)}
                      primera={i === 0}
                      indice={i}
                      avance={avance}
                      onPress={() => MODOS[id].ir(nav)}
                    />
                  ))
                }
              </GrupoPlegable>
            );
          })}
        </View>

        {reto ? (
          <View style={styles.bloque}>
            <SectionTitle title="Esta semana" variante="bloque" />
            <RetoSemana
              llevas={reto.llevas}
              meta={reto.meta}
              cumplido={reto.cumplido}
              desde={reto.desde}
              hoy={dayKey()}
              usuarioId={user?.id ?? null}
              scrollY={scrollY}
            />
          </View>
        ) : null}
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Entre bloques 32; dentro de un bloque 16 (ESP-2).
  bloques: { gap: space.xxl },
  bloque: { gap: space.lg },
  reservaDestacados: { height: tarjeta.heroe + space.md + tarjeta.compacta },
});
