import { useCallback, useMemo, useRef, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { DURACION_VUELO, type Vuelo } from '@/features/juegos/colmena/components/Hexagono';
import type { Colocada, RechazoFicha } from '@/features/juegos/colmena/components/Panal';
import { fuenteDeRanura } from '@/features/juegos/colmena/components/RanurasPalabra';
import { disposicionPanal, distribuirRanuras, fichasParaCompletar, retrasoVuelo } from '@/features/juegos/colmena/logic/geometria';
import { formaPalabras } from '@/domain/texto';
import { layout, space } from '@/theme';
import type { ColmenaRound } from '@/types';

/** Las ranuras de la frase: 32 × 40, con los espacios de la escala (letras, palabras y líneas). */
const RANURAS = {
  hueco: space.xs,
  entrePalabras: space.lg,
  entreLineas: space.sm,
  anchoBase: 32,
  altoBase: 40,
  anchoMin: 12,
};

/**
 * El panal: cada fila mide `layout.tapMin` de alto (esa es el área táctil de cada ficha). El hueco es de 5 y no de 4
 * para que la sexta columna quepa en los 328 dp de un teléfono de 360.
 */
const PANAL = { toqueMin: layout.tapMin, hueco: 5 };

/**
 * Lo que solo se dibuja en Colmena: dónde van las ranuras y el panal, qué fichas vuelan y hacia dónde, y la
 * última letra que no iba. No decide nada de la ronda.
 */
export function useTableroColmena(round: ColmenaRound | undefined) {
  const [colocadas, setColocadas] = useState<Colocada[]>([]);
  const [rechazo, setRechazo] = useState<RechazoFicha | null>(null);
  const rechazoId = useRef(0);
  // Dónde queda cada caja en el contenido del scroll: los vuelos se calculan contra estas dos.
  const origenRanuras = useRef({ x: 0, y: 0 });
  const origenPanal = useRef({ x: 0, y: 0 });

  const { width: anchoVentana } = useWindowDimensions();
  // La forma de las palabras solo dibuja: la comparación sigue siendo sobre `objetivo`, sin espacios.
  const forma = useMemo(() => {
    if (!round) return [];
    const largos = formaPalabras(round.entry.phrase_tts);
    // Por si algún día la forma no suma lo que hay que armar: una sola palabra, sin perder ninguna letra.
    return largos.reduce((a, n) => a + n, 0) === round.objetivo.length ? largos : [round.objetivo.length];
  }, [round]);
  const distribucion = useMemo(
    () => distribuirRanuras(forma, anchoVentana - space.lg * 2, RANURAS),
    [forma, anchoVentana]
  );
  const disposicion = useMemo(
    () => disposicionPanal(round?.letras.length ?? 0, anchoVentana - space.lg * 2, PANAL),
    [round, anchoVentana]
  );
  // Cada letra aparece en su ranura cuando llega la ficha que vuela hasta ella.
  const retrasos = useMemo(() => {
    const r: number[] = [];
    for (const c of colocadas) r[c.ranura] = c.retraso + DURACION_VUELO;
    return r;
  }, [colocadas]);

  const aterrizaMs = useMemo(() => retrasos.reduce((m, r) => Math.max(m, r ?? 0), 0), [retrasos]);

  /** El vuelo de una ficha del panal a una ranura, del centro de una al centro de la otra. */
  const vueloA = useCallback(
    (ficha: number, ranura: number, tipo: Vuelo['tipo'], retraso: number): Vuelo | null => {
      const h = disposicion.hexagonos[ficha];
      const r = distribucion.ranuras[ranura];
      if (!h || !r) return null;
      const centroFichaX = origenPanal.current.x + h.x + disposicion.hexAncho / 2;
      const centroFichaY = origenPanal.current.y + h.y + disposicion.hexAlto / 2;
      const centroRanuraX = origenRanuras.current.x + r.x + distribucion.ranuraAncho / 2;
      const centroRanuraY = origenRanuras.current.y + r.y + distribucion.ranuraAlto / 2;
      return {
        dx: centroRanuraX - centroFichaX,
        dy: centroRanuraY - centroFichaY,
        ranuraAncho: distribucion.ranuraAncho,
        ranuraAlto: distribucion.ranuraAlto,
        fuente: fuenteDeRanura(distribucion.ranuraAncho),
        retraso,
        tipo,
      };
    },
    [disposicion, distribucion]
  );

  /** Las fichas que faltan vuelan una por una a su ranura («No me sale» y el tiempo). Solo dibuja. */
  const volarFaltantes = useCallback(
    (usadas: number[], armado: string) => {
      if (!round) return;
      const fichas = fichasParaCompletar(round.letras, usadas, round.objetivo, armado.length);
      const nuevas: Colocada[] = [];
      fichas.forEach((ficha, j) => {
        const ranura = armado.length + j;
        const vuelo = vueloA(ficha, ranura, 'ayuda', retrasoVuelo(j, fichas.length));
        if (vuelo) nuevas.push({ ...vuelo, ficha, ranura });
      });
      setColocadas((prev) => [...prev, ...nuevas]);
    },
    [round, vueloA]
  );

  /** La ficha se asoma hacia la ranura que sigue y regresa; ahí no hay nada que descontar. */
  const rechazar = useCallback(
    (ficha: number, ranura: number) => {
      const hacia = vueloA(ficha, ranura, 'toque', 0);
      if (hacia) setRechazo({ id: ++rechazoId.current, ficha, dx: hacia.dx, dy: hacia.dy });
    },
    [vueloA]
  );

  /** La ficha tocada (o la de la pista) vuela a su ranura. */
  const colocar = useCallback(
    (ficha: number, ranura: number, viaPista: boolean, retraso: number) => {
      const vuelo = vueloA(ficha, ranura, viaPista ? 'pista' : 'toque', retraso);
      if (vuelo) setColocadas((prev) => [...prev, { ...vuelo, ficha, ranura }]);
    },
    [vueloA]
  );

  /** Lo de la ronda que se deja se limpia junto con el cambio. */
  const limpiar = useCallback(() => {
    setColocadas([]);
    setRechazo(null);
  }, []);

  return {
    forma,
    distribucion,
    disposicion,
    retrasos,
    aterrizaMs,
    colocadas,
    rechazo,
    origenRanuras,
    origenPanal,
    volarFaltantes,
    rechazar,
    colocar,
    limpiar,
  };
}
