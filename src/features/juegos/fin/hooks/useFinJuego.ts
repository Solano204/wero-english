import { useEffect, useMemo, useState, useEffectEvent } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { logGame } from '@/data/repos/partidas';
import { estrellasPara, guardarNivel } from '@/data/repos/niveles';
import { loadContent } from '@/data/contenido';
import { useAuthStore } from '@/estado/useAuthStore';
import { useMusicaPantalla } from '@/estado/useMusicaPantalla';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import { PARTIDA_PERFECTA, TRES_ESTRELLAS, elegirFrase } from '@/domain/frases';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Ruta = RouteProp<RootStackParams, 'GameEnd'>;

/**
 * El resumen al terminar una partida: estrellas, récord, lo que se guarda y la fanfarria.
 */
export function useFinJuego() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const [ocupado, setOcupado] = useState(false);

  const { juego, rondas, aciertos, nivel } = params;
  const content = useMemo(() => loadContent(), []);
  useMusicaPantalla('juegos');
  useCortarAudioAlSalir();

  /**
   * Las estrellas salen de los umbrales del nivel, que ya vienen
   * calculados en niveles.json. No se recalculan aquí: si la fórmula
   * viviera en dos lados, un día dirían cosas distintas.
   */
  const umbrales = useMemo(() => {
    if (!nivel) return null;
    const def = content.niveles.juegos[juego];
    return def?.niveles[nivel - 1]?.estrellas ?? null;
  }, [content, juego, nivel]);

  const estrellas = umbrales ? estrellasPara(aciertos, umbrales) : 0;

  const alMontar = useEffectEvent(() => {
    if (!user) return;

    void (async () => {
      await logGame(user.id, juego, rondas, aciertos);
      if (nivel && umbrales) {
        await guardarNivel(user.id, juego, nivel, estrellas, aciertos);
      }
    })();
    // Solo al montar: guardar dos veces sumaría dos intentos.
  });
  useEffect(() => alMontar(), []);

  const salir = () => nav.navigate('Main');

  const pct = rondas > 0 ? Math.round((aciertos / rondas) * 100) : 0;
  // Buen resultado: dos estrellas o más donde el juego las da (Niveles); en el
  // resto, cinco rondas o más con el 70 % de aciertos. Solo entonces hay fiesta.
  const merece = umbrales ? estrellas >= 2 : rondas >= 5 && pct >= 70;
  // Las felicitaciones se eligen una vez por pantalla, no en cada render.
  const perfecta = useMemo(
    () => elegirFrase(PARTIDA_PERFECTA).split('{n}').join(String(rondas)),
    [rondas]
  );
  const tresEstrellas = useMemo(() => elegirFrase(TRES_ESTRELLAS), []);

  const alMontar2 = useEffectEvent(() => {
    // Una sola vez, al mostrar el resultado. Sin buen resultado no suena nada:
    // ni el acierto ni el fallo, terminar una partida no es ninguno de los dos.
    if (merece) void audio.playNivelCompleto();
  });
  useEffect(() => alMontar2(), []);

  return { nav, juego, rondas, aciertos, nivel, umbrales, estrellas, salir, pct, merece, perfecta, tresEstrellas };
}
