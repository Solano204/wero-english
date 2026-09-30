import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { EmptyState, Header, Screen } from '@/shared/ui';
import { BarraSesion } from '@/shared/ui/fx/BarraSesion';
import { BloqueEscucha } from '@/features/juegos/cazala/components/BloqueEscucha';
import { PieCaza } from '@/features/juegos/cazala/components/PieCaza';
import { RenglonCaza, type EstadoRenglon } from '@/features/juegos/cazala/components/RenglonCaza';
import { ResultadoCaza } from '@/features/juegos/cazala/components/ResultadoCaza';
import * as audio from '@/services/audio';
import { reacomodar, space } from '@/theme';
import { MARCAS, useRondaCazala } from '@/features/juegos/cazala/hooks/useRondaCazala';

/**
 * El ejercicio "Cázala": suena una frase a velocidad natural y hay que
 * decir cuáles tres reducciones venían.
 *
 * Se muestran seis opciones (tres correctas, tres distractores) y se
 * exigen exactamente tres selecciones antes de poder revisar.
 */
export function CazalaScreen() {
  const { nav, porId, items, idx, picked, checked, esperando, alturaHoja, setAlturaHoja, compacta, item, order, voz, vozLenta, analisis, analisisLento, posRevision, reducciones, destacadas, tiempos, morphs, toggle, revisar, siguiente } = useRondaCazala();

  if (items.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Cázala" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega contracciones.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  // Entre el último renglón y el resumen no hay renglón: la pantalla nunca queda en blanco, sale con su encabezado.
  if (!item) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Cázala" />
      </Screen>
    );
  }

  const estadoDe = (id: number): EstadoRenglon => {
    const marcada = picked.includes(id);
    if (!checked) return marcada ? 'marcada' : 'libre';
    if (item.reducciones.includes(id)) return marcada ? 'cazada' : 'perdida';
    return marcada ? 'noIba' : 'atenuada';
  };

  const aciertos = picked.filter((p) => item.reducciones.includes(p)).length;
  const tiempoDe = (id: number) => tiempos[reducciones.findIndex((r) => r.id === id)] ?? 0;

  return (
    <Screen
      padded={false}
      footer={
        <PieCaza
          marcadas={picked.length}
          revisada={checked}
          ultima={idx + 1 >= items.length}
          compacta={compacta}
          esperando={esperando}
          onRevisar={revisar}
          onSiguiente={siguiente}
        />
      }
    >
      <View style={styles.cabeza}>
        <Header onBack={() => nav.goBack()} title="Cázala" subtitle={`${idx + 1} de ${items.length}`} />
        <View style={styles.barra}>
          <BarraSesion hecho={idx + (checked ? 1 : 0)} meta={items.length} />
        </View>
      </View>

      <View style={[styles.cuerpo, compacta && styles.cuerpoCompacto]}>
        <BloqueEscucha
          audio={item.audio}
          audioLento={item.audio_lento}
          voz={voz}
          vozLenta={vozLenta}
          envolvente={analisis?.envolvente ?? []}
          envolventeLenta={analisisLento?.envolvente ?? []}
          compacta={compacta}
          conInstruccion={!checked}
          caceria={checked ? { pos: posRevision, tiempos } : null}
        />

        <Animated.View layout={reacomodar()} style={styles.lista}>
          <ScrollView
            contentContainerStyle={[
              styles.filas,
              compacta && styles.filasCompactas,
              // La hoja del resultado tapa la parte baja: la lista deja ese espacio libre para llegar a todas sus filas.
              checked && { paddingBottom: alturaHoja + space.sm },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {order.map((id, i) => (
              <RenglonCaza
                key={`${item.id}-${id}`}
                indice={i}
                compacta={compacta}
                label={porId.get(id)?.phrase_tts ?? `#${id}`}
                estado={estadoDe(id)}
                bajada={picked.length === MARCAS && !picked.includes(id)}
                caceria={checked && item.reducciones.includes(id) ? { pos: posRevision, t: tiempoDe(id) } : null}
                onPress={() => toggle(id)}
              />
            ))}
          </ScrollView>
        </Animated.View>

        {checked && analisis ? (
          <ResultadoCaza
            key={item.id}
            aciertos={aciertos}
            fraseReal={item.frase_real}
            fraseFormal={item.frase_formal}
            fraseEs={item.frase_es}
            audioEs={item.audio_es}
            palabras={analisis.palabras}
            destacadas={destacadas}
            voz={voz}
            morphs={morphs}
            pos={posRevision}
            alAlto={setAlturaHoja}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cabeza: { paddingHorizontal: space.lg, paddingTop: space.sm },
  // El halo de la barra ocupa 24 dp; se le devuelve lo que sobra para que no separe la tarjeta.
  barra: { marginTop: -space.sm, marginBottom: -space.sm },
  cuerpo: { flex: 1, paddingHorizontal: space.lg, gap: space.md },
  cuerpoCompacto: { gap: space.sm },
  // La lista sale 8 dp a cada lado y sus filas entran 8: las esquinas del retículo asoman fuera del renglón sin recortarse.
  lista: { flex: 1, marginHorizontal: -space.sm },
  filas: { gap: space.sm, paddingHorizontal: space.sm, paddingTop: space.xs, paddingBottom: space.sm },
  filasCompactas: { gap: space.xs },
});
