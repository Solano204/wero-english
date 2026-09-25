import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text, View } from 'react-native';
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
  Carga,
  EmptyState,
  Header,
  IconButton,
  LevelBadge,
  RiskBadge,
  Screen,
} from '@/components/base';
import { hayImagen } from '@/components/card';
import {
  Aparece,
  BotonGuardar,
  CuandoNoDecirla,
  EscalaRegistro,
  FilaDondeVive,
  HeroeFrase,
  ImagenSangre,
} from '@/components/detalle';
import { getEntry, isFavorite, toggleFavorite } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/store';
import { loadContent } from '@/store/content';
import { color, font, layout, space, type WorldId } from '@/theme';
import { mismoTexto } from '@/utils/text';
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
  // Sube cada vez que la frase pasa a guardada (la fiesta); quitarla no lo sube.
  const [pulso, setPulso] = useState(0);
  const [imagenFallo, setImagenFallo] = useState(false);
  // Si el usuario ya tocó el botón, la lectura inicial de la base no lo pisa.
  const tocado = useRef(false);

  // El estado real: antes el botón arrancaba siempre en «Guardar», aunque la frase ya estuviera guardada.
  useEffect(() => {
    if (!user) return;
    let vigente = true;
    void isFavorite(user.id, params.entryId).then((guardada) => {
      if (vigente && !tocado.current) setFav(guardada);
    });
    return () => {
      vigente = false;
    };
  }, [user, params.entryId]);

  const alternar = useCallback(async () => {
    if (!user || !entry) return;
    tocado.current = true;
    const guardada = await toggleFavorite(user.id, entry.id);
    setFav(guardada);
    if (guardada) setPulso((n) => n + 1);
    AccessibilityInfo.announceForAccessibility(guardada ? 'Guardada en Mi mazo' : 'Quitada de Mi mazo');
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

  // Una traducción que solo difiere de la principal en un punto o un acento no es «otra forma».
  const tieneVariantes = !mismoTexto(entry.spanish, entry.spanish_main);
  const tieneNeutro =
    entry.vulgaridad > 0 && !mismoTexto(entry.es_neutro, entry.spanish_main);
  const mundo = loadContent().packs.mundos.find((m) => m.id === entry.mundo);
  const tinteMundo = color.world[entry.mundo as WorldId] ?? color.accent;
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
        </View>
      }
      // Guardar es la acción principal y vive en la zona del pulgar, no arriba.
      footer={<BotonGuardar guardada={fav} pulso={pulso} onPress={alternar} />}
    >
      {conImagen ? (
        <ImagenSangre path={entry.imagen} scrollY={scrollY} alFallar={() => setImagenFallo(true)} />
      ) : (
        <View style={{ height: top + layout.tapMin + space.sm }} />
      )}

      <View style={styles.cuerpo}>
        <HeroeFrase entry={entry} />

        <View style={styles.fila}>
          <EscalaRegistro registro={entry.registro} vulgaridad={entry.vulgaridad} />
          <View style={styles.chips}>
            <LevelBadge nivel={entry.nivel} />
            {entry.vigencia === 'efimera' ? (
              <Badge label="Puede pasar de moda" tone="warn" small />
            ) : null}
            {/* La vulgaridad 2 ya es el último paso de la escala; la 1 lleva su aviso aparte. */}
            {entry.vulgaridad === 1 ? <RiskBadge vulgaridad={entry.vulgaridad} /> : null}
          </View>
        </View>

        {entry.no_usar_cuando ? (
          <View style={styles.warn}>
            <Aparece scrollY={scrollY}>
              <CuandoNoDecirla texto={entry.no_usar_cuando} />
            </Aparece>
          </View>
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

        <View style={styles.block}>
          <Text style={styles.blockTitle}>Dónde vive</Text>
          <FilaDondeVive
            nombre={mundo?.nombre ?? entry.mundo}
            bloque={entry.block}
            tinte={tinteMundo}
            onPress={() => nav.navigate('WorldDetail', { worldId: entry.mundo })}
          />
        </View>
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
  fila: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, marginTop: space.xl },
  chips: { alignItems: 'flex-end', gap: space.xs },
  warn: { marginTop: space.lg },
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
