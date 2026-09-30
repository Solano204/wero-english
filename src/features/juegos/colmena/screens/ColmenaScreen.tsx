import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmptyState, ErrorCarga, Header, Screen } from '@/shared/ui';
import { BloqueEscuchar } from '@/features/juegos/colmena/components/BloqueEscuchar';
import { EsqueletoColmena } from '@/features/juegos/colmena/components/EsqueletoColmena';
import { FraseResuelta } from '@/features/juegos/colmena/components/FraseResuelta';
import { Panal } from '@/features/juegos/colmena/components/Panal';
import { PieColmena } from '@/features/juegos/colmena/components/PieColmena';
import { ProgresoHex } from '@/features/juegos/colmena/components/ProgresoHex';
import { RanurasPalabra } from '@/features/juegos/colmena/components/RanurasPalabra';
import { useRondaColmena } from '@/features/juegos/colmena/hooks/useRondaColmena';
import { RelojRonda } from '@/features/juegos/pares/components/RelojRonda';
import { color, font, space } from '@/theme';

/**
 * P-24, Colmena.
 *
 * Se ve el español y se arma la palabra en inglés tocando letras.
 * Es producción pura disfrazada de juego: exige recordar la ortografía
 * completa igual que Escribir, pero sin teclado y sin castigar el dedo.
 *
 * La partida vive en useRondaColmena (y cada ronda es una máquina de estados, logic/ronda.ts). Aquí solo se pinta.
 */
export function ColmenaScreen() {
  const p = useRondaColmena();
  const { nav, carga, round, nv, tablero } = p;

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if (p.loading) {
    return (
      <Screen transicionCarga={carga.demora ? 'esqueleto' : undefined}>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        {carga.demora ? <EsqueletoColmena /> : null}
      </Screen>
    );
  }

  if (p.rounds.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
        <EmptyState
          icon="warning"
          title="No se pudo armar el tablero"
          body="No hay frases que quepan en la cuadrícula con los filtros que traes puestos. Prueba quitando el modo limpio o subiendo el nivel en Ajustes."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  // Entre la última ronda y el resumen no hay ronda: la pantalla nunca queda en blanco, sale con su encabezado.
  if (!round) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Colmena" />
      </Screen>
    );
  }

  // Todos los niveles traen reloj (de 22 a 60 s por ronda); sin él no hay barra.
  const tieneReloj = nv !== null && nv.segundosRonda > 0;
  // La nota dice solo lo que es verdad: con reloj, qué pasa cuando se acaba; sin él, que no hay ni reloj ni vidas.
  const nota = tieneReloj
    ? 'Sin vidas. Si se acaba el tiempo, ves la frase y sigues.'
    : 'Sin reloj y sin vidas. Puedes salir cuando quieras.';

  const puedePista =
    !p.resuelta && p.pistas > 0 && p.armado.length < round.objetivo.length;

  return (
    <Screen
      transicionCarga={carga.huboEsqueleto ? 'contenido' : undefined}
      padded={false}
      footer={
        // Zona 3, fija: nunca se mueve ni se tapa, sin importar cuánto
        // crezca el teclado de arriba (ver Screen.tsx: con footer, la
        // pantalla ya no reserva el colchón de tab bar que le robaba
        // espacio a la zona de en medio).
        <PieColmena
          resuelta={p.resuelta}
          ultima={p.idx + 1 >= p.rounds.length}
          avanzando={p.avanzando}
          pistas={p.pistas}
          puedePista={puedePista}
          nota={nota}
          onSiguiente={p.siguiente}
          onPista={p.usarPista}
          onRendirse={p.rendirse}
        />
      }
    >
      <View style={styles.top}>
        <Header onBack={() => nav.goBack()} title={p.nivel ? `Nivel ${p.nivel}` : undefined} />
        <ProgresoHex total={p.rounds.length} actual={p.idx} resuelta={p.resuelta} />

        {tieneReloj ? (
          <View style={styles.reloj}>
            <RelojRonda
              segundos={nv.segundosRonda}
              llave={`${p.nivel ?? 0}-${p.idx}`}
              pausado={p.resuelta}
              onFin={() => void p.seAcaboElTiempo()}
              etiqueta="Reloj de la ronda"
            />
          </View>
        ) : null}
      </View>

      {/*
       * Zona 1 (arriba, con scroll interno) y zona 2 (en medio, el
       * teclado) van en el MISMO ScrollView: así el teclado nunca puede
       * quedar clavado detrás de la barra fija de abajo, ni aunque una
       * palabra larguísima lo empuje más de lo que cabe en la pantalla.
       * flexShrink en la zona del teclado hace que, en el caso normal
       * (todo cabe), no se vea scroll ni falta espacio.
       */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={styles.bodyContenido}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.instruccion}>¿Cómo se dice?</Text>
        <Text style={styles.pista}>{round.pista}</Text>

        <BloqueEscuchar
          escuchas={p.escuchas}
          sonando={p.sonandoEscuchar}
          voz={p.voz}
          envolvente={p.analisis?.envolvente ?? []}
          onEscuchar={() => void p.escucharPalabra()}
          visible={!p.resuelta}
        />

        <View
          onLayout={(e) => {
            tablero.origenRanuras.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
          }}
        >
          <RanurasPalabra
            key={p.idx}
            distribucion={tablero.distribucion}
            palabras={tablero.forma}
            objetivo={round.objetivo}
            armado={p.armado}
            resolucion={p.resuelta ? (p.ayudaDesde === null ? 'acierto' : 'ayuda') : null}
            desdeAyuda={p.ayudaDesde ?? round.objetivo.length}
            fallo={p.falloLetra}
            retrasos={tablero.retrasos}
          />
        </View>

        <View style={styles.espacio} />

        <View
          style={{ width: tablero.disposicion.ancho, minHeight: tablero.disposicion.alto }}
          onLayout={(e) => {
            tablero.origenPanal.current = { x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y };
          }}
        >
          <View style={styles.panalCapa}>
            <Panal
              key={p.idx}
              letras={round.letras}
              disposicion={tablero.disposicion}
              colocadas={tablero.colocadas}
              rechazo={tablero.rechazo}
              resuelta={p.resuelta}
              saliendo={p.saliendo}
              onTocar={p.alTocarFicha}
            />
          </View>
          {p.resuelta && p.analisis ? (
            <FraseResuelta
              key={p.idx}
              entry={round.entry}
              palabras={p.analisis.palabras}
              voz={p.voz}
              seAcabo={p.seAcabo}
              retraso={tablero.aterrizaMs}
              saliendo={p.saliendo}
              alto={tablero.disposicion.alto}
            />
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  reloj: { marginTop: space.sm },
  body: { flex: 1 },
  // Con poco contenido el panal queda pegado abajo (zona del pulgar); con mucho, todo hace scroll.
  espacio: { flex: 1 },
  // El panal va en el lugar del wrapper sin darle altura: si la frase resuelta es más alta, el wrapper crece con ella.
  panalCapa: { position: 'absolute', left: 0, top: 0 },
  bodyContenido: {
    flexGrow: 1,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    gap: space.lg,
    paddingTop: space.lg,
    // Colchón extra antes del footer fijo: sumado al padding propio
    // del footer (ver Screen.tsx), deja al menos 16px libres entre el
    // teclado y la barra de Pista / No me sale.
    paddingBottom: space.sm,
  },
  instruccion: {
    fontSize: font.size.xs,
    color: color.textFaint,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
  },
  pista: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
});
