import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '@/types/rutas';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useAuthStore } from '@/estado/useAuthStore';

type Vista = 'inicio' | 'usuario';

type Accion = 'google' | 'sin' | 'usuario' | 'vincular' | 'nueva' | null;

/**
 * La entrada: Google, usuario y contraseña, entrar sin cuenta y vincular el avance.
 */
export function useEntrada() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [vista, setVista] = useState<Vista>('inicio');
  const [accion, setAccion] = useState<Accion>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const {
    signIn,
    continuarSinCuenta,
    entrarConGoogle,
    resolverVinculo,
    cancelarVinculo,
    vinculoPendiente,
    aviso: avisoEntrada,
    limpiarAviso,
    busy,
    error,
    clearError,
  } = useAuthStore();

  useEffect(() => {
    clearError();
  }, [vista, clearError]);

  // Cada botón muestra su propia carga: el resto solo se bloquea.
  const correr = useCallback(async (quien: Accion, fn: () => Promise<unknown>) => {
    limpiarAviso();
    setAccion(quien);
    try {
      await fn();
    } finally {
      setAccion(null);
    }
  }, [limpiarAviso]);

  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();

  // Primero la hoja que dice qué se toma de Google; «Ahora no» deja la entrada como estaba.
  const conGoogle = useCallback(async () => {
    if (!(await pedirConsentimiento('google'))) return;
    await correr('google', entrarConGoogle);
  }, [correr, entrarConGoogle, pedirConsentimiento]);
  const sinCuenta = useCallback(() => correr('sin', continuarSinCuenta), [correr, continuarSinCuenta]);
  const conUsuario = useCallback(
    () => correr('usuario', () => signIn(username, password)),
    [correr, signIn, username, password]
  );

  return { nav, vista, setVista, accion, username, setUsername, password, setPassword, resolverVinculo, cancelarVinculo, vinculoPendiente, avisoEntrada, busy, error, correr, hoja, conGoogle, sinCuenta, conUsuario };
}
