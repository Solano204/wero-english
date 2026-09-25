import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import Animated from 'react-native-reanimated';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Carga, Header, Screen, SkeletonLista, pedirRecompensa, razonMuro } from '@/components/base';
import {
  ALTO_TRAMO,
  CONFIGURACION_VISTA,
  EncabezadoNiveles,
  EncabezadoTramo,
  FilaNiveles,
  HUECO_CELDAS,
  RETRASO_LOGRO,
  SIN_RECOMPENSA,
  useRecompensaNiveles,
  useScrollNivel,
} from '@/components/niveles';
import {
  abrirConAnuncio,
  getNiveles,
  nivelDesbloqueado,
  nivelesPagados,
  type NivelEstado,
} from '@/db/levels';
import {
  COLUMNAS,
  aplanar,
  armarTramos,
  indiceDeNivel,
  indicesEncabezado,
  medir,
  totalEstrellas,
  type BandaDef,
  type EstadoNivel,
  type ItemLista,
} from '@/domain/niveles';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/store';
import { loadContent } from '@/store/content';
import { MuroDesbloqueo } from '@/components/unlock';
import { aparecer, color, desaparecer, escalon, font, layout, motionDuration, motionLogro, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/utils';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

const SIN_ESTADOS = new Map<number, NivelEstado>();
type Ruta = RouteProp<RootStackParams, 'Niveles'>;

/** Cuánto se queda el aviso de un anuncio que falló. */
const DURACION_AVISO_MS = 5000;
/** La entrada escalonada cuenta desde unos renglones arriba del nivel actual (lo que cabe en pantalla). */
const FILAS_ANTES_DEL_ACTUAL = 4;

/**
 * El mapa de niveles.
 *
 * Doscientos por juego, en tres tramos (las bandas del juego) de renglones de cinco.
 * Se abren de uno en uno: terminar un nivel abre el siguiente, saques una estrella o
 * tres, y un anuncio abre UN nivel adelantado, el que sigue del siguiente. La lista
 * está virtualizada (no se pintan los doscientos de golpe) y cada tramo lleva su
 * encabezado pegado arriba mientras se recorre.
 */
const TITULOS: Record<string, string> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caída',
  dulces: 'Dulces',
  cazala: 'Cázala',
  pares_minimos: 'Pares mínimos',
};

export function NivelesScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const content = useMemo(loadContent, []);
  const { width } = useWindowDimensions();

  const juego = params.juego;
  const def = content.niveles.juegos[juego];

  const carga = useCarga(
    async () => {
      if (!user) return null;
      const estados = await getNiveles(user.id, juego);
      const siguiente = await nivelDesbloqueado(user.id, juego);
      const pagados = await nivelesPagados(user.id, juego);
      return { estados, siguiente, pagados };
    },
    [user, juego],
    { alEnfocar: true }
  );
  const estados = carga.datos?.estados ?? SIN_ESTADOS;
  const siguiente = carga.datos?.siguiente ?? 1;
  // Niveles abiertos con anuncio en esta visita, además de los que ya guardó la base.
  // Se abren de uno en uno y no encadenan.
  const [abiertosAhora, setAbiertosAhora] = useState<number[]>([]);
  const [abriendo, setAbriendo] = useState(false);
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(new Set());

  // El aviso cuando el anuncio falla o se cierra antes de tiempo: unos segundos y se va.
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizadorAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = useCallback((mensaje: string) => {
    setAviso(mensaje);
    if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
  }, []);
  useEffect(
    () => () => {
      if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current);
    },
    []
  );

  /**
   * Abre un nivel adelantado a cambio de un anuncio.
   *
   * Solo se ofrece sobre el primer nivel cerrado, no sobre cualquiera:
   * poder saltar del 3 al 180 con un video vacía los 176 de en medio y
   * el usuario se queda sin nada que hacer al día siguiente.
   */
  const saltar = useCallback(
    async (nivel: number) => {
      if (!user || abriendo) return;
      setAbriendo(true);
      const r = await pedirRecompensa();
      if (r === 'visto') {
        // Un anuncio abre UN nivel: el que se pagó, y nada más. No toca
        // `siguiente`, porque eso es la cadena de niveles jugados.
        await abrirConAnuncio(user.id, juego, nivel);
        setAbiertosAhora((prev) => [...prev, nivel]);
      } else {
        // La celda se queda como estaba y se dice por qué, con el tono de siempre.
        avisar(razonMuro(r));
      }
      setAbriendo(false);
    },
    [user, juego, abriendo, avisar]
  );

  const alTocar = useCallback(
    (n: number, estado: EstadoNivel) => {
      if (estado === 'anuncio') {
        void saltar(n);
        return;
      }
      if (estado === 'bloqueado') return;
      const ruta = RUTA[juego];
      if (ruta) nav.navigate(ruta, { nivel: n });
    },
    [saltar, juego, nav]
  );

  const alternarTramo = useCallback((id: string) => {
    setExpandidos((prev) => {
      const siguienteSet = new Set(prev);
      if (!siguienteSet.delete(id)) siguienteSet.add(id);
      return siguienteSet;
    });
  }, []);

  // La celda sale del ancho de la pantalla; el renglón mide exactamente celda + hueco, y con
  // eso la lista sabe dónde está cada cosa sin medir nada en pantalla.
  const lado = Math.floor((width - 2 * layout.screenPad - HUECO_CELDAS * (COLUMNAS - 1)) / COLUMNAS);
  const altoFila = lado + HUECO_CELDAS;

  const estrellas = useMemo(() => new Map([...estados].map(([n, e]) => [n, e.estrellas] as const)), [estados]);
  const pagados = useMemo(() => new Set([...(carga.datos?.pagados ?? []), ...abiertosAhora]), [carga.datos, abiertosAhora]);
  const bandas = useMemo<BandaDef[]>(
    () => (def?.bandas ?? []).map((b) => ({ id: b.id, nombre: b.nombre, desde: b.desde, hasta: b.hasta, frases: b.ids.length })),
    [def]
  );
  const tramos = useMemo(
    () => armarTramos(bandas, { total: def?.total ?? 0, siguiente, pagados, estrellas }),
    [bandas, def, siguiente, pagados, estrellas]
  );
  const items = useMemo(() => aplanar(tramos, expandidos), [tramos, expandidos]);
  const medidas = useMemo(() => medir(items, ALTO_TRAMO, altoFila), [items, altoFila]);
  const pegados = useMemo(() => indicesEncabezado(items), [items]);

  const getItemLayout = useCallback(
    (_: ArrayLike<ItemLista> | null | undefined, index: number) => ({
      length: medidas.alturas[index] ?? altoFila,
      offset: medidas.offsets[index] ?? 0,
      index,
    }),
    [medidas, altoFila]
  );

  // Al abrir, la lista deja el nivel actual centrado: con doscientos, obligar a bajar hasta
  // donde te quedaste es una molestia diaria. Sale de las medidas reales de la lista.
  const reducido = useMovimientoReducido();
  const indiceActual = useMemo(() => indiceDeNivel(items, siguiente), [items, siguiente]);
  const { listaRef, scrollY, alScroll, alMedir, posicionada, lejos, alVisibles, irAlActual } = useScrollNivel({
    medidas,
    indiceActual,
    hayDatos: Boolean(carga.datos),
  });

  // Al volver con estrellas nuevas (o un nivel actual nuevo), la celebración espera a que el mapa
  // esté en su lugar.
  const recompensaHallada = useRecompensaNiveles(juego, estrellas, siguiente, Boolean(carga.datos));
  const recompensa = posicionada ? recompensaHallada : SIN_RECOMPENSA;

  // El contador del encabezado arranca en la cifra de antes y rueda hasta la nueva cuando las
  // estrellas nuevas terminan de encenderse.
  const total = totalEstrellas(estrellas);
  const [contadoId, setContadoId] = useState(0);
  useEffect(() => {
    if (!posicionada || recompensaHallada.ganadas === 0 || contadoId === recompensaHallada.id) return;
    const t = setTimeout(
      () => setContadoId(recompensaHallada.id),
      RETRASO_LOGRO + recompensaHallada.ganadas * motionLogro.entreEstrellas
    );
    return () => clearTimeout(t);
  }, [posicionada, recompensaHallada, contadoId]);
  const cuenta = recompensaHallada.ganadas > 0 && contadoId !== recompensaHallada.id ? total - recompensaHallada.ganadas : total;

  // La entrada: los renglones que se montan mientras entra la pantalla aparecen escalonados, y las
  // estrellas del tramo actual se encienden en cascada. Pasado ese momento, lo que aparece al hacer
  // scroll no se anima.
  const [entrando, setEntrando] = useState(true);
  useEffect(() => {
    if (!posicionada) return;
    const t = setTimeout(() => setEntrando(false), motionDuration.coreografia);
    return () => clearTimeout(t);
  }, [posicionada]);
  const { filaBase, tramoActual } = useMemo(() => {
    const it = items[indiceActual];
    return it && it.tipo === 'fila'
      ? { filaBase: Math.max(0, it.fila - FILAS_ANTES_DEL_ACTUAL), tramoActual: it.tramo }
      : { filaBase: 0, tramoActual: null };
  }, [items, indiceActual]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ItemLista>) =>
      item.tipo === 'tramo' ? (
        <EncabezadoTramo tramo={item.tramo} expandido={item.expandido} onAlternar={alternarTramo} />
      ) : (
        <FilaNiveles
          niveles={item.niveles}
          lado={lado}
          onPress={alTocar}
          logros={recompensa.logros}
          saltoActual={recompensa.saltoActual}
          retrasoEntrada={entrando && !reducido ? escalon(Math.max(0, item.fila - filaBase)) : undefined}
          cascada={item.tramo === tramoActual}
        />
      ),
    [lado, alTocar, alternarTramo, recompensa, entrando, reducido, filaBase, tramoActual]
  );
  // Sin esto la lista no repinta renglones ya montados cuando cambia la recompensa o termina la entrada.
  const extraData = useMemo(() => ({ recompensa: recompensa.id, entrando }), [recompensa.id, entrando]);

  if (!def) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Niveles" />
        <Card>
          <Text style={styles.vacio}>
            No hay niveles cargados para este juego. Corre
            scripts/genera_niveles.py.
          </Text>
        </Card>
      </Screen>
    );
  }

  // La acción principal, en la zona del pulgar: jugar el nivel que sigue. Con los 200 jugados no hay «actual».
  const hayActual = Boolean(carga.datos) && siguiente <= def.total;

  const contenido = (
    <Screen
      padded={false}
      footer={
        hayActual ? (
          <Button
            label={`Jugar nivel ${siguiente}`}
            size="lg"
            full
            onPress={() => {
              const ruta = RUTA[juego];
              if (ruta) nav.navigate(ruta, { nivel: siguiente });
            }}
          />
        ) : undefined
      }
    >
      <EncabezadoNiveles
        titulo={def.nombre}
        estrellas={carga.datos ? cuenta : null}
        maximo={def.total * 3}
        scrollY={scrollY}
        onBack={() => nav.goBack()}
      />

      <Carga carga={carga} esqueleto={<View style={styles.esqueleto}><SkeletonLista filas={6} alto={68} /></View>}>
        {() => (
          // Hasta que la lista se posiciona en el nivel actual no se ve: sin esto se vería un destello arriba.
          <View style={[styles.lista, { opacity: posicionada ? 1 : 0 }]} onLayout={alMedir}>
            <Animated.FlatList
              ref={listaRef}
              data={items}
              renderItem={renderItem}
              keyExtractor={(it) => it.key}
              getItemLayout={getItemLayout}
              extraData={extraData}
              stickyHeaderIndices={pegados}
              onScroll={alScroll}
              scrollEventThrottle={16}
              onViewableItemsChanged={alVisibles}
              viewabilityConfig={CONFIGURACION_VISTA}
              initialNumToRender={12}
              maxToRenderPerBatch={8}
              windowSize={7}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={
                <Text style={styles.pie}>
                  Terminar un nivel abre el siguiente, saques una estrella o tres.
                  El que sigue del último también se abre con «Ver anuncio y abrir».
                  Rejugar nunca te baja lo que ya tenías.
                </Text>
              }
            />
          </View>
        )}
      </Carga>

      {/* Sobre la lista y encima del footer: el aviso del anuncio y, si te alejas del nivel actual, un atajo para volver. */}
      <View style={styles.flotante} pointerEvents="box-none">
        {aviso ? (
          <Animated.View
            entering={reducido ? undefined : aparecer()}
            exiting={reducido ? undefined : desaparecer()}
            style={styles.aviso}
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.avisoTexto}>{aviso}</Text>
          </Animated.View>
        ) : null}
        {posicionada && lejos ? (
          <Animated.View
            entering={reducido ? undefined : aparecer()}
            exiting={reducido ? undefined : desaparecer()}
            pointerEvents="box-none"
          >
            <Button
              label={`Ir al nivel ${siguiente}`}
              variant="secondary"
              icon={lejos === 'abajo' ? 'chevron-down' : 'chevron-up'}
              onPress={irAlActual}
            />
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );

  // Cada juego se abre una vez y queda abierto para siempre. El muro
  // deja ver los niveles por detras: se ve lo que hay, y eso es justo
  // lo que da ganas de abrirlo.
  return (
    <MuroDesbloqueo
      tipo="juego"
      id={juego}
      nombre={TITULOS[juego] ?? "Este juego"}
      detalle="200 niveles, todos con frases de tu catálogo."
      onVolver={() => nav.goBack()}
    >
      {contenido}
    </MuroDesbloqueo>
  );
}

const RUTA: Record<string, 'Colmena' | 'Pares' | 'Caida' | 'Dulces'> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caida',
  dulces: 'Dulces',
};

const styles = StyleSheet.create({
  esqueleto: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  lista: { flex: 1 },
  // Pegado abajo, sobre la lista y encima del footer (el footer queda fuera de este contenedor).
  flotante: { position: 'absolute', left: 0, right: 0, bottom: space.md, alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg },
  aviso: {
    alignSelf: 'stretch',
    backgroundColor: color.surfaceHigh,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.borderStrong,
    padding: space.md,
  },
  avisoTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text, textAlign: 'center', lineHeight: font.size.md * 1.5 },
  pie: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    margin: space.lg,
    marginBottom: space.xxxl,
  },
  vacio: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
