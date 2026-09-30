import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { cancelAnimation, runOnJS, useSharedValue, withTiming } from 'react-native-reanimated';
import { conteoPorCategoria, encabezadoErrores, filtrarYOrdenar, normalizarOrden, type FiltroErrores, type OrdenErrores } from '@/domain/errores';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { motionDuration, motionEasing } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import type { RootStackParams } from '@/types/rutas';
import { sinEsperar } from '@/services/fallas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Vista = { cat: FiltroErrores; orden: OrdenErrores };

/**
 * Los errores: la lista de fallos y repasarlos.
 */
export function useErrores() {
  const nav = useNavigation<Nav>();
  const reducido = useMovimientoReducido();
  const user = useAuthStore((s) => s.user);
  const guardado = useSettingsStore((s) => s.ordenErrores);
  const guardarAjuste = useSettingsStore((s) => s.set);
  const content = loadContent();
  const todos = content.errores.errores;
  const total = content.errores.total;

  const [cat, setCat] = useState<FiltroErrores>('todos');
  const [orden, setOrden] = useState<OrdenErrores>(() => normalizarOrden(guardado));
  // Lo que se ve en la lista: cambia cuando la lista anterior terminó de salir.
  const [vista, setVista] = useState<Vista>({ cat: 'todos', orden: normalizarOrden(guardado) });
  const salida = useSharedValue(1);

  const cuentas = conteoPorCategoria(todos);
  const lista = filtrarYOrdenar(todos, vista.cat, vista.orden);
  const encabezado = encabezadoErrores(cat, cuentas[cat], total);

  useEffect(() => () => cancelAnimation(salida), [salida]);

  const alCambiarVista = (sig: Vista) => {
    setVista(sig);
    salida.set(1);
  };
  const cambiarVista = (sigCat: FiltroErrores, sigOrden: OrdenErrores) => {
    const sig: Vista = { cat: sigCat, orden: sigOrden };
    if (reducido) {
      setVista(sig);
      return;
    }
    salida.set(withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }, (fin) => {
      if (fin) runOnJS(alCambiarVista)(sig);
    }));
  };

  const elegirCategoria = (id: FiltroErrores) => {
    if (id === cat) return;
    setCat(id);
    cambiarVista(id, orden);
  };
  const elegirOrden = (id: OrdenErrores) => {
    if (id === orden) return;
    setOrden(id);
    if (user) sinEsperar(guardarAjuste(user.id, 'ordenErrores', id), 'ajustes:errores');
    cambiarVista(cat, id);
  };

  const abrir = (errorId: string) => nav.navigate('ErrorDetail', { errorId });

  return { nav, todos, cat, orden, vista, salida, cuentas, lista, encabezado, elegirCategoria, elegirOrden, abrir };
}
