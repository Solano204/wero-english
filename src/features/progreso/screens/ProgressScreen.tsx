import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { ALTO_ENCABEZADO, Card, Carga, EncabezadoComprimido, IconButton, Screen } from '@/shared/ui';
import { Hueso, HuesoCirculo, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Detalle } from '@/features/progreso/components/Detalle';
import { FichaJuego } from '@/features/progreso/components/FichaJuego';
import { FilaMundo } from '@/features/progreso/components/FilaMundo';
import { PanelSenal } from '@/features/progreso/components/PanelSenal';
import { Espectrograma } from '@/features/progreso/components/Espectrograma';
import { JUEGOS_PROGRESO, filasMundo, resumenJuego } from '@/features/progreso/logic/datos';
import { ICONO_MODO } from '@/features/practicar/logic/iconos';
import { MODOS } from '@/features/practicar/logic/modos';
import { loadContent } from '@/data/contenido';
import { color, font, motionEntrada, radius, space, type WorldId } from '@/theme';
import { useProgreso } from '@/features/progreso/hooks/useProgreso';

/** Las fichas de «Por juego», de dos en dos. */
const FILAS_JUEGOS = [JUEGOS_PROGRESO.slice(0, 2), JUEGOS_PROGRESO.slice(2, 4), JUEGOS_PROGRESO.slice(4)];

/**
 * P-13, el progreso. Señal en vivo: el medidor de dominadas es el único momento
 * héroe; el resto responde al scroll y a los toques (cada sección se anima al entrar
 * a la vista).
 */
export function ProgressScreen() {
  const { nav, top, user, scrollY, primera, estiloFundido, pulsos, carga, refrescar, dias, sinDias, espectro, seccionMundos, seccionJuegos, seccionDetalle } = useProgreso();

  return (
    <Screen
      scroll
      edges={['bottom']}
      scrollY={scrollY}
      encabezado={
        <EncabezadoComprimido
          titulo="Tu progreso"
          scrollY={scrollY}
          entrada={primera}
          derecha={<IconButton icono="settings" etiqueta="Ajustes" onPress={() => nav.navigate('Settings')} />}
        />
      }
      style={{ paddingTop: top + ALTO_ENCABEZADO }}
      alRefrescar={refrescar}
      desfaseRefresco={top + ALTO_ENCABEZADO}
    >
      <Animated.View style={[styles.bloques, estiloFundido]}>
        <Carga
          carga={carga}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando tu progreso" style={styles.bloques}>
              <HuesoCirculo diametro={160} style={styles.esqueletoCentrado} />
              <View style={styles.bloque}>
                <Hueso width="60%" height={16} />
                <View style={styles.esqueletoEspectro}>
                  {Array.from({ length: 21 }, (_, i) => (
                    <Hueso key={i} width={8} height={24 + ((i * 13) % 40)} radius={2} />
                  ))}
                </View>
              </View>
              <View style={styles.bloque}>
                <Hueso width="50%" height={16} />
                <View style={styles.grupo}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <Hueso key={i} height={56} radius={0} />
                  ))}
                </View>
              </View>
              <View style={styles.bloque}>
                <Hueso width="45%" height={16} />
                <View style={styles.cuadricula}>
                  {FILAS_JUEGOS.map((par, r) => (
                    <View key={r} style={styles.parFichas}>
                      {par.map((_, c) => (
                        <Hueso key={c} height={90} radius={radius.lg} style={styles.hueco} />
                      ))}
                      {par.length === 1 ? <View style={styles.hueco} /> : null}
                    </View>
                  ))}
                </View>
              </View>
            </ProveedorEsqueleto>
          }
        >
          {({ stats, mundos, niveles, records }) => {
            const filas = filasMundo(loadContent().packs.mundos, mundos);
            return (
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

                {filas.length > 0 ? (
                  <Animated.View ref={seccionMundos.ref} collapsable={false} onLayout={seccionMundos.alAcomodar} style={styles.bloque}>
                    <SectionTitle title="Por mundo" variante="bloque" />
                    <View style={styles.grupo}>
                      {filas.map((m, i) => (
                        <FilaMundo
                          key={m.id}
                          nombre={m.nombre}
                          tinte={color.world[m.id as WorldId] ?? color.accent}
                          mundo={m.id}
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
                ) : null}

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

                {stats ? (
                  <Animated.View ref={seccionDetalle.ref} collapsable={false} onLayout={seccionDetalle.alAcomodar} style={styles.bloque}>
                    <Detalle
                      stats={stats}
                      visto={seccionDetalle.visto}
                      onGuardadas={() => nav.navigate('Deck')}
                      onAtoradas={() => nav.navigate('Stuck')}
                    />
                  </Animated.View>
                ) : null}
              </>
            );
          }}
        </Carga>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Entre bloques 32; dentro de un bloque 16 (ESP-2).
  bloques: { gap: space.xxl },
  bloque: { gap: space.lg },
  esqueletoCentrado: { alignSelf: 'center' },
  esqueletoEspectro: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs, height: 64 },
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
});
