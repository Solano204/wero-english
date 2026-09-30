import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { juzgar } from '@/domain/minimalPairs';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useEscucha } from '@/shared/hooks/useEscucha';
import * as speech from '@/services/voz';
import type { ResultadoEscucha } from '@/services/voz';
import { loadContent } from '@/data/contenido';
import { normalizeAnswer } from '@/domain/texto';
import type { ParMinimoRound } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Resultado = 'acierto' | 'confusa' | 'no_entendi';

/** Los cinco pares de la prueba de antes y después. */
export const PARES: [string, string][] = [
  ['ship', 'sheep'],
  ['bit', 'beat'],
  ['cat', 'cut'],
  ['live', 'leave'],
  ['full', 'fool'],
];

const ronda = (objetivo: string, confusa: string): ParMinimoRound => ({
  id: `prueba:${objetivo}`,
  objetivo,
  confusa,
  objetivoIpa: '',
  objetivoEs: '',
  confusaEs: '',
  audioObjetivo: '',
  fonema: '',
  elErrorTipico: '',
});

/**
 * Cómo se juzgaba ANTES (hasta la versión anterior de minimalPairs.ts): solo la primera alternativa y solo la palabra
 * exacta. Se deja aquí, en la pantalla de prueba, para comparar las dos formas sobre los MISMOS intentos.
 */
export function juzgarAntes(r: ParMinimoRound, e: ResultadoEscucha): Resultado {
  const primera = e.origen === 'final' ? e.alternativas[0]?.texto : undefined;
  if (!primera) return 'no_entendi';
  const palabras = normalizeAnswer(primera).split(' ');
  if (palabras.includes(normalizeAnswer(r.objetivo))) return 'acierto';
  if (palabras.includes(normalizeAnswer(r.confusa))) return 'confusa';
  return 'no_entendi';
}

interface Intento {
  par: string;
  /** Lo que la persona dijo que iba a decir. */
  dije: 'objetivo' | 'confusa';
  antes: Resultado;
  despues: Resultado;
}

/** «Correcto» = el juez dijo lo que la persona sí dijo (la buena → acierto; la otra → confusa). */
const correcto = (i: Intento, r: Resultado) => (i.dije === 'objetivo' ? r === 'acierto' : r === 'confusa');

/**
 * Probar la voz: las voces disponibles y la prueba.
 */
export function useProbarVoz() {
  const nav = useNavigation<Nav>();
  useCortarAudioAlSalir();
  const disponible = useMemo(() => speech.isAvailable(), []);
  const variantes = useMemo(() => loadContent().confusionesVoz.pares, []);
  const { fase, ocupado, sinVoz, parcial, nivel, escuchar } = useEscucha();
  const [par, setPar] = useState(0);
  const [dije, setDije] = useState<'objetivo' | 'confusa'>('objetivo');
  const [ultimo, setUltimo] = useState<ResultadoEscucha | null>(null);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [enDispositivo, setEnDispositivo] = useState<boolean | null>(null);
  const [descarga, setDescarga] = useState<string | null>(null);

  useEffect(() => {
    void speech.reconoceEnDispositivo().then(setEnDispositivo);
  }, []);

  const [objetivo, confusa] = PARES[par] ?? PARES[0]!;
  const r = useMemo(() => ronda(objetivo, confusa), [objetivo, confusa]);

  const probar = useCallback(async () => {
    const ok = await speech.requestPermission();
    if (!ok) return;
    const e = await escuchar([r.objetivo, r.confusa]);
    if (!e) return;
    setUltimo(e);
    const despues = juzgar(r, e.alternativas, variantes);
    setIntentos((lista) => [
      ...lista,
      {
        par: `${r.objetivo}/${r.confusa}`,
        dije,
        antes: juzgarAntes(r, e),
        despues: despues.tipo === 'no_disponible' ? 'no_entendi' : despues.tipo,
      },
    ]);
  }, [escuchar, r, variantes, dije]);

  const veredicto = ultimo ? juzgar(r, ultimo.alternativas, variantes) : null;
  const porcentaje = (lista: Intento[], cual: 'antes' | 'despues') =>
    lista.length === 0 ? '—' : `${Math.round((lista.filter((i) => correcto(i, i[cual])).length / lista.length) * 100)} %`;

  return { nav, disponible, fase, ocupado, sinVoz, parcial, nivel, par, setPar, dije, setDije, ultimo, intentos, setIntentos, enDispositivo, descarga, setDescarga, objetivo, confusa, r, probar, veredicto, porcentaje };
}
