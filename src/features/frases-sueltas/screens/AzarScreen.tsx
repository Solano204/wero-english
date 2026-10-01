import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/shared/ui';
import { HuesoImagen, HuesoTexto, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { BotonGuardar } from '@/shared/ui/BotonGuardar';
import { MazoCartas, MazoVacio } from '@/features/frases-sueltas/components/MazoCartas';
import { color, font, space } from '@/theme';
import { useFrasesSueltas } from '@/features/frases-sueltas/hooks/useFrasesSueltas';

/**
 * Frases sueltas, sin algoritmo.
 *
 * Todo lo demás en la app decide por el usuario: SM-2 elige qué toca
 * hoy, los mundos agrupan, los niveles ordenan. Esta pantalla no decide
 * nada, y por eso existe: es el modo de "a ver qué sale" para cuando
 * alguien abre la app sin querer estudiar y sin querer jugar.
 *
 * No escribe calificaciones SM-2. Pasar frases sin responder nada no es
 * un repaso y contarlo como tal ensuciaría la cola de mañana. Lo único
 * que sí hace es dejar guardar con estrella lo que llame la atención.
 * No lleva cuenta de nada: por eso no hay contador de frases vistas.
 */
export function AzarScreen() {
  const { nav, pool, i, barajando, guardada, pulso, sonando, tanda, mazo, carga, loading, entry, sonar, alLanzar, alAvanzar, pedirSiguiente, alternarGuardada, guardarDeslizando } = useFrasesSueltas();

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Frases sueltas" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  // Mientras llega la baraja, o al acabarse las 60, el mazo se ve vacío en su mismo lugar: la pantalla no salta.
  const mazoVacio = (loading || barajando) && pool.length === 0;

  if (!entry && !mazoVacio) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Frases sueltas" />
        <EmptyState
          title="No salió nada"
          body="Con los filtros que traes puestos no hay frases disponibles. Prueba subiendo el nivel o quitando el modo limpio en Ajustes."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header onBack={() => nav.goBack()} title="Frases sueltas" />

      <View style={styles.zona}>
        {entry ? (
          <MazoCartas
            key={tanda}
            ref={mazo}
            entradas={pool}
            actual={i}
            sonando={sonando}
            onSonar={sonar}
            guardada={guardada}
            onGuardar={alternarGuardada}
            onGuardarDeslizando={guardarDeslizando}
            alLanzar={alLanzar}
            alAvanzar={alAvanzar}
          />
        ) : loading ? (
          carga.demora ? (
            <ProveedorEsqueleto etiqueta="Barajando frases" style={styles.esqueletoCarta}>
              <HuesoImagen />
              <HuesoTexto lineas={2} style={styles.esqueletoTexto} />
            </ProveedorEsqueleto>
          ) : null
        ) : (
          <MazoVacio />
        )}
      </View>

      <View style={[styles.pie, !entry && styles.pieApagado]} pointerEvents={entry ? 'auto' : 'none'}>
        <View style={styles.boton}>
          <Button
            label="Siguiente"
            icon="arrow-right"
            iconAlFinal
            onPress={pedirSiguiente}
            size="lg"
            full
            style={styles.botonPie}
          />
        </View>
        <View style={styles.boton}>
          <BotonGuardar
            variante="secondary"
            guardada={guardada}
            pulso={pulso}
            onPress={alternarGuardada}
            style={styles.botonPie}
          />
        </View>
      </View>

      <Text style={styles.aviso}>Aquí no se lleva cuenta de nada. Solo pasa frases.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zona: { flex: 1 },
  esqueletoCarta: { flex: 1, padding: space.xl, justifyContent: 'center', gap: space.lg },
  esqueletoTexto: { alignItems: 'center' },
  pie: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  pieApagado: { opacity: 0.45 },
  boton: { flex: 1 },
  // Dos botones de `lg` en 360 dp: con el padding de `xl` «Siguiente» y su flecha no caben; con `md` sí.
  botonPie: { paddingHorizontal: space.md },
  aviso: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
