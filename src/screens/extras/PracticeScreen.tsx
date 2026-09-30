import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ErrorCarga, Screen } from '@/components/base';
import { Hueso, ProveedorEsqueleto } from '@/components/esqueleto';
import { SectionTitle } from '@/components/list';
import { FondoAurora } from '@/components/fx';
import { getGameRecords, getHablaResumen, getRetoSemanal, getUsoModos } from '@/data/repos/partidas';
import { resumenTodos } from '@/data/repos/niveles';
import { getRecentDays } from '@/data/repos/progreso';
import { countDue, countNew } from '@/data/repos/tarjetas';
import { getStats } from '@/data/repos/estadisticas';
import { filtroEstudio } from '@/domain/cola';
import { useCarga } from '@/hooks/useCarga';
import { useEntradaPantalla } from '@/hooks/useEntradaPantalla';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/data/contenido';
import { radius, space, tarjeta } from '@/theme';
import { conteo } from '@/domain/texto';
import { dayKey } from '@/domain/fechas';
import { marcarPracticarInteractivo } from '@/utils/medicion';
import type { JuegoRecord, RetoSemanal } from '@/types';
import type { RootStackParams } from '@/navigation/routes';
import { ConsolaHoy } from '@/screens/extras/practicar/ConsolaHoy';
import { etiquetaCorregir } from '@/screens/extras/practicar/consola';
import { Destacados } from '@/screens/extras/practicar/Destacados';
import { EncabezadoPracticar, ALTO_ENCABEZADO } from '@/screens/extras/practicar/EncabezadoPracticar';
import { FilaModo } from '@/screens/extras/practicar/FilaModo';
import { GrupoPlegable } from '@/screens/extras/practicar/GrupoPlegable';
import { ICONO_GRUPO, ICONO_MODO } from '@/screens/extras/practicar/iconos';
import { metaDe, textoMeta, type FuentesMeta } from '@/screens/extras/practicar/metadatos';
import { RetoSemana } from '@/screens/extras/practicar/RetoSemana';
import { ORDEN, elegirDestacados, elegirHoy, type ModoId, type MotivoHoy, type Uso } from '@/screens/extras/practicar/hoy';
import { GRUPOS, MODOS } from '@/screens/extras/practicar/modos';

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
  /** Frases nuevas que quedan en el catálogo (con el filtro): decide qué ofrece HOY sin repasos. */
  nuevas: number;
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
  nuevas: 0,
};

/**
 * ¿HOY lleva a Estudiar sin repasos pendientes? Entonces no ofrece «Repasar»: ofrece aprender
 * frases nuevas (la sesión extra solo de nuevas) o dice que ya terminaste por hoy.
 */
function estudiarSinRepasos(motivo: MotivoHoy, modo: ModoId): boolean {
  return motivo === 'ultimo' && modo === 'study';
}

/** El botón de HOY dice qué va a pasar al tocarlo. */
function etiquetaHoy(
  motivo: MotivoHoy,
  modo: ModoId,
  atoradas: number,
  vencidas: number,
  meta: number,
  nuevas: number
): string {
  if (motivo === 'vencidas') {
    // El botón lleva lo que cabe en una sesión; el total pendiente va aparte. Nunca «Repasar 0»:
    // este motivo solo sale con vencidas > 0 (elegirHoy).
    const n = Math.min(vencidas, meta);
    return `Repasar ${conteo(n, 'frase')}`;
  }
  if (estudiarSinRepasos(motivo, modo)) return nuevas > 0 ? 'Aprender frases nuevas' : 'Ya terminaste por hoy';
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
  const { primera: primeraEntrada, estiloFundido } = useEntradaPantalla('practicar');
  const user = useAuthStore((s) => s.user);
  const abiertos = useSettingsStore((s) => s.practicarGruposAbiertos);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const filter = useSettingsStore((s) => s.filter);
  const metaDiaria = useSettingsStore((s) => s.metaDiaria);

  const carga = useCarga(
    async (): Promise<Datos> => {
      if (!user) return SIN_DATOS;
      const [records, reto, habla, niveles, stats, uso, dias, vencidas, nuevas] = await Promise.all([
        getGameRecords(user.id),
        getRetoSemanal(user.id),
        getHablaResumen(user.id),
        resumenTodos(user.id),
        getStats(user.id),
        getUsoModos(user.id),
        getRecentDays(user.id, 1),
        countDue(user.id, filtroEstudio(filter())),
        countNew(user.id, filtroEstudio(filter())),
      ]);
      const hoyFrases = dias[0]?.dia === dayKey() ? dias[0].respuestas : 0;
      return { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas, nuevas };
    },
    [user, filter],
    { alEnfocar: true }
  );
  // Hasta que carga, HOY se maqueta pero no se ve ni se toca: si no, pintaría
  // el caso "usuario nuevo" un instante y luego saltaría a otro.
  const listo = carga.estado === 'listo';
  // Medición del arranque (docs/RENDIMIENTO.md): el primer cuadro con los datos ya pintados.
  useEffect(() => {
    if (!listo) return undefined;
    const id = requestAnimationFrame(marcarPracticarInteractivo);
    return () => cancelAnimationFrame(id);
  }, [listo]);

  // Jalar para refrescar: recarga sin esqueleto y la onda de HOY da un pulso al terminar.
  const [refrescos, setRefrescos] = useState(0);
  const refrescar = useCallback(async () => {
    await carga.refrescar();
    setRefrescos((n) => n + 1);
  }, [carga.refrescar]);
  const { records, reto, habla, niveles, stats, uso, hoyFrases, vencidas, nuevas } = carga.datos ?? SIN_DATOS;

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
              etiquetaBoton={etiquetaHoy(hoy.motivo, hoy.modo, atoradas, vencidas, metaDiaria, nuevas)}
              pendientes={vencidas}
              hoyFrases={hoyFrases}
              meta={metaDiaria}
              racha={racha}
              usuarioId={user?.id ?? null}
              listo={listo}
              cargando={carga.estado === 'cargando' && carga.demora}
              entrada={primeraEntrada}
              refrescos={refrescos}
              scrollY={scrollY}
              onIr={() =>
                // Sin repasos: «Aprender frases nuevas» abre la sesión de solo nuevas; «Ya terminaste
                // por hoy» abre Estudiar, que muestra su estado final con lo que sí se puede hacer.
                estudiarSinRepasos(hoy.motivo, hoy.modo) && nuevas > 0
                  ? nav.navigate('Study', { modo: 'nuevas' })
                  : modoHoy.ir(nav)
              }
            />
          )}
        </View>

        <View style={styles.bloque}>
          <SectionTitle title="Destacados" variante="bloque" />
          {carga.estado === 'cargando' ? (
            carga.demora ? (
              <ProveedorEsqueleto etiqueta="Cargando destacados" style={styles.reservaDestacados}>
                <Hueso height={tarjeta.heroe} radius={radius.lg} />
                <View style={styles.esqueletoFilaDestacados}>
                  <Hueso height={tarjeta.compacta} radius={radius.lg} style={styles.esqueletoCompacta} />
                  <Hueso height={tarjeta.compacta} radius={radius.lg} style={styles.esqueletoCompacta} />
                </View>
              </ProveedorEsqueleto>
            ) : (
              <View style={styles.reservaDestacados} />
            )
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
  reservaDestacados: { height: tarjeta.heroe + space.md + tarjeta.compacta, gap: space.md },
  esqueletoFilaDestacados: { flexDirection: 'row', gap: space.md, flex: 1 },
  esqueletoCompacta: { flex: 1 },
});
