import { useCallback, useEffect, useMemo, useState } from 'react';
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
  const content = useMemo(loadContent, []);
  const todos = content.errores.errores;
  const total = content.errores.total;

  const [cat, setCat] = useState<FiltroErrores>('todos');
  const [orden, setOrden] = useState<OrdenErrores>(() => normalizarOrden(guardado));
  // Lo que se ve en la lista: cambia cuando la lista anterior terminó de salir.
  const [vista, setVista] = useState<Vista>({ cat: 'todos', orden: normalizarOrden(guardado) });
  const salida = useSharedValue(1);

  const cuentas = useMemo(() => conteoPorCategoria(todos), [todos]);
  const lista = useMemo(() => filtrarYOrdenar(todos, vista.cat, vista.orden), [todos, vista]);
  const encabezado = encabezadoErrores(cat, cuentas[cat], total);

  useEffect(() => () => cancelAnimation(salida), [salida]);

  const alCambiarVista = useCallback(
    (sig: Vista) => {
      setVista(sig);
      salida.value = 1;
    },
    [salida]
  );
  const cambiarVista = useCallback(
    (sigCat: FiltroErrores, sigOrden: OrdenErrores) => {
      const sig: Vista = { cat: sigCat, orden: sigOrden };
      if (reducido) {
        setVista(sig);
        return;
      }
      salida.value = withTiming(0, { duration: motionDuration.rapido, easing: motionEasing.salir }, (fin) => {
        if (fin) runOnJS(alCambiarVista)(sig);
      });
    },
    [reducido, salida, alCambiarVista]
  );

  const elegirCategoria = useCallback(
    (id: FiltroErrores) => {
      if (id === cat) return;
      setCat(id);
      cambiarVista(id, orden);
    },
    [cat, orden, cambiarVista]
  );
  const elegirOrden = useCallback(
    (id: OrdenErrores) => {
      if (id === orden) return;
      setOrden(id);
      if (user) void guardarAjuste(user.id, 'ordenErrores', id);
      cambiarVista(cat, id);
    },
    [cat, orden, user, guardarAjuste, cambiarVista]
  );

  const abrir = useCallback((errorId: string) => nav.navigate('ErrorDetail', { errorId }), [nav]);

  return { nav, todos, cat, orden, vista, salida, cuentas, lista, encabezado, elegirCategoria, elegirOrden, abrir };
}
