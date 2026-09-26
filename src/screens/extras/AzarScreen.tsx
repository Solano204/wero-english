import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { BotonGuardar } from '@/components/detalle';
import { CartaFrase, type Modo, type Sonando } from '@/components/mazo/CartaFrase';
import { MAZO } from '@/domain/mazo';
import { getRandomEntries, isFavorite, toggleFavorite } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore, useSettingsStore } from '@/store';
import { useMusicaPantalla } from '@/hooks/useMusicaPantalla';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import { color, font, space } from '@/theme';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Entre el fin del audio EN y el arranque del ES, en la secuencia automática. */
const PAUSA_EN_ES_MS = 700;
/** Retraso antes de que arranque el audio solo, al mostrarse la tarjeta. */
const RETRASO_AUTO_MS = 250;
/** Velocidad de "Lento", igual que playSlow() por defecto. */
const VELOCIDAD_LENTA = 0.7;
/** Lo que le quita al ancho de la zona el filo de la carta (1 dp a cada lado) y su padding de `lg`. */
const RESTA_ANCHO_TEXTO = 2 + space.lg * 2;

/** Pasos de la secuencia EN → ES de una frase. Sin ES, solo suena el inglés. */
function pasosSecuencia(entry: Entry): { path: string | null; pauseMs: number }[] {
  return entry.audio_es
    ? [
        { path: entry.audio_en, pauseMs: PAUSA_EN_ES_MS },
        { path: entry.audio_es, pauseMs: 0 },
      ]
    : [{ path: entry.audio_en, pauseMs: 0 }];
}

/**
 * Frases sueltas, sin algoritmo.
 *
 * Todo lo demás en la app decide por el usuario: SM-2 elige qué toca
 * hoy, los mundos agrupan, los niveles ordenan. Esta pantalla no decide
 * nada, y por eso existe: es el modo de "a ver qué sale" para cuando
 * alguien abre la app sin querer estudiar y sin querer jugar.
 *
 * No escribe calificaciones SM-2. Pasar frases sin responder nada no es
 * un repaso y contarlo como tal ensuciaría la cola de mañana. Lo único
 * que sí hace es dejar guardar con estrella lo que llame la atención.
 * No lleva cuenta de nada: por eso no hay contador de frases vistas.
 */
export function AzarScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const autoAudio = useSettingsStore((s) => s.autoAudio);
  // Esta pantalla es puro oído: la música de fondo compite con la frase.
  useMusicaPantalla('silencio');

  const [pool, setPool] = useState<Entry[]>([]);
  const [i, setI] = useState(0);
  const [barajando, setBarajando] = useState(false);
  const [guardada, setGuardada] = useState(false);
  /** Sube en 1 cada vez que la frase de arriba pasa a guardada: dispara el anillo dorado del botón. */
  const [pulso, setPulso] = useState(0);
  const [sonando, setSonando] = useState<Sonando | null>(null);
  const [zona, setZona] = useState({ ancho: 0, alto: 0 });

  // Token de la reproducción de frase vigente (automática o manual). Cada
  // intento nuevo saca el suyo; el que ya no coincide con el vigente sabe
  // que otro le ganó el turno y se calla sin tocar el audio ni el state.
  const vozToken = useRef(0);

  const carga = useCarga(
    async () => {
      // Recargar la baraja corta cualquier voz de la tanda anterior.
      vozToken.current++;
      audio.stop();
      setSonando(null);
      // Se piden de golpe y se recorren en orden: pedir una por una haría
      // una consulta por toque y se sentiría el salto.
      const list = await getRandomEntries(filter(), 60);
      setPool(list);
      setI(0);
      setBarajando(false);
    },
    [filter]
  );
  const loading = carga.estado === 'cargando';
  const cargar = carga.reintentar;

  const entry = pool[i];
  const arribaRef = useRef<number | null>(null);
  arribaRef.current = entry?.id ?? null;

  // Corta la voz al salir de la pantalla o al ir a background, e
  // igual al desmontar (recarga en caliente, navegación hacia atrás).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') {
        vozToken.current++;
        audio.stop();
        setSonando(null);
      }
    });
    return () => {
      sub.remove();
      vozToken.current++;
      audio.stop();
    };
  }, []);

  // El estado real de la frase de arriba: sin esto, «Guardar» quitaría de Mi mazo una que ya estaba guardada.
  const entryId = entry?.id;
  useEffect(() => {
    if (!user || entryId === undefined) return;
    let vigente = true;
    setGuardada(false);
    void isFavorite(user.id, entryId).then((v) => {
      if (vigente) setGuardada(v);
    });
    return () => {
      vigente = false;
    };
  }, [user, entryId]);

  /** Reproduce EN, pausa, ES (si hay), resaltando el texto que suena. */
  const reproduceSecuencia = useCallback(async (e: Entry) => {
    const miToken = ++vozToken.current;
    await audio.playSequence(
      pasosSecuencia(e),
      () => vozToken.current === miToken,
      (idx) => setSonando({ modo: 'ambos', lengua: idx === 0 ? 'en' : 'es' })
    );
    if (vozToken.current === miToken) setSonando(null);
  }, []);

  // Audio automático al mostrarse cada frase: arranca ~250ms después,
  // cancelable por entry.id para que pasar rápido no dispare audios
  // viejos, y solo si "Voz automática" está prendida en Ajustes.
  useEffect(() => {
    if (!entry || !autoAudio) return;
    const t = setTimeout(() => {
      void reproduceSecuencia(entry);
    }, RETRASO_AUTO_MS);
    return () => {
      clearTimeout(t);
      vozToken.current++;
      audio.stop();
      setSonando(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry?.id, autoAudio]);

  /** Toque manual de un solo idioma: cancela lo que suene y reproduce solo eso. */
  const reproduceUna = useCallback(
    async (lang: 'en' | 'es', lento: boolean) => {
      const path = lang === 'en' ? entry?.audio_en ?? null : entry?.audio_es ?? null;
      const miToken = ++vozToken.current;
      setSonando({ modo: lang === 'es' ? 'es' : lento ? 'lento' : 'en', lengua: lang });
      await audio.playAndWait(path, lento ? { rate: VELOCIDAD_LENTA } : undefined);
      if (vozToken.current === miToken) setSonando(null);
    },
    [entry]
  );

  const sonar = useCallback(
    (modo: Modo) => {
      if (!entry) return;
      haptics.tapLight();
      if (modo === 'ambos') void reproduceSecuencia(entry);
      else void reproduceUna(modo === 'es' ? 'es' : 'en', modo === 'lento');
    },
    [entry, reproduceSecuencia, reproduceUna]
  );

  const siguiente = useCallback(() => {
    // Se corta la voz ANTES de cambiar de frase: sin esto, un salto
    // rápido deja sonando la frase que ya no se ve.
    vozToken.current++;
    audio.stop();
    setSonando(null);
    // Al acabarse la baraja el mazo queda vacío y se pide otra. Nunca se
    // repite dentro de la misma tanda, que es lo que haría sentir la pantalla corta.
    if (i + 1 >= pool.length) {
      setBarajando(true);
      setPool([]);
      void cargar();
      return;
    }
    setI((n) => n + 1);
  }, [i, pool.length, cargar]);

  const alternarGuardada = useCallback(async () => {
    if (!user || !entry) return;
    const ahora = await toggleFavorite(user.id, entry.id);
    // La frase de arriba pudo cambiar mientras se guardaba: el botón habla de la de ahora.
    if (arribaRef.current !== entry.id) return;
    setGuardada(ahora);
    if (ahora) {
      haptics.success();
      setPulso((p) => p + 1);
    }
  }, [user, entry]);

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Frases sueltas" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  if ((loading || barajando) && pool.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Frases sueltas" />
        <View style={styles.centro}>
          <Text style={styles.cargando}>Barajando…</Text>
        </View>
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Frases sueltas" />
        <EmptyState
          title="No salió nada"
          body="Con los filtros que traes puestos no hay frases disponibles. Prueba subiendo el nivel o quitando el modo limpio en Ajustes."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header onBack={() => nav.goBack()} title="Frases sueltas" />

      <View
        style={styles.zona}
        onLayout={(e) => setZona({ ancho: e.nativeEvent.layout.width, alto: e.nativeEvent.layout.height })}
      >
        {zona.alto > 0 ? (
          <CartaFrase
            key={entry.id}
            entry={entry}
            activa
            alto={zona.alto - MAZO.asoma * 2}
            ancho={zona.ancho - RESTA_ANCHO_TEXTO}
            sonando={sonando}
            onSonar={sonar}
            guardada={guardada}
            onSiguiente={siguiente}
            onGuardar={alternarGuardada}
          />
        ) : null}
      </View>

      <View style={styles.pie}>
        <View style={styles.boton}>
          <Button label="Siguiente" icon="arrow-right" iconAlFinal onPress={siguiente} size="lg" full />
        </View>
        <View style={styles.boton}>
          <BotonGuardar variante="secondary" guardada={guardada} pulso={pulso} onPress={alternarGuardada} />
        </View>
      </View>

      <Text style={styles.aviso}>Aquí no se lleva cuenta de nada. Solo pasa frases.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zona: { flex: 1, justifyContent: 'center' },
  pie: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  boton: { flex: 1 },
  aviso: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.sm,
  },
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cargando: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.md },
});
