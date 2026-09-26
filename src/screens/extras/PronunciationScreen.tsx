import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { EmptyState, Header, IconButton, Screen } from '@/components/base';
import type { Rect } from '@/components/fx';
import { IndiceFonemas } from '@/components/sonidos/IndiceFonemas';
import { PaginaFonema } from '@/components/sonidos/PaginaFonema';
import { ViajeSimbolo, type Viaje } from '@/components/sonidos/ViajeSimbolo';
import { sinBarras } from '@/domain/vocales';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import { loadContent } from '@/store/content';
import { color, font, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
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
type Ruta = RouteProp<RootStackParams, 'Pronunciation'>;

interface PagerProps {
  fonemas: Fonema[];
  pagina: number;
  ancho: number;
  onCambia: (indice: number) => void;
  renderPagina: (fonema: Fonema, indice: number) => React.ReactNode;
}

/**
 * Las páginas de fonemas, una junto a otra: se pasa deslizando a los lados. Solo se montan la página actual y sus
 * vecinas; las demás son un hueco del mismo ancho. El índice se actualiza al cruzar la mitad, así la vecina que
 * viene ya está montada cuando se llega a ella.
 */
function Pager({ fonemas, pagina, ancho, onCambia, renderPagina }: PagerProps) {
  // Solo el lugar inicial: si `contentOffset` siguiera a la página, pelearía con el dedo.
  const inicial = useRef(pagina).current;
  const actual = useRef(pagina);
  actual.current = pagina;
  const [alto, setAlto] = useState(0);

  return (
    <View style={styles.flex} onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: inicial * ancho, y: 0 }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / ancho);
          if (i !== actual.current && i >= 0 && i < fonemas.length) onCambia(i);
        }}
      >
        {fonemas.map((f, i) => (
          <View key={f.id} style={{ width: ancho, height: alto }}>
            {alto > 0 && Math.abs(i - pagina) <= 1 ? renderPagina(f, i) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * P-10, el laboratorio de sonidos.
 *
 * Abre con un índice de los 53 fonemas y cada uno es una página completa; entre fonemas se pasa deslizando. Si
 * llega `fonemaId`, abre directo en esa página.
 */
export function PronunciationScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const content = useMemo(loadContent, []);
  const fonemas = content.fonemas.fonemas;
  const total = content.fonemas.total_fonemas;
  const reducido = useMovimientoReducido();
  const { width: ancho } = useWindowDimensions();

  const inicial = useMemo(() => {
    const i = params?.fonemaId ? fonemas.findIndex((f) => f.id === params.fonemaId) : -1;
    return i >= 0 ? i : null;
    // Solo cuenta con lo que llegó al abrir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La página abierta (null = el índice) y la última que se vio: la página sigue montada mientras se desvanece.
  const [pagina, setPagina] = useState<number | null>(inicial);
  const [montada, setMontada] = useState(inicial !== null);
  const ultima = useRef(inicial ?? 0);
  const [viaje, setViaje] = useState<Viaje | null>(null);
  const enPagina = pagina !== null;
  const transicion = useSharedValue(enPagina ? 1 : 0);

  // Este ejercicio es puro oído: la música compite con el sonido que hay
  // que distinguir.
  useMusicaPantalla('silencio');

  // Qué fonema está en modo "Repetir" ahorita, o null si ninguno.
  const [repitiendo, setRepitiendo] = useState<string | null>(null);
  // Fuente de verdad para repiteEnBucle: un state en un closure viejo no
  // sirve para cortar un bucle que ya está corriendo.
  const repiteRef = useRef(false);

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

  // Cambiar de fonema (abrir otro, deslizar, volver al índice) corta cualquier repetición en curso: nunca debe
  // sonar la de uno mientras se lee otro.
  useEffect(() => {
    cancelarRepetir();
    audio.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina]);

  useEffect(() => {
    return () => {
      cancelarRepetir();
      audio.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Índice y páginas se funden entre sí; al volver al índice la página sale del árbol cuando ya se apagó.
  useEffect(() => {
    const destino = enPagina ? 1 : 0;
    if (reducido) {
      transicion.value = destino;
      if (!enPagina) setMontada(false);
      return;
    }
    transicion.value = withTiming(
      destino,
      { duration: motionDuration.escena, easing: enPagina ? motionEasing.entrar : motionEasing.salir },
      (fin) => {
        if (fin && destino === 0) runOnJS(setMontada)(false);
      }
    );
  }, [enPagina, reducido, transicion]);

  const abrir = useCallback(
    (indice: number, rect: Rect) => {
      const f = fonemas[indice];
      if (!f) return;
      ultima.current = indice;
      setMontada(true);
      setPagina(indice);
      // El símbolo del chip viaja hasta el de la página; con «reducir movimiento» no hay viaje.
      if (!reducido) setViaje({ ipa: sinBarras(f.ipa), desde: rect, hasta: null });
    },
    [fonemas, reducido]
  );

  const cambiarPagina = useCallback((indice: number) => {
    ultima.current = indice;
    setPagina(indice);
  }, []);

  const volverAlIndice = useCallback(() => {
    setViaje(null);
    setPagina(null);
  }, []);

  const simboloMedido = useCallback((rect: Rect) => {
    setViaje((v) => (v && !v.hasta ? { ...v, hasta: rect } : v));
  }, []);
  const finViaje = useCallback(() => setViaje(null), []);

  // Con una página abierta, «atrás» del sistema vuelve al índice y no sale de la pantalla.
  useEffect(() => {
    if (!enPagina) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      volverAlIndice();
      return true;
    });
    return () => sub.remove();
  }, [enPagina, volverAlIndice]);

  const estiloIndice = useAnimatedStyle(() => ({ opacity: 1 - transicion.value }));
  const estiloPagina = useAnimatedStyle(() => ({ opacity: transicion.value }));

  if (fonemas.length === 0) {
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

  const vista = pagina ?? ultima.current;
  const actual = fonemas[vista];

  return (
    <Screen padded={false}>
      <View style={styles.flex}>
        <Animated.View
          style={[StyleSheet.absoluteFill, estiloIndice]}
          pointerEvents={enPagina ? 'none' : 'auto'}
          importantForAccessibility={enPagina ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={enPagina}
        >
          <IndiceFonemas fonemas={fonemas} onAbrir={abrir} onAtras={() => nav.goBack()} />
        </Animated.View>

        {montada && actual ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, estiloPagina]}
            pointerEvents={enPagina ? 'auto' : 'none'}
            importantForAccessibility={enPagina ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={!enPagina}
          >
            <View style={styles.barra}>
              <View style={styles.lado}>
                <IconButton icono="back" etiqueta="Volver al índice" tamano="sm" onPress={volverAlIndice} />
              </View>
              <View style={styles.centro}>
                <Text style={styles.barraSimbolo} accessibilityLabel={actual.nombre}>
                  {sinBarras(actual.ipa)}
                </Text>
                <Text style={styles.cuenta}>{`${vista + 1} de ${total}`}</Text>
              </View>
              <View style={styles.lado} />
            </View>

            <Pager
              fonemas={fonemas}
              pagina={vista}
              ancho={ancho}
              onCambia={cambiarPagina}
              renderPagina={(f, i) => (
                <PaginaFonema
                  fonema={f}
                  esActual={enPagina && i === vista}
                  simboloOculto={viaje !== null && i === vista}
                  alSimboloMedido={viaje && !viaje.hasta && i === vista ? simboloMedido : undefined}
                  repitiendo={repitiendo === f.id}
                  alRepetir={alternarRepetir}
                />
              )}
            />
          </Animated.View>
        ) : null}

        {viaje ? <ViajeSimbolo viaje={viaje} onFin={finViaje} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tapMin,
    paddingHorizontal: layout.screenPad,
    paddingTop: space.sm,
  },
  lado: { width: 56, justifyContent: 'center' },
  centro: { flex: 1, alignItems: 'center' },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  barraSimbolo: { fontFamily: font.family.ipa, fontSize: font.size.xxl, color: color.accent },
  cuenta: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
