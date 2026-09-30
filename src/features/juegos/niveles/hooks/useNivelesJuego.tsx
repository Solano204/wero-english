import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDesbloqueo } from '@/estado/useDesbloqueo';
import { useWindowDimensions, type ListRenderItemInfo } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { pedirRecompensa, razonMuro } from '@/shared/ui';
import { ALTO_TRAMO, EncabezadoTramo } from '@/features/juegos/niveles/components/EncabezadoTramo';
import { useScrollNivel } from '@/features/juegos/niveles/hooks/useScrollNivel';
import { FilaNiveles, HUECO_CELDAS } from '@/features/juegos/niveles/components/FilaNiveles';
import { RETRASO_LOGRO } from '@/features/juegos/niveles/components/CeldaNivel';
import { SIN_RECOMPENSA, useRecompensaNiveles } from '@/features/juegos/niveles/hooks/useRecompensaNiveles';
import { abrirConAnuncio, getNiveles, nivelDesbloqueado, nivelesPagados, type NivelEstado } from '@/data/repos/niveles';
import { COLUMNAS, aplanar, armarTramos, indiceDeNivel, indicesEncabezado, medir, totalEstrellas, type BandaDef, type EstadoNivel, type ItemLista } from '@/domain/niveles';
import { useCarga } from '@/shared/hooks/useCarga';
import { useAuthStore } from '@/estado/useAuthStore';
import { loadContent } from '@/data/contenido';
import { ANUNCIOS_ACTIVOS } from '@/config/monetizacion';
import { escalon, layout, motionDuration, motionLogro } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

const SIN_ESTADOS = new Map<number, NivelEstado>();

type Ruta = RouteProp<RootStackParams, 'Niveles'>;

/** Cuánto se queda el aviso de un anuncio que falló. */
const DURACION_AVISO_MS = 5000;

/** La entrada escalonada cuenta desde unos renglones arriba del nivel actual (lo que cabe en pantalla). */
const FILAS_ANTES_DEL_ACTUAL = 4;

export const RUTA: Record<string, 'Colmena' | 'Pares' | 'Caida' | 'Dulces'> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caida',
  dulces: 'Dulces',
};

/**
 * El mapa de niveles de un juego: carga de estados, recompensas, desbloqueos y el nivel que sigue.
 */
export function useNivelesJuego() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const content = loadContent();
  const { width, height } = useWindowDimensions();

  const juego = params.juego;
  const muro = useDesbloqueo('juego', juego);
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
  // `saltar` lee el candado de aquí: con `abriendo` en sus dependencias, cada anuncio cambiaba
  // `alTocar` y `renderItem`, y la lista repintaba todos los renglones montados dos veces.
  const abriendoRef = useRef(false);
  const [expandidos, setExpandidos] = useState<ReadonlySet<string>>(new Set());

  // El aviso cuando el anuncio falla o se cierra antes de tiempo: unos segundos y se va.
  const [aviso, setAviso] = useState<string | null>(null);
  const temporizadorAviso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const avisar = (mensaje: string) => {
    setAviso(mensaje);
    if (temporizadorAviso.current) clearTimeout(temporizadorAviso.current);
    temporizadorAviso.current = setTimeout(() => setAviso(null), DURACION_AVISO_MS);
  };
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
  const saltar = async (nivel: number) => {
    if (!user || abriendoRef.current) return;
    abriendoRef.current = true;
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
    abriendoRef.current = false;
    setAbriendo(false);
  };

  const alTocar = (n: number, estado: EstadoNivel) => {
    if (estado === 'anuncio') {
      void saltar(n);
      return;
    }
    if (estado === 'bloqueado') return;
    const ruta = RUTA[juego];
    if (ruta) nav.navigate(ruta, { nivel: n });
  };

  const alternarTramo = (id: string) => {
    setExpandidos((prev) => {
      const siguienteSet = new Set(prev);
      if (!siguienteSet.delete(id)) siguienteSet.add(id);
      return siguienteSet;
    });
  };

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
  const tramos = useMemo(() => {
    const t = armarTramos(bandas, { total: def?.total ?? 0, siguiente, pagados, estrellas });
    if (ANUNCIOS_ACTIVOS) return t;
    // Interruptor de monetización: sin anuncios no se ofrece abrir un nivel
    // adelantado. La celda se ve bloqueada, como cualquier otra a la que
    // todavía no le toca; la progresión real (`siguiente`, `pagados`) no cambia.
    return t.map((tr) => ({
      ...tr,
      niveles: tr.niveles.map((v) => (v.estado === 'anuncio' ? { ...v, estado: 'bloqueado' as const } : v)),
    }));
  }, [bandas, def, siguiente, pagados, estrellas]);
  const items = useMemo(() => aplanar(tramos, expandidos), [tramos, expandidos]);
  const medidas = medir(items, ALTO_TRAMO, altoFila);
  const pegados = indicesEncabezado(items);

  const getItemLayout = (_: ArrayLike<ItemLista> | null | undefined, index: number) => ({
    length: medidas.alturas[index] ?? altoFila,
    offset: medidas.offsets[index] ?? 0,
    index,
  });

  // Al abrir, la lista deja el nivel actual centrado: con doscientos, obligar a bajar hasta
  // donde te quedaste es una molestia diaria. Sale de las medidas reales de la lista.
  const reducido = useMovimientoReducido();
  const indiceActual = useMemo(() => indiceDeNivel(items, siguiente), [items, siguiente]);
  const { listaRef, scrollY, alScroll, alMedir, posicionada, lejos, alVisibles, irAlActual, actualEnVista } = useScrollNivel({
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

  // Solo los renglones que se ven al entrar se animan (y encienden su cascada): la lista monta
  // varias pantallas de renglones de una vez, y animar los que están fuera de la vista eran
  // cientos de resortes de estrellas que nadie ve, justo mientras la pantalla entra.
  const filasEnVista = Math.ceil(height / altoFila) + 1;
  const renderItem = ({ item }: ListRenderItemInfo<ItemLista>) =>
    item.tipo === 'tramo' ? (
      <EncabezadoTramo tramo={item.tramo} expandido={item.expandido} onAlternar={alternarTramo} />
    ) : (
      <FilaNiveles
        niveles={item.niveles}
        lado={lado}
        onPress={alTocar}
        logros={recompensa.logros}
        saltoActual={recompensa.saltoActual}
        retrasoEntrada={
          entrando && !reducido && item.fila - filaBase >= -FILAS_ANTES_DEL_ACTUAL && item.fila - filaBase <= filasEnVista
            ? escalon(Math.max(0, item.fila - filaBase))
            : undefined
        }
        cascada={item.tramo === tramoActual}
      />
    );
  // Sin esto la lista no repinta renglones ya montados cuando cambia la recompensa o termina la entrada.
  const extraData = ({ recompensa: recompensa.id, entrando });

  return { nav, juego, muro, def, carga, siguiente, aviso, lado, items, pegados, getItemLayout, reducido, listaRef, scrollY, alScroll, alMedir, posicionada, lejos, alVisibles, irAlActual, actualEnVista, cuenta, renderItem, extraData };
}
