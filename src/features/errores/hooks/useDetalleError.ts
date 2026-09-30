import { useCallback, useMemo, useState } from 'react';
import { Share } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { textoParaCompartir } from '@/domain/errores';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { loadContent } from '@/data/contenido';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Rt = RouteProp<RootStackParams, 'ErrorDetail'>;

/**
 * El detalle de un error: la frase, sus fallos y la voz.
 */
export function useDetalleError() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Rt>();
  const content = useMemo(() => loadContent(), []);
  const [falloCompartir, setFalloCompartir] = useState(false);

  const err = content.errores.errores.find((e) => e.id === params.errorId);

  // Perder el foco (salir, abrir la frase completa) corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir();

  const compartir = useCallback(async () => {
    if (!err) return;
    setFalloCompartir(false);
    try {
      await Share.share({ message: textoParaCompartir(err) });
    } catch {
      setFalloCompartir(true);
    }
  }, [err]);

  return { nav, falloCompartir, err, compartir };
}
