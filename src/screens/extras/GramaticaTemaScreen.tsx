import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { useSharedValue } from 'react-native-reanimated';
import { Button, Card, EmptyState, Header, Icon, Screen } from '@/components/base';
import { AudioButton } from '@/components/card';
import { FormulaFichas } from '@/components/gramatica/FormulaFichas';
import { MuroDesbloqueo } from '@/components/unlock';
import { segmentos } from '@/domain/gramatica';
import { loadContent } from '@/store/content';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import { color, font, radius, space, text, aparecerSubiendo, escalon } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { RootStackParams } from '@/navigation/routes';
import type { GramaticaTema } from '@/types';
import { GRATIS_POR_BLOQUE } from './GramaticaScreen';

/** Pausa entre un ejemplo y el siguiente en "Escuchar todos". */
const PAUSA_ENTRE_EJEMPLOS_MS = 600;
/** Pausa entre el inglés y el español de un mismo ejemplo. */
const PAUSA_INGLES_ESPANOL_MS = 350;

type Nav = NativeStackNavigationProp<RootStackParams>;
type R = RouteProp<RootStackParams, 'GramaticaTema'>;

/**
 * Pasos de "Escuchar todos": inglés y, si existe, español por ejemplo.
 * `ejemploDelPaso[i]` dice a qué ejemplo pertenece el paso `i`, porque
 * no todos los ejemplos aportan el mismo número de pasos.
 */
function armarPasos(ejemplos: GramaticaTema['ejemplos']) {
  const pasos: { path: string | null; pauseMs: number }[] = [];
  const ejemploDelPaso: number[] = [];
  ejemplos.forEach((e, i) => {
    if (e.audio_es) {
      pasos.push(
        { path: e.audio, pauseMs: PAUSA_INGLES_ESPANOL_MS },
        { path: e.audio_es, pauseMs: PAUSA_ENTRE_EJEMPLOS_MS }
      );
      ejemploDelPaso.push(i, i);
    } else {
      pasos.push({ path: e.audio, pauseMs: PAUSA_ENTRE_EJEMPLOS_MS });
      ejemploDelPaso.push(i);
    }
  });
  return { pasos, ejemploDelPaso };
}

/**
 * Un tema de gramática.
 *
 * El orden de la pantalla es el orden en que se entiende algo: primero
 * qué es, luego cuándo se usa, luego cómo se arma, luego ejemplos, y al
 * final el error típico.
 *
 * El error va al final a propósito. Puesto arriba, la gente lo lee, se
 * queda con la frase mal escrita y la recuerda mejor que la correcta.
 * Al final, ya tiene con qué contrastarla.
 */
export function GramaticaTemaScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<R>();
  const { gramatica } = loadContent();
  // Silencio total: entre la voz de los ejemplos y "Escuchar todos" la
  // música de fondo solo estorba, a diferencia de Estudio donde queda
  // más baja de fondo.
  useMusicaPantalla('silencio');
  const reducido = useMovimientoReducido();
  const scrollY = useSharedValue(0);

  const tema = useMemo(
    () => gramatica.temas.find((t) => t.id === params.temaId) ?? null,
    [gramatica, params.temaId]
  );

  const [ejemploActivo, setEjemploActivo] = useState<number | null>(null);
  const [reproduciendoTodos, setReproduciendoTodos] = useState(false);
  // El bucle async no ve el state nuevo: playSequence necesita un ref
  // vivo para poder cortarse a media reproducción.
  const reproduciendoRef = useRef(false);
  // Cuenta las ejecuciones de "Escuchar todos". Un stop + play rápido deja
  // la ejecución vieja terminando mientras ya corre la nueva: cada una
  // solo manda si sigue siendo la vigente.
  const ejecucionRef = useRef(0);

  useEffect(() => {
    // Al salir de la pantalla (o cambiar de tema, que remonta el
    // componente porque la ruta se apila con un temaId distinto): corta
    // la voz en camino, nunca la deja sonando de fondo.
    return () => {
      reproduciendoRef.current = false;
      audio.stop();
    };
  }, [params.temaId]);

  const escucharTodos = async () => {
    if (!tema || reproduciendoRef.current) return;
    const miEjecucion = ++ejecucionRef.current;
    const esVigente = () => reproduciendoRef.current && ejecucionRef.current === miEjecucion;
    reproduciendoRef.current = true;
    setReproduciendoTodos(true);
    const { pasos, ejemploDelPaso } = armarPasos(tema.ejemplos);
    await audio.playSequence(pasos, esVigente, (paso) =>
      setEjemploActivo(ejemploDelPaso[paso] ?? null)
    );
    if (ejecucionRef.current !== miEjecucion) return;
    reproduciendoRef.current = false;
    setReproduciendoTodos(false);
    setEjemploActivo(null);
  };

  /** Suelta la secuencia sin tocar el audio: lo usan los botones sueltos. */
  const soltarSecuencia = () => {
    reproduciendoRef.current = false;
    setReproduciendoTodos(false);
    setEjemploActivo(null);
  };

  const detenerTodos = () => {
    soltarSecuencia();
    audio.stop();
  };

  /** Posición dentro de su bloque: decide si necesita anuncio. */
  const posicion = useMemo(() => {
    if (!tema) return 0;
    return gramatica.temas.filter((t) => t.bloque === tema.bloque).findIndex((t) => t.id === tema.id);
  }, [gramatica, tema]);

  if (!tema) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <EmptyState
          title="Ese tema no existe"
          body="Puede que el catálogo se haya actualizado."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const cuerpo = (
    <Screen scroll scrollY={scrollY}>
      <Header
        onBack={() => nav.goBack()}
        title={gramatica.bloques[tema.bloque]?.nombre ?? 'Gramática'}
      />

      <Animated.View entering={reducido ? undefined : aparecerSubiendo()}>
        <Text style={text.h1} accessibilityRole="header">
          {tema.titulo}
        </Text>
        <Text style={styles.gancho}>{tema.gancho}</Text>
      </Animated.View>

      <Bloque titulo="Qué es" retraso={escalon(1)}>
        <Text style={styles.parrafo}>{tema.idea}</Text>
      </Bloque>

      <Bloque titulo="Cuándo se usa" retraso={escalon(2)}>
        <Text style={styles.parrafo}>{tema.cuando}</Text>
      </Bloque>

      <Bloque titulo="Cómo se arma" retraso={escalon(3)}>
        <FormulaFichas formula={tema.formula} scrollY={scrollY} />
      </Bloque>

      <Bloque titulo="Así se dice" retraso={escalon(4)}>
        <Button
          icon={reproduciendoTodos ? 'stop' : 'play'}
          label={reproduciendoTodos ? 'Detener' : 'Escuchar todos los ejemplos'}
          onPress={reproduciendoTodos ? detenerTodos : () => void escucharTodos()}
          variant={reproduciendoTodos ? 'secondary' : 'primary'}
          style={styles.escucharTodos}
        />
        {tema.ejemplos.map((e, i) => (
          <Card
            key={i}
            style={i === ejemploActivo ? { ...styles.ejemplo, ...styles.ejemploActivo } : styles.ejemplo}
          >
            <Text style={styles.en}>{e.en}</Text>
            <Text style={styles.es}>{e.es}</Text>
            <View style={styles.audioRow}>
              <AudioButton path={e.audio} size="sm" label="Inglés" onBeforePlay={soltarSecuencia} />
              <AudioButton
                path={e.audio_lento}
                size="sm"
                slow
                label="Lento"
                onBeforePlay={soltarSecuencia}
              />
              {e.audio_es ? (
                <AudioButton
                  path={e.audio_es}
                  size="sm"
                  label="Español"
                  onBeforePlay={soltarSecuencia}
                />
              ) : null}
            </View>
          </Card>
        ))}
      </Bloque>

      {tema.contraste ? (
        <Bloque titulo="La diferencia" retraso={escalon(5)}>
          <Card style={styles.contraste}>
            <Negrita texto={tema.contraste} estilo={styles.contrasteTxt} />
          </Card>
        </Bloque>
      ) : null}

      <Bloque titulo="En qué te vas a equivocar" retraso={escalon(6)}>
        <Card style={styles.error}>
          <View style={styles.linea}>
            <Icon name="close" size="md" color={color.wrong} />
            <Text style={styles.malTxt}>{tema.error_tipico.mal}</Text>
          </View>
          <View style={styles.linea}>
            <Icon name="check" size="md" color={color.correct} />
            <Text style={styles.bienTxt}>{tema.error_tipico.bien}</Text>
          </View>
          <View style={styles.audioRow}>
            <AudioButton
              path={tema.error_tipico.audio_bien}
              size="sm"
              label="Escuchar"
              onBeforePlay={soltarSecuencia}
            />
            <AudioButton
              path={tema.error_tipico.audio_bien}
              size="sm"
              slow
              label="Lento"
              onBeforePlay={soltarSecuencia}
            />
          </View>
          <Text style={styles.porQue}>{tema.error_tipico.por_que}</Text>
        </Card>
      </Bloque>

      {tema.ojo ? (
        <Bloque titulo="Ojo" retraso={escalon(7)}>
          <View style={styles.ojo}>
            <View style={styles.ojoBorde} />
            <Icon name="info" size="md" color={color.accent} />
            <Negrita texto={tema.ojo} estilo={styles.ojoTexto} />
          </View>
        </Bloque>
      ) : null}
    </Screen>
  );

  // Los primeros de cada bloque van abiertos: quien llega aquí trae una
  // duda concreta y tiene que poder resolver algo antes de que se le
  // pida nada.
  if (posicion < GRATIS_POR_BLOQUE) return cuerpo;

  return (
    <MuroDesbloqueo
      tipo="gramatica"
      id={tema.id}
      nombre={tema.titulo}
      detalle={tema.gancho}
      onVolver={() => nav.goBack()}
    >
      {cuerpo}
    </MuroDesbloqueo>
  );
}

function Bloque({ titulo, retraso, children }: {
  titulo: string; retraso: number; children: React.ReactNode;
}) {
  const reducido = useMovimientoReducido();
  return (
    <Animated.View entering={reducido ? undefined : aparecerSubiendo(retraso)} style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </Animated.View>
  );
}

/**
 * Pinta **negritas** sin traer un motor de markdown entero.
 * Son cuatro líneas y evita 40 KB de dependencia para un solo símbolo.
 */
function Negrita({ texto, estilo }: { texto: string; estilo: object }) {
  return (
    <Text style={estilo}>
      {segmentos(texto).map((s, i) => (
        <Text key={i} style={s.fuerte ? styles.fuerte : undefined}>
          {s.texto}
        </Text>
      ))}
    </Text>
  );
}

const ANCHO_BORDE_OJO = 3;

const styles = StyleSheet.create({
  gancho: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    marginTop: space.xs,
    lineHeight: font.size.md * 1.5,
  },
  seccion: { marginTop: space.xl },
  seccionTitulo: {
    fontSize: font.size.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
    color: color.textFaint,
    marginBottom: space.sm,
  },
  parrafo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.6,
  },
  escucharTodos: { alignSelf: 'flex-start', marginBottom: space.sm },
  ejemplo: { gap: 4 },
  ejemploActivo: { borderWidth: 1, borderColor: color.accent, backgroundColor: color.accentSoft },
  audioRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  en: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
    lineHeight: font.size.lg * 1.35,
  },
  es: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  contraste: { backgroundColor: color.surfaceAlt },
  contrasteTxt: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.6,
  },
  error: { gap: space.sm },
  linea: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  malTxt: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textDecorationLine: 'line-through',
  },
  bienTxt: {
    flex: 1,
    fontSize: font.size.md,
    color: color.text,
    fontFamily: font.family.bodyStrong,
  },
  porQue: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.55,
    marginTop: space.xs,
  },
  ojo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    backgroundColor: color.surfaceAlt,
    borderRadius: radius.md,
    overflow: 'hidden',
    paddingVertical: space.lg,
    paddingRight: space.lg,
    paddingLeft: space.lg + ANCHO_BORDE_OJO,
  },
  ojoBorde: { position: 'absolute', top: 0, bottom: 0, left: 0, width: ANCHO_BORDE_OJO, backgroundColor: color.accent },
  ojoTexto: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
  fuerte: { fontFamily: font.family.bodyStrong, color: color.text },
});
