import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ErrorCarga, Screen } from '@/shared/ui';
import { Hueso, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { FondoAurora } from '@/features/practicar/components/FondoAurora';
import { radius, space, tarjeta } from '@/theme';
import { conteo } from '@/domain/texto';
import { dayKey } from '@/domain/fechas';
import { ConsolaHoy } from '@/features/practicar/components/ConsolaHoy';
import { etiquetaCorregir } from '@/domain/consolaHoy';
import { Destacados } from '@/features/practicar/components/Destacados';
import { EncabezadoPracticar, ALTO_ENCABEZADO } from '@/features/practicar/components/EncabezadoPracticar';
import { FilaModo } from '@/features/practicar/components/FilaModo';
import { GrupoPlegable } from '@/features/practicar/components/GrupoPlegable';
import { ICONO_GRUPO, ICONO_MODO } from '@/shared/navegacion/iconosModo';
import { metaDe } from '@/features/practicar/logic/metadatos';
import { RetoSemana } from '@/features/practicar/components/RetoSemana';
import { ORDEN, type ModoId, type MotivoHoy } from '@/features/practicar/logic/hoy';
import { GRUPOS, MODOS } from '@/shared/navegacion/modos';
import { usePracticar } from '@/features/practicar/hooks/usePracticar';

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
  const { nav, top, scrollY, primeraEntrada, estiloFundido, user, abiertos, metaDiaria, carga, listo, refrescos, refrescar, reto, niveles, hoyFrases, vencidas, nuevas, atoradas, racha, hoy, destacados, modoHoy, fuentesMeta, datoDe, alternar } = usePracticar();

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
