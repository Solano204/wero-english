import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Card,
  Carga,
  EmptyState,
  Header,
  IconButton,
  LevelBadge,
  RegistroBadge,
  RiskBadge,
  Screen,
} from '@/components/base';
import { PhraseBlock, hayImagen } from '@/components/card';
import { ImagenSangre } from '@/components/detalle';
import { getEntry, toggleFavorite } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/store';
import { color, font, layout, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Rt = RouteProp<RootStackParams, 'Detail'>;

/**
 * P-12, la ficha completa de una frase.
 *
 * Aquí vive todo lo que no cabe en la tarjeta: las variantes de
 * traducción, la versión neutra, cuándo NO usarla y por qué.
 */
export function DetailScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const user = useAuthStore((s) => s.user);
  const { top } = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  const carga = useCarga(() => getEntry(params.entryId), [params.entryId], {
    esVacio: (e) => e === null,
  });
  const entry = carga.datos;
  const [fav, setFav] = useState(false);
  const [imagenFallo, setImagenFallo] = useState(false);

  const alternar = useCallback(async () => {
    if (!user || !entry) return;
    setFav(await toggleFavorite(user.id, entry.id));
  }, [user, entry]);

  if (!entry) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <Carga
          carga={carga}
          vacio={<EmptyState icon="warning" title="No se encontró la frase." />}
        >
          {() => null}
        </Carga>
      </Screen>
    );
  }

  const tieneVariantes = entry.spanish !== entry.spanish_main;
  const tieneNeutro =
    entry.vulgaridad > 0 && entry.es_neutro !== entry.spanish_main;
  // Sin imagen no se reserva su lugar: la pantalla arranca con la frase.
  const conImagen = hayImagen(entry.imagen) && !imagenFallo;

  return (
    <Screen
      scroll
      padded={false}
      edges={['bottom']}
      scrollY={scrollY}
      encabezado={
        // Flota sobre la imagen (o sobre el fondo, sin ella) y no se va con el scroll.
        <View style={[styles.encabezado, { paddingTop: top + space.xs }]} pointerEvents="box-none">
          <IconButton icono="back" etiqueta="Atrás" tamano="sm" onPress={() => nav.goBack()} />
          <IconButton
            icono={fav ? 'star-filled' : 'star'}
            etiqueta={fav ? 'Quitar de mi mazo' : 'Guardar en mi mazo'}
            tamano="sm"
            onPress={alternar}
          />
        </View>
      }
    >
      {conImagen ? (
        <ImagenSangre path={entry.imagen} scrollY={scrollY} alFallar={() => setImagenFallo(true)} />
      ) : (
        <View style={{ height: top + layout.tapMin + space.sm }} />
      )}

      <View style={styles.cuerpo}>
        <View style={styles.frase}>
          <PhraseBlock entry={entry} size="lg" showSpanish />
        </View>

        <View style={styles.tags}>
          <RiskBadge vulgaridad={entry.vulgaridad} />
          <RegistroBadge registro={entry.registro} />
          <LevelBadge nivel={entry.nivel} />
          {entry.vigencia === 'efimera' ? (
            <Badge label="Puede pasar de moda" tone="warn" small />
          ) : null}
        </View>

        {entry.no_usar_cuando ? (
          <Card style={styles.warn}>
            <Text style={styles.warnHead}>Cuándo NO decirla</Text>
            <Text style={styles.warnBody}>{entry.no_usar_cuando}</Text>
          </Card>
        ) : null}

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

        {entry.ipa_note ? <Block title="Pronunciación" body={entry.ipa_note} /> : null}

        <Block
          title="Dónde vive"
          body={`${entry.block} · ${entry.mundo}`}
        />
      </View>
    </Screen>
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
  encabezado: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
  },
  cuerpo: { paddingHorizontal: layout.screenPad, paddingTop: space.xl },
  frase: { alignItems: 'center' },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
    marginTop: space.md,
  },
  warn: { marginTop: space.lg, gap: space.xs },
  warnHead: {
    fontSize: font.size.xs,
    color: color.riskWarn,
    fontFamily: font.family.bodyStrong,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  warnBody: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
  block: { marginTop: space.lg, gap: space.xs },
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
