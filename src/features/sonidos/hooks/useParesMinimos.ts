import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { buildRounds, juzgar } from '@/domain/minimalPairs';
import { logHabla } from '@/data/repos/partidas';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { loadContent } from '@/data/contenido';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useEscucha } from '@/shared/hooks/useEscucha';
import * as speech from '@/services/voz';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import type { HablaVeredicto, ParMinimoRound } from '@/types';
import type { RootStackParams } from '@/types/rutas';
import { useEfectoResultado } from '@/shared/hooks/useEfectoResultado';

type Nav = NativeStackNavigationProp<RootStackParams>;

type Ruta = RouteProp<RootStackParams, 'MinimalPairs'>;

/**
 * Pares mínimos y di la palabra: rondas, escucha, veredicto y calificación.
 */
export function useParesMinimos() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const micHabilitado = useSettingsStore((s) => s.micHabilitado);
  const setSetting = useSettingsStore((s) => s.set);

  const content = useMemo(loadContent, []);
  const estado = useMemo(() => speech.isAvailable(), []);
  useCortarAudioAlSalir();

  // Si llega `fonemaId` (desde el laboratorio de sonidos), las rondas salen de los pares de ese fonema; si no
  // tiene pares, o no se abrió desde ahí, salen de todos como siempre.
  const [rounds] = useState<ParMinimoRound[]>(() => {
    const propios = params?.fonemaId
      ? buildRounds(content.fonemas.fonemas.filter((f) => f.id === params.fonemaId))
      : [];
    return propios.length > 0 ? propios : buildRounds(content.fonemas.fonemas);
  });
  const [idx, setIdx] = useState(0);
  const { fase, ocupado, sinVoz, nivel, escuchar: escucharVoz } = useEscucha();
  // Dónde se reconoce la voz en este teléfono: lo dice la línea de privacidad de abajo.
  const [enDispositivo, setEnDispositivo] = useState<boolean | null>(null);
  useEffect(() => {
    let vivo = true;
    void speech.reconoceEnDispositivo().then((v) => {
      if (vivo) setEnDispositivo(v);
    });
    return () => {
      vivo = false;
    };
  }, []);
  const [veredicto, setVeredicto] = useState<HablaVeredicto | null>(null);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  const efecto = useEfectoResultado();
  const { disparar } = efecto;

  useEffect(() => {
    if (!veredicto) return;
    disparar(veredicto.tipo === 'acierto' ? 'acierto' : veredicto.tipo === 'confusa' ? 'fallo' : null);
  }, [veredicto, disparar]);
  const [aciertos, setAciertos] = useState(0);
  const [fallidos, setFallidos] = useState(0);

  const round = rounds[idx];

  const escuchar = useCallback(async () => {
    if (!round || ocupado) return;

    // Antes de tocar el micrófono, la hoja que dice adónde va la voz. «Ahora no» sigue sin micro.
    if (!(await pedirConsentimiento('microfono'))) {
      setVeredicto({
        tipo: 'no_disponible',
        razon: 'Sin el micrófono no hay forma de escuchar. Toca «Escuchar» cuando quieras activarlo.',
      });
      return;
    }

    if (!micHabilitado) {
      const ok = await speech.requestPermission();
      if (!ok) {
        setVeredicto({
          tipo: 'no_disponible',
          razon: 'Sin permiso de micrófono no se puede escuchar. Se activa en los ajustes del teléfono.',
        });
        return;
      }
      if (user) await setSetting(user.id, 'micHabilitado', true);
    }

    setVeredicto(null);

    const oido = await escucharVoz([round.objetivo, round.confusa]);
    // Ya había una escucha en curso (doble toque): esta no cuenta.
    if (!oido) return;

    const v = juzgar(round, oido.alternativas, content.confusionesVoz.pares);
    setVeredicto(v);

    if (v.tipo === 'acierto') {
      haptics.success();
      void audio.playSuccess();
      setAciertos((a) => a + 1);
      setFallidos(0);
    } else if (v.tipo === 'confusa') {
      haptics.failure();
      void audio.playFail();
      setFallidos(0);
    } else {
      // Ni acierto ni error del usuario: el reconocedor no entendió.
      // No se cuenta como fallo: se pide repetir.
      setFallidos((f) => f + 1);
    }

    // Todo intento queda con sus alternativas (para ver después qué palabras fallan más). Los «no te entendí» no
    // cuentan en los resúmenes (ver HABLA_CUENTA en db/economy.ts).
    if (user && v.tipo !== 'no_disponible') {
      await logHabla(user.id, round.id, round.objetivo, v.tipo, v.oido, v.alternativas);
    }
  }, [round, ocupado, micHabilitado, user, setSetting, pedirConsentimiento, escucharVoz, content]);

  const siguiente = useCallback(() => {
    setVeredicto(null);
    setFallidos(0);
    if (idx + 1 >= rounds.length) {
      nav.replace('GameEnd', {
        juego: 'pares_minimos',
        rondas: rounds.length,
        aciertos,
      });
      return;
    }
    setIdx((i) => i + 1);
  }, [idx, rounds.length, aciertos, nav]);

  return { nav, estado, rounds, idx, fase, ocupado, sinVoz, nivel, enDispositivo, veredicto, hoja, efecto, fallidos, round, escuchar, siguiente };
}
