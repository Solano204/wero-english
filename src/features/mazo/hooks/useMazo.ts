import { useCallback, useEffect, useRef, useState, useLayoutEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getFavorites } from '@/data/repos/frases';
import { toggleFavorite } from '@/data/repos/tarjetas';
import { quitarDeLista, reinsertar } from '@/domain/guardadas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as haptics from '@/services/haptics';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { motionAviso } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Cuánto dura marcada la tarjeta que regresa con «Deshacer» como recién llegada, en ms. */
const REGRESO_MS = 600;

/** Lo que se acaba de quitar (con su lugar, para regresarla) o el fallo al guardar el cambio. */
type AvisoSinId = { tipo: 'quitada'; entry: Entry; indice: number } | { tipo: 'fallo' };

type Aviso = AvisoSinId & { id: number };

/** Sin frases todavía: un solo arreglo vacío, no uno nuevo en cada render. */
const SIN_ITEMS: Entry[] = [];

/**
 * El mazo: las frases guardadas, filtros y acciones.
 */
export function useMazo() {
  const nav = useNavigation<Nav>();
  const reducido = useMovimientoReducido();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const carga = useCarga(
    async () => (user ? getFavorites(user.id, filter()) : []),
    [user, filter],
    { alEnfocar: true, esVacio: (d) => d.length === 0 }
  );

  // La lista que se ve: sale de la base, pero al quitar una frase se recorta al momento (y se regresa al deshacer).
  const [lista, setLista] = useState<Entry[] | null>(null);
  const items = lista ?? carga.datos ?? SIN_ITEMS;
  const itemsRef = useRef(items);
  useLayoutEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    if (carga.datos) setLista(carga.datos);
  }, [carga.datos]);

  const [aviso, setAviso] = useState<Aviso | null>(null);
  const avisoRef = useRef(aviso);
  useLayoutEffect(() => {
    avisoRef.current = aviso;
  }, [aviso]);
  const [reinsertada, setReinsertada] = useState<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regreso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuenta = useRef(0);

  const soltarTemporizadores = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (regreso.current) clearTimeout(regreso.current);
    temporizador.current = null;
    regreso.current = null;
  }, []);
  useEffect(() => soltarTemporizadores, [soltarTemporizadores]);

  // Perder el foco (abrir el Detalle) corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir();

  const mostrar = (nuevo: AvisoSinId) => {
    cuenta.current += 1;
    setAviso({ ...nuevo, id: cuenta.current });
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setAviso(null), motionAviso.duracion);
  };

  const quitar = async (entry: Entry) => {
    if (!user) return;
    const r = quitarDeLista(itemsRef.current, entry.id);
    if (r.indice < 0) return;
    haptics.tapLight();
    setLista(r.lista);
    mostrar({ tipo: 'quitada', entry, indice: r.indice });
    try {
      await toggleFavorite(user.id, entry.id);
    } catch {
      // La base no guardó el cambio: la frase vuelve a su lugar y se avisa.
      setLista((l) => reinsertar(l ?? [], entry, r.indice));
      mostrar({ tipo: 'fallo' });
    }
  };

  const deshacer = async () => {
    const a = avisoRef.current;
    if (!user || !a || a.tipo !== 'quitada') return;
    soltarTemporizadores();
    setAviso(null);
    setReinsertada(a.entry.id);
    regreso.current = setTimeout(() => setReinsertada(null), REGRESO_MS);
    setLista((l) => reinsertar(l ?? [], a.entry, a.indice));
    try {
      await toggleFavorite(user.id, a.entry.id);
    } catch {
      setLista((l) => quitarDeLista(l ?? [], a.entry.id).lista);
      mostrar({ tipo: 'fallo' });
    }
  };

  const abrir = (e: Entry) => nav.navigate('Detail', { entryId: e.id });

  return { nav, reducido, carga, items, aviso, reinsertada, quitar, deshacer, abrir };
}
