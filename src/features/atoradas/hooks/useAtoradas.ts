import { useEffect, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getCardStates } from '@/data/repos/tarjetas';
import { getEntriesByIds, getStuckEntries } from '@/data/repos/frases';
import { candidatasDestrabadas, destrabadas, mismasVistas, normalizarVistas, ordenarAtoradas, vistasDe, type AtoradaVista } from '@/domain/atoradas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { motionDesatorar } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';
import { sinEsperar } from '@/services/fallas';

type Nav = NativeStackNavigationProp<RootStackParams>;

export type Atorada = { entry: Entry; fallos: number };

/** Una frase que se desatoró desde la última visita, con lo que tardará en arrancar su animación. */
type Desatorada = Atorada & { retraso: number };

interface Datos {
  atoradas: Atorada[];
  desatoradas: Atorada[];
  /** Lo que había guardado de la última visita: para saber si hay algo que volver a guardar. */
  previas: AtoradaVista[];
}

/**
 * Las frases atoradas: la lista, soltarlas y practicarlas.
 */
export function useAtoradas() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const carga = useCarga<Datos>(
    async () => {
      if (!user) return { atoradas: [], desatoradas: [], previas: [] };
      const atoradas = await getStuckEntries(user.id, 3, 30);
      const previas = normalizarVistas(useSettingsStore.getState().atoradasVistas);
      // Una que solo salió de la lista por el tope de 30 sigue atorada: se le pregunta a la base si de verdad se destrabó.
      const candidatas = candidatasDestrabadas(previas, atoradas.map((a) => a.entry.id));
      if (candidatas.length === 0) return { atoradas, desatoradas: [], previas };
      const estados = await getCardStates(user.id, candidatas.map((c) => c.id));
      const ganadas = destrabadas(candidatas, estados);
      const entradas = await getEntriesByIds(ganadas.map((g) => g.id));
      const porId = new Map(entradas.map((e) => [e.id, e]));
      const desatoradas = ganadas.flatMap((g) => {
        const entry = porId.get(g.id);
        return entry ? [{ entry, fallos: g.fallos }] : [];
      });
      return { atoradas, desatoradas, previas };
    },
    [user],
    { alEnfocar: true, esVacio: (d) => d.atoradas.length === 0 && d.desatoradas.length === 0 }
  );
  const items = ordenarAtoradas(carga.datos?.atoradas ?? []);

  // Lo que se guarda al terminar de cargar es la lista de ahora: la próxima visita compara contra ella.
  useEffect(() => {
    const d = carga.datos;
    if (!d || !user) return;
    const actuales = vistasDe(d.atoradas);
    if (!mismasVistas(d.previas, actuales)) sinEsperar(guardarAjuste(user.id, 'atoradasVistas', actuales), 'ajustes:atoradas');
  }, [carga.datos, user, guardarAjuste]);

  // Las desatoradas se muestran una sola vez, aunque la pantalla vuelva a cargar al recuperar el foco.
  const [mostrando, setMostrando] = useState<Desatorada[]>([]);
  const yaMostradas = useRef(new Set<number>());
  useEffect(() => {
    const nuevas = (carga.datos?.desatoradas ?? []).filter((d) => !yaMostradas.current.has(d.entry.id));
    if (nuevas.length === 0) return;
    nuevas.forEach((d) => yaMostradas.current.add(d.entry.id));
    setMostrando((m) => [...m, ...nuevas.map((d, i) => ({ ...d, retraso: i * motionDesatorar.escalon }))]);
  }, [carga.datos]);
  const retirar = (id: number) => setMostrando((m) => m.filter((d) => d.entry.id !== id));

  // Perder el foco (abrir el Detalle) corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir();

  const abrir = (e: Entry) => nav.navigate('Detail', { entryId: e.id });

  return { nav, carga, items, mostrando, retirar, abrir };
}
