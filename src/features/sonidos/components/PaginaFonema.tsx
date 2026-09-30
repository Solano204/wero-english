import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { isBundled } from '@/assets/bundled';
import Animated from 'react-native-reanimated';
import { Badge, Button, Icon } from '@/shared/ui';
import { SceneImage } from '@/shared/ui/SceneImage';
import { OndaVoz } from '@/shared/ui/fx/OndaVoz';
import { useVozEnVivo } from '@/shared/ui/fx/useVozEnVivo';
import { type Rect } from '@/shared/ui/fx/useDesfaseVentana';
import { analizar } from '@/domain/marcas';
import { posicionVocal, sinBarras } from '@/domain/vocales';
import * as audio from '@/services/audio';
import { color, entraSube, font, layout, motionDuration, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Fonema } from '@/types';
import { DueloPar } from './DueloPar';
import { MapaBoca } from './MapaBoca';
import { RenglonPalabra } from './RenglonPalabra';
import { SIMBOLO_GRANDE } from './ViajeSimbolo';

/** Cuántos cuadros se espera a que la página termine de acomodarse antes de dar por perdido el símbolo. */
const INTENTOS_MEDIR = 10;
const ALTO_ONDA = 32;

/**
 * El modo de articulación de una consonante: sale de `tipo`, que sí está en los datos. El punto de articulación
 * no está, y no se inventa.
 */
const MODO_CONSONANTE: Record<string, string> = {
  oclusiva: 'oclusiva',
  fricativa: 'fricativa',
  africada: 'africada',
  nasal: 'nasal',
  aproximante: 'aproximante',
};

interface BloqueProps {
  titulo: string;
  cuerpo: string;
  /** `accent` (cómo se hace) o `aviso` (qué sale mal: el ámbar sí aplica, es el error típico). */
  tono: 'accent' | 'aviso';
  retraso: number;
}

/** Un bloque de texto con filo izquierdo de 3 px que entra con un fundido subiendo 8 dp. */
function Bloque({ titulo, cuerpo, tono, retraso }: BloqueProps) {
  const reducido = useMovimientoReducido();
  const aviso = tono === 'aviso';
  return (
    <Animated.View
      entering={reducido ? undefined : entraSube(retraso)}
      style={[styles.bloque, aviso ? styles.bloqueAviso : styles.bloqueAccent]}
    >
      <View style={styles.bloqueTitulo}>
        {aviso ? <Icon name="warning" size="sm" color={color.riskWarn} /> : null}
        <Text style={styles.subtitulo}>{titulo}</Text>
      </View>
      <Text style={styles.cuerpo}>{cuerpo}</Text>
    </Animated.View>
  );
}

interface Props {
  fonema: Fonema;
  /** Es la página que se ve: la única que anima y suena. */
  esActual: boolean;
  /** El símbolo viaja desde el índice: mientras vuela, el de la página no se ve. */
  simboloOculto: boolean;
  /** Si viene, la página mide su símbolo grande y avisa dónde quedó (para el viaje desde el chip del índice). */
  alSimboloMedido?: (rect: Rect) => void;
  /** Este fonema está en «Solo el sonido» (repitiéndose hasta que se vuelva a tocar). */
  repitiendo: boolean;
  /** Empieza o detiene «Solo el sonido». */
  alRepetir: (fonema: Fonema) => void;
  /** Abre «Di la palabra» con los pares de este fonema. */
  alPracticar: (fonema: Fonema) => void;
}

/** Una página del laboratorio: todo lo de un fonema. */
export function PaginaFonema({
  fonema,
  esActual,
  simboloOculto,
  alSimboloMedido,
  repitiendo,
  alRepetir,
  alPracticar,
}: Props) {
  const { width: anchoVentana } = useWindowDimensions();
  const simbolo = useRef<View>(null);

  const medir = useCallback(
    (intento: number) => {
      simbolo.current?.measureInWindow((x, y, width, height) => {
        // La página puede no estar todavía en su lugar (el pager se acomoda un cuadro después de montarse).
        const dentro = width > 0 && x > -width && x < anchoVentana;
        if (dentro) alSimboloMedido?.({ x, y, width, height });
        else if (intento < INTENTOS_MEDIR) requestAnimationFrame(() => medir(intento + 1));
      });
    },
    [alSimboloMedido, anchoVentana]
  );

  useEffect(() => {
    if (alSimboloMedido) medir(0);
  }, [alSimboloMedido, medir]);

  // audio_manual: true = todavía no hay sonido aislado (pendiente de grabación humana). Tampoco hay botón si el
  // mp3 no está en el bundle: mejor ocultarlos que fingir uno que no suena.
  const hayAislado = !fonema.audio_manual && isBundled(fonema.audio);
  const hayLento = hayAislado && isBundled(fonema.audio_lento);

  // Solo la página que se ve escucha: las vecinas no gastan nada.
  const vozSolo = useVozEnVivo(esActual && hayAislado ? fonema.audio : null);
  const vozLento = useVozEnVivo(esActual && hayLento ? fonema.audio_lento : null);
  // El sonido aislado no tiene palabras: su energía es una sola campana sobre la duración real del audio.
  const simboloIpa = sinBarras(fonema.ipa);
  const envolvente = useMemo(
    () => analizar(simboloIpa, simboloIpa, undefined, vozSolo.duracion).envolvente,
    [simboloIpa, vozSolo.duracion]
  );
  const envolventeLenta = useMemo(
    () => analizar(simboloIpa, simboloIpa, undefined, vozLento.duracion).envolvente,
    [simboloIpa, vozLento.duracion]
  );
  const lenta = vozLento.sonando;

  const oirLento = () => {
    // Si estaba repitiendo, primero se corta: el lento toma su lugar.
    if (repitiendo) alRepetir(fonema);
    void audio.playSlow(fonema.audio_lento);
  };

  return (
    <ScrollView contentContainerStyle={styles.contenido} showsVerticalScrollIndicator={false}>
      <View style={styles.cabeza}>
        <View ref={simbolo} collapsable={false} style={simboloOculto ? styles.oculto : undefined}>
          <Text style={styles.simbolo} accessibilityLabel={fonema.nombre}>
            {simboloIpa}
          </Text>
        </View>
        <View style={styles.textos}>
          <Text style={styles.nombre}>{fonema.nombre}</Text>
          <Text style={styles.ancla}>como en {fonema.palabra_ancla}</Text>
          <View style={styles.badge}>
            {fonema.existe_en_espanol ? (
              <Badge label="También en español" tone="neutral" small />
            ) : (
              <Badge label="No existe en español" tone="accent" small />
            )}
          </View>
        </View>
      </View>

      {hayAislado ? (
        <View style={styles.onda} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <OndaVoz
            voz={lenta ? vozLento : vozSolo}
            envolvente={lenta ? envolventeLenta : envolvente}
            alto={ALTO_ONDA}
          />
        </View>
      ) : null}

      {hayAislado ? (
        <View style={styles.botones}>
          {/* Un solo botón: tocarlo repite el sonido hasta que se vuelva a tocar. */}
          <Button
            icon={repitiendo ? 'stop' : 'volume'}
            label={repitiendo ? 'Repitiendo…' : 'Solo el sonido'}
            onPress={() => alRepetir(fonema)}
            style={styles.boton}
          />
          {hayLento ? <Button icon="slow" label="Lento" variant="secondary" onPress={oirLento} style={styles.boton} /> : null}
        </View>
      ) : (
        <Text style={styles.enPreparacion}>
          Sonido aislado en preparación. Escúchalo en las palabras de ejemplo.
        </Text>
      )}

      {/* El mapa de la boca solo existe para las vocales que están en la tabla del IPA; una consonante dice su modo. */}
      {posicionVocal(fonema.ipa) ? (
        <MapaBoca ipa={fonema.ipa} esActual={esActual} voz={vozSolo} />
      ) : MODO_CONSONANTE[fonema.tipo] ? (
        <View style={styles.badge}>
          <Badge label={`Consonante · ${MODO_CONSONANTE[fonema.tipo]}`} tone="neutral" small />
        </View>
      ) : null}

      {/* Sin imagen no se reserva lugar. */}
      {fonema.imagen ? <SceneImage path={fonema.imagen} size={160} ancha /> : null}

      {fonema.como_producirlo ? (
        <Bloque titulo="Cómo se hace" cuerpo={fonema.como_producirlo} tono="accent" retraso={motionDuration.rapido} />
      ) : null}
      {fonema.el_error_tipico ? (
        <Bloque titulo="Qué sale mal" cuerpo={fonema.el_error_tipico} tono="aviso" retraso={motionDuration.rapido * 2} />
      ) : null}

      {fonema.ejemplos.length > 0 ? (
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion} accessibilityRole="header">
            Palabras
          </Text>
          <View style={styles.lista}>
            {fonema.ejemplos.map((e) => (
              <RenglonPalabra key={e.palabra} ejemplo={e} esActual={esActual} />
            ))}
          </View>
        </View>
      ) : null}

      {fonema.pares_minimos.length > 0 ? (
        <View style={styles.seccion}>
          <Text style={styles.tituloSeccion} accessibilityRole="header">
            Pares que cambian de significado
          </Text>
          <View style={styles.lista}>
            {fonema.pares_minimos.map((p, i) => (
              <DueloPar key={`${p.a}-${i}`} par={p} esActual={esActual} />
            ))}
          </View>
          <Button label="Practicar estos pares" icon="microphone" variant="secondary" onPress={() => alPracticar(fonema)} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  contenido: { padding: layout.screenPad, paddingBottom: space.xxxl, gap: space.lg },
  cabeza: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  oculto: { opacity: 0 },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  simbolo: {
    fontFamily: font.family.ipa,
    fontSize: SIMBOLO_GRANDE,
    letterSpacing: SIMBOLO_GRANDE * -0.015,
    color: color.accent,
  },
  textos: { flex: 1, gap: space.xs },
  nombre: { fontFamily: font.family.heading, fontSize: font.size.xl, color: color.text },
  ancla: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  badge: { flexDirection: 'row', marginTop: space.xs },
  onda: { alignSelf: 'stretch', height: ALTO_ONDA },
  botones: { flexDirection: 'row', gap: space.sm },
  boton: { flex: 1 },
  enPreparacion: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textFaint },
  bloque: { gap: space.xs, padding: space.md, borderLeftWidth: 3, borderRadius: radius.sm },
  bloqueAccent: { backgroundColor: color.surface, borderLeftColor: color.accent },
  bloqueAviso: { backgroundColor: color.riskWarnSoft, borderLeftColor: color.riskWarn },
  bloqueTitulo: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  subtitulo: {
    flexShrink: 1,
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.xs,
    color: color.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cuerpo: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.text },
  seccion: { gap: space.md },
  tituloSeccion: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text },
  lista: { gap: space.sm },
});
