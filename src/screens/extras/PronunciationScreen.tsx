import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Badge, Card, EmptyState, Header, Icon, Screen, type IconName } from '@/components/base';
import { AudioButton, SceneImage } from '@/components/card';
import { isBundled } from '@/assets/bundled';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import { loadContent } from '@/store/content';
import { color, font, radius, space } from '@/theme';
import type { Fonema } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

/** Pausa entre vueltas del modo "Repetir". */
const PAUSA_REPETIR_MS = 700;

/**
 * Reproduce `path` en bucle hasta que `activo()` deje de dar true.
 *
 * También se apaga solo si alguien más toca cualquier otro audio
 * mientras tanto (otro botón, un ejemplo, otro fonema): compara la
 * generación de audio.ts antes y después de cada espera, y si cambió
 * más de lo que causó su propio play(), ya no es el dueño del player.
 */
async function repiteEnBucle(path: string, activo: () => boolean): Promise<void> {
  while (activo()) {
    const antes = audio.generacionActual();
    const sonó = await audio.play(path);
    if (!sonó || audio.generacionActual() !== antes + 1) return;

    await audio.waitUntilDone();
    if (audio.generacionActual() !== antes + 1) return;

    if (!activo()) return;
    await new Promise((r) => setTimeout(r, PAUSA_REPETIR_MS));
    if (audio.generacionActual() !== antes + 1) return;
  }
}

type Nav = NativeStackNavigationProp<RootStackParams>;

const TIPOS = [
  { id: 'vocal_simple', label: 'Vocales' },
  { id: 'diptongo', label: 'Diptongos' },
  { id: 'oclusiva', label: 'Oclusivas' },
  { id: 'fricativa', label: 'Fricativas' },
  { id: 'africada', label: 'Africadas' },
  { id: 'nasal', label: 'Nasales' },
  { id: 'aproximante', label: 'Aproximantes' },
] as const;

/**
 * P-10, el laboratorio de sonidos.
 *
 * Los 44 fonemas con sus pares mínimos. El filtro por defecto son los
 * que NO existen en español, que son 20 de 44: ahí está el problema real
 * y ahí debe caer el usuario al abrir.
 */
export function PronunciationScreen() {
  const nav = useNavigation<Nav>();
  const content = useMemo(loadContent, []);
  const [tipo, setTipo] = useState<string | null>(null);
  const [soloDificiles, setSoloDificiles] = useState(true);
  const [abierto, setAbierto] = useState<string | null>(null);
  // Qué fonema está en modo "Repetir" ahorita, o null si ninguno.
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  // Fuente de verdad para repiteEnBucle: un state en un closure viejo no
  // sirve para cortar un bucle que ya está corriendo.
  const repiteRef = useRef(false);

  // Este ejercicio es puro oído: la música compite con el sonido que hay
  // que distinguir.
  useMusicaPantalla('silencio');

  const cancelarRepetir = useCallback(() => {
    repiteRef.current = false;
    setRepitiendo(null);
  }, []);

  const alternarRepetir = useCallback(
    (fonema: Fonema) => {
      if (repiteRef.current) {
        cancelarRepetir();
        audio.stop();
        return;
      }
      repiteRef.current = true;
      setRepitiendo(fonema.id);
      void repiteEnBucle(fonema.audio, () => repiteRef.current).finally(() => {
        if (repiteRef.current) cancelarRepetir();
      });
    },
    [cancelarRepetir]
  );

  // Cambiar de fonema (abrir otro, cerrar el actual) corta cualquier
  // repetición en curso: nunca debe sonar la de uno mientras se lee otro.
  useEffect(() => {
    cancelarRepetir();
    audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  useEffect(() => {
    return () => {
      cancelarRepetir();
      audio.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fonemas = useMemo(
    () =>
      content.fonemas.fonemas
        .filter((f) => (tipo ? f.tipo === tipo : true))
        .filter((f) => (soloDificiles ? !f.existe_en_espanol : true)),
    [content, tipo, soloDificiles]
  );

  const alternarAbierto = useCallback(
    (id: string) => setAbierto((actual) => (actual === id ? null : id)),
    []
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Fonema>) => (
      <FonemaCard
        fonema={item}
        open={abierto === item.id}
        onToggle={alternarAbierto}
        repitiendo={repitiendo === item.id}
        onToggleRepetir={alternarRepetir}
      />
    ),
    [abierto, repitiendo, alternarAbierto, alternarRepetir]
  );

  // Conteo por tipo con el filtro de dificultad ya aplicado: es lo que
  // se ve si tocas ese chip, no el total absoluto del tipo.
  const conteoPorTipo = new Map<string, number>();
  for (const t of TIPOS) {
    conteoPorTipo.set(
      t.id,
      content.fonemas.fonemas.filter(
        (f) => f.tipo === t.id && (soloDificiles ? !f.existe_en_espanol : true)
      ).length
    );
  }

  // Elegir un tipo saca de "difíciles" para no toparse con una
  // categoría vacía (oclusiva y nasal no tienen ninguno difícil).
  // Volver a "Todos" restaura el filtro pensado para abrir la pantalla.
  const seleccionaTipo = (id: string | null) => {
    setTipo(id);
    setSoloDificiles(id === null);
  };

  if (content.fonemas.fonemas.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Sonidos" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega fonemas.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  const cabecera = (
    <>
      <Header
        onBack={() => nav.goBack()}
        title="Los sonidos del inglés"
        subtitle={`${fonemas.length} de ${content.fonemas.total_fonemas}`}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
      >
        <Chip
          label="Los difíciles"
          active={soloDificiles}
          onPress={() => setSoloDificiles((v) => !v)}
        />
        <Chip label="Todos" active={!tipo} onPress={() => seleccionaTipo(null)} />
        {TIPOS.map((t) => (
          <Chip
            key={t.id}
            label={`${t.label} ${conteoPorTipo.get(t.id) ?? 0}`}
            active={tipo === t.id}
            onPress={() => seleccionaTipo(tipo === t.id ? null : t.id)}
          />
        ))}
      </ScrollView>
    </>
  );

  // Las tarjetas cambian de alto al abrirse: no hay getItemLayout.
  return (
    <Screen padded={false}>
      <FlatList
        data={fonemas}
        keyExtractor={claveFonema}
        renderItem={renderItem}
        ListHeaderComponent={cabecera}
        ListHeaderComponentStyle={styles.cabecera}
        ListEmptyComponent={
          <EmptyState
            icon="info"
            title="Estos sonidos ya existen en español"
            body="Por eso no salen en 'Los difíciles'. Puedes verlos igual."
            actionLabel="Ver todos"
            onAction={() => setSoloDificiles(false)}
          />
        }
        ItemSeparatorComponent={Separador}
        contentContainerStyle={styles.list}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={7}
        removeClippedSubviews
      />
    </Screen>
  );
}

const claveFonema = (f: Fonema) => f.id;

function Separador() {
  return <View style={styles.sep} />;
}

interface FonemaCardProps {
  fonema: Fonema;
  open: boolean;
  onToggle: (id: string) => void;
  repitiendo: boolean;
  onToggleRepetir: (fonema: Fonema) => void;
}

const FonemaCard = memo(function FonemaCard({
  fonema,
  open,
  onToggle,
  repitiendo,
  onToggleRepetir,
}: FonemaCardProps) {
  // audio_manual: true = todavía no hay sonido aislado (pendiente de
  // grabación humana). Tampoco hay botón si el mp3 no está en el bundle:
  // mejor ocultarlos que fingir uno que no suena.
  const hayAislado = !fonema.audio_manual && isBundled(fonema.audio);
  const hayLento = hayAislado && isBundled(fonema.audio_lento);

  return (
    <Card
      onPress={() => onToggle(fonema.id)}
      onLongPress={() => {
        if (hayAislado) void audio.play(fonema.audio);
      }}
      style={styles.card}
      accent={difTint(fonema.dificultad)}
    >
      <View style={styles.cardHead}>
        <Text style={styles.symbol}>{fonema.ipa}</Text>
        <View style={styles.cardText}>
          <Text style={styles.name}>{fonema.nombre}</Text>
          <Text style={styles.anchor}>como en {fonema.palabra_ancla}</Text>
        </View>
        {!fonema.existe_en_espanol ? (
          <Badge label="No existe en español" tone="warn" small />
        ) : (
          <Badge label="También en español" tone="good" small />
        )}
      </View>

      {fonema.imagen ? (
        <SceneImage path={fonema.imagen} size={160} ancha etiqueta={fonema.palabra_ancla} />
      ) : null}

      {hayAislado ? (
        <View style={styles.sonidoRow}>
          {/* Un solo botón: tocarlo repite el sonido hasta que se
              vuelva a tocar. Antes hacía falta este Y el chip de
              "Repetir" aparte para oírlo más de una vez. */}
          <Chip
            icon={repitiendo ? 'stop' : 'volume'}
            label={repitiendo ? 'Repitiendo…' : 'Solo el sonido'}
            active={repitiendo}
            onPress={() => onToggleRepetir(fonema)}
          />
          {hayLento ? (
            <AudioButton path={fonema.audio_lento} size="md" slow />
          ) : null}
        </View>
      ) : (
        <Text style={styles.enPreparacion}>
          Sonido aislado en preparación. Escúchalo en las palabras de ejemplo.
        </Text>
      )}

      {open ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.detail}>
          <Section title="Cómo se hace" body={fonema.como_producirlo} />
          <Section title="Qué sale mal" body={fonema.el_error_tipico} />

          {fonema.ejemplos.length > 0 ? (
            <>
              <Text style={styles.subhead}>Palabras</Text>
              <View style={styles.words}>
                {fonema.ejemplos.map((e) => (
                  <View key={e.palabra} style={styles.word}>
                    <AudioButton path={e.audio} size="sm" />
                    <View style={styles.wordText}>
                      <Text style={styles.wordEn}>{e.palabra}</Text>
                      <Text style={styles.wordIpa}>{e.ipa}</Text>
                    </View>
                    <Text style={styles.wordEs}>{e.spanish}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {fonema.pares_minimos.length > 0 ? (
            <>
              <Text style={styles.subhead}>
                Pares que cambian de significado
              </Text>
              {fonema.pares_minimos.map((p, i) => (
                <View key={`${p.a}-${i}`} style={styles.pair}>
                  <PairSide word={p.a} ipa={p.a_ipa} es={p.a_es} audio={p.audio_a} />
                  <Text style={styles.vs}>≠</Text>
                  <PairSide word={p.b} ipa={p.b_ipa} es={p.b_es} audio={p.audio_b} />
                </View>
              ))}
            </>
          ) : null}
        </Animated.View>
      ) : null}
    </Card>
  );
});

function PairSide({
  word,
  ipa,
  es,
  audio,
}: {
  word: string;
  ipa: string;
  es: string;
  audio: string;
}) {
  return (
    <View style={styles.pairSide}>
      <AudioButton path={audio} size="sm" />
      <Text style={styles.pairWord}>{word}</Text>
      <Text style={styles.pairIpa}>{ipa}</Text>
      <Text style={styles.pairEs}>{es}</Text>
    </View>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.subhead}>{title}</Text>
      <Text style={styles.sectionBody}>{body}</Text>
    </View>
  );
}

function Chip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: IconName;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipOn]}
      accessibilityRole="button"
    >
      {icon ? <Icon name={icon} size="sm" color={active ? color.accent : color.textMuted} /> : null}
      <Text style={[styles.chipText, active && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function difTint(d: 1 | 2 | 3): string {
  if (d === 3) return color.riskStrong;
  if (d === 2) return color.riskWarn;
  return color.correct;
}

const styles = StyleSheet.create({
  chips: { gap: space.xs, paddingVertical: space.sm, paddingRight: space.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipText: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  chipTextOn: { color: color.accent, fontFamily: font.family.bodyStrong },

  cabecera: { marginBottom: space.sm },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.sm },
  card: { gap: space.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  symbol: {
    fontFamily: font.family.ipa,
    fontSize: 36,
    letterSpacing: 36 * -0.015,
    color: color.accent,
    minWidth: 58,
  },
  cardText: { flex: 1 },
  sonidoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
  },
  name: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  anchor: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },

  enPreparacion: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },
  detail: { gap: space.md, marginTop: space.sm },
  section: { gap: space.xs },
  subhead: {
    fontSize: font.size.xs,
    color: color.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontFamily: font.family.bodyStrong,
  },
  sectionBody: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.6,
  },

  words: { gap: space.sm },
  word: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  wordText: { flex: 1 },
  wordEn: {
    fontSize: font.size.md,
    color: color.text,
    fontFamily: font.family.body,
  },
  wordIpa: { fontFamily: font.family.ipa, fontSize: font.size.xs, color: color.textMuted },
  wordEs: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },

  pair: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.sm,
  },
  pairSide: { flex: 1, alignItems: 'center', gap: 2 },
  pairWord: {
    fontSize: font.size.md,
    color: color.text,
    fontFamily: font.family.bodyStrong,
  },
  pairIpa: { fontFamily: font.family.ipa, fontSize: font.size.xs, color: color.textMuted },
  pairEs: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  vs: { color: color.textFaint, fontFamily: font.family.body, fontSize: font.size.lg },
});
