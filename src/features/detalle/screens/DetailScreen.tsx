import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Badge, Carga, EmptyState, Header, IconButton, LevelBadge, RiskBadge, Screen } from '@/shared/ui';
import { MarcoImagen } from '@/shared/ui/MarcoImagen';
import { Hueso, HuesoImagen, HuesoTexto, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { Aparece } from '@/features/detalle/components/Aparece';
import { BotonGuardar } from '@/shared/ui/BotonGuardar';
import { CuandoNoDecirla } from '@/features/detalle/components/CuandoNoDecirla';
import { EscalaRegistro } from '@/features/detalle/components/EscalaRegistro';
import { FilaDondeVive } from '@/features/detalle/components/FilaDondeVive';
import { HeroeFrase } from '@/features/detalle/components/HeroeFrase';
import { color, font, layout, motionDuration, motionEntrada, radius, seccion, space, type WorldId } from '@/theme';
import { mismoTexto } from '@/domain/texto';
import { useDetalleFrase } from '@/features/detalle/hooks/useDetalleFrase';

/**
 * P-12, la ficha completa de una frase.
 *
 * Aquí vive todo lo que no cabe en la tarjeta: las variantes de
 * traducción, la versión neutra, cuándo NO usarla y por qué.
 */
export function DetailScreen() {
  const { nav, top, scrollY, carga, entry, fav, pulso, entradaAnim, alternar, mundosCatalogo } = useDetalleFrase();

  if (!entry) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <Carga
          carga={carga}
          vacio={<EmptyState icon="warning" title="No se encontró la frase." />}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando la frase" style={styles.esqueletoRaiz}>
              <HuesoImagen />
              <View style={styles.esqueletoCuerpo}>
                <Hueso width="85%" height={26} />
                <Hueso width="60%" height={18} />
                <View style={styles.esqueletoChips}>
                  <Hueso width={70} height={24} radius={radius.pill} />
                  <Hueso width={90} height={24} radius={radius.pill} />
                </View>
                <HuesoTexto lineas={3} style={styles.esqueletoTexto} />
              </View>
            </ProveedorEsqueleto>
          }
        >
          {() => null}
        </Carga>
      </Screen>
    );
  }

  // Una traducción que solo difiere de la principal en un punto o un acento no es «otra forma».
  const tieneVariantes = !mismoTexto(entry.spanish, entry.spanish_main);
  const tieneNeutro =
    entry.vulgaridad > 0 && !mismoTexto(entry.es_neutro, entry.spanish_main);
  const mundo = mundosCatalogo().find((m) => m.id === entry.mundo);
  const tinteMundo = color.world[entry.mundo as WorldId] ?? color.accent;

  return (
    // Al llegar (desde una lista o desde «Ver detalle») la ficha aparece con un fundido y una
    // escala de 0.96 a 1. La transición compartida de Reanimated sigue siendo experimental y
    // necesita build nativo, no Expo Go; esto funciona igual en todas partes.
    <Animated.View style={[styles.raiz, entradaAnim]}>
      <Screen
        scroll
        padded={false}
        edges={['bottom']}
        scrollY={scrollY}
        encabezado={
          // Flota sobre la imagen (o sobre el fondo, sin ella) y no se va con el scroll.
          <View style={[styles.encabezado, { paddingTop: top + space.xs }]} pointerEvents="box-none">
            <IconButton icono="back" etiqueta="Atrás" tamano="sm" onPress={() => nav.goBack()} />
          </View>
        }
        // Guardar es la acción principal y vive en la zona del pulgar, no arriba.
        footer={<BotonGuardar guardada={fav} pulso={pulso} onPress={alternar} />}
      >
        {/* El encabezado flota: este hueco lo cubre entero (su margen + el botón de 48), y luego va `space.md` más. */}
        <View style={{ height: top + space.xs + layout.tapMin }} />

        <View style={styles.marcoZona}>
          <MarcoImagen
            path={entry.imagen}
            tinte={tinteMundo}
            mundo={entry.mundo}
            scrollY={scrollY}
            zoomEntrada
          />
        </View>

        <View style={styles.cuerpo}>
          <HeroeFrase entry={entry} />

          {/* Entran escalonados: la escala de registro, «Cuándo NO decirla» y el contexto. */}
          <View style={styles.fila}>
            <Aparece scrollY={scrollY} retraso={motionEntrada.detalleRegistro}>
              <View style={styles.registro}>
                <EscalaRegistro
                  registro={entry.registro}
                  vulgaridad={entry.vulgaridad}
                  retraso={motionEntrada.detalleRegistro + motionDuration.base}
                />
                <View style={styles.chips}>
                  <LevelBadge nivel={entry.nivel} />
                  {entry.vigencia === 'efimera' ? (
                    <Badge label="Puede pasar de moda" tone="warn" small />
                  ) : null}
                  {/* La vulgaridad 2 ya es el último paso de la escala; la 1 lleva su aviso aparte. */}
                  {entry.vulgaridad === 1 ? <RiskBadge vulgaridad={entry.vulgaridad} /> : null}
                </View>
              </View>
            </Aparece>
          </View>

          {entry.no_usar_cuando ? (
            <View style={styles.warn}>
              <Aparece scrollY={scrollY} retraso={motionEntrada.detalleAviso}>
                <CuandoNoDecirla texto={entry.no_usar_cuando} />
              </Aparece>
            </View>
          ) : null}

          <Aparece scrollY={scrollY} retraso={motionEntrada.detalleContexto}>
            {tieneVariantes ? (
              <Block title="Otras formas de traducirla" body={entry.spanish} />
            ) : null}

            {tieneNeutro ? (
              <Block title="Versión sin groserías" body={entry.es_neutro} />
            ) : null}

            {entry.note ? <Block title="Nota" body={entry.note} /> : null}

            {entry.vulgar_marks.length > 0 ? (
              <Block
                title="Palabras fuertes"
                body={entry.vulgar_marks.join(' · ')}
              />
            ) : null}

            <View style={styles.block}>
              <Text style={styles.blockTitle}>Dónde vive</Text>
              <FilaDondeVive
                nombre={mundo?.nombre ?? entry.mundo}
                bloque={entry.block}
                tinte={tinteMundo}
                mundo={entry.mundo}
                onPress={() => nav.navigate('WorldDetail', { worldId: entry.mundo })}
              />
            </View>
          </Aparece>
        </View>
      </Screen>
    </Animated.View>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  esqueletoRaiz: { flex: 1 },
  esqueletoCuerpo: { paddingHorizontal: layout.screenPad, paddingTop: space.lg, gap: space.md },
  esqueletoChips: { flexDirection: 'row', gap: space.sm },
  esqueletoTexto: { marginTop: space.md },
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  raiz: { flex: 1 },
  marcoZona: { paddingHorizontal: layout.screenPad, paddingTop: space.md },
  cuerpo: { paddingHorizontal: layout.screenPad, paddingTop: seccion.entre },
  fila: { marginTop: seccion.entre },
  registro: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginBottom: seccion.escalaAbajo },
  chips: { alignItems: 'flex-end', gap: space.xs },
  warn: { marginTop: seccion.entre },
  block: { marginTop: seccion.entre, gap: seccion.tituloAbajo },
  blockTitle: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  blockBody: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
});
