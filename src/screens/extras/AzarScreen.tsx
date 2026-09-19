import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Badge, Button, Card, EmptyState, Header, Screen } from '@/components/base';
import { SceneImage } from '@/components/card';
import { getRandomEntries, toggleFavorite } from '@/db/queries';
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
/** Bloqueo de "→" contra doble toque. */
const AVANZAR_DEBOUNCE_MS = 400;
/** Velocidad de "Lento", igual que playSlow() por defecto. */
const VELOCIDAD_LENTA = 0.7;

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
 * Frases al azar, sin algoritmo.
 *
 * Todo lo demás en la app decide por el usuario: SM-2 elige qué toca
 * hoy, los mundos agrupan, los niveles ordenan. Esta pantalla no decide
 * nada, y por eso existe: es el modo de "a ver qué sale" para cuando
 * alguien abre la app sin querer estudiar y sin querer jugar.
 *
 * No escribe calificaciones SM-2. Pasar frases sin responder nada no es
 * un repaso y contarlo como tal ensuciaría la cola de mañana. Lo único
 * que sí hace es dejar guardar con estrella lo que llame la atención.
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
  const [vistas, setVistas] = useState(0);
  const [guardada, setGuardada] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);
  // Qué texto está sonando ahorita: la frase EN o el significado ES.
  const [sonando, setSonando] = useState<'en' | 'es' | null>(null);

  // Token de la reproducción de frase vigente (automática o manual). Cada
  // intento nuevo saca el suyo; el que ya no coincide con el vigente sabe
  // que otro le ganó el turno y se calla sin tocar el audio ni el state.
  const vozToken = useRef(0);
  const avanzarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cargar = useCallback(async () => {
    // Recargar la baraja corta cualquier voz de la tanda anterior.
    vozToken.current++;
    audio.stop();
    setSonando(null);
    setLoading(true);
    // Se piden de golpe y se recorren en orden: pedir una por una haría
    // una consulta por toque y se sentiría el salto.
    const list = await getRandomEntries(filter(), 60);
    setPool(list);
    setI(0);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const entry = pool[i];

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
      if (avanzarTimer.current) clearTimeout(avanzarTimer.current);
    };
  }, []);

  /** Reproduce EN, pausa, ES (si hay), resaltando el texto que suena. */
  const reproduceSecuencia = useCallback(async (e: Entry) => {
    const miToken = ++vozToken.current;
    await audio.playSequence(
      pasosSecuencia(e),
      () => vozToken.current === miToken,
      (idx) => setSonando(idx === 0 ? 'en' : 'es')
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
  const reproduceUna = useCallback(async (lang: 'en' | 'es', lento: boolean) => {
    const path = lang === 'en' ? entry?.audio_en ?? null : entry?.audio_es ?? null;
    const miToken = ++vozToken.current;
    setSonando(lang);
    await audio.playAndWait(path, lento ? { rate: VELOCIDAD_LENTA } : undefined);
    if (vozToken.current === miToken) setSonando(null);
  }, [entry]);

  const tocarEn = useCallback(() => {
    haptics.tapLight();
    void reproduceUna('en', false);
  }, [reproduceUna]);

  const tocarLento = useCallback(() => {
    haptics.tapLight();
    void reproduceUna('en', true);
  }, [reproduceUna]);

  const tocarEs = useCallback(() => {
    haptics.tapLight();
    void reproduceUna('es', false);
  }, [reproduceUna]);

  const tocarAmbos = useCallback(() => {
    if (!entry) return;
    haptics.tapLight();
    void reproduceSecuencia(entry);
  }, [entry, reproduceSecuencia]);

  const siguiente = useCallback(() => {
    if (bloqueado) return;
    haptics.tapLight();
    // Se corta la voz ANTES de cambiar de frase: sin esto, un salto
    // rápido deja sonando la frase que ya no se ve.
    vozToken.current++;
    audio.stop();
    setSonando(null);
    setGuardada(false);
    setVistas((v) => v + 1);
    setBloqueado(true);
    if (avanzarTimer.current) clearTimeout(avanzarTimer.current);
    avanzarTimer.current = setTimeout(() => setBloqueado(false), AVANZAR_DEBOUNCE_MS);
    // Al acabarse la baraja se pide otra. Nunca se repite dentro de la
    // misma tanda, que es lo que haría sentir la pantalla corta.
    if (i + 1 >= pool.length) {
      void cargar();
      return;
    }
    setI((n) => n + 1);
  }, [bloqueado, i, pool.length, cargar]);

  const guardar = useCallback(async () => {
    if (!user || !entry || guardada) return;
    await toggleFavorite(user.id, entry.id);
    setGuardada(true);
    haptics.success();
  }, [user, entry, guardada]);

  if (loading && pool.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Al azar" />
        <View style={styles.centro}>
          <Text style={styles.cargando}>Barajando…</Text>
        </View>
      </Screen>
    );
  }

  if (!entry) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Al azar" />
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
      <Header
        onBack={() => nav.goBack()}
        title="Al azar"
        right={<Text style={styles.contador}>{vistas}</Text>}
      />

      <View style={styles.cuerpo}>
        <Animated.View
          key={entry.id}
          entering={FadeIn.duration(260)}
          exiting={FadeOut.duration(120)}
          style={styles.tarjetaWrap}
        >
          <Card style={styles.tarjeta}>
            <View style={styles.hueco}>
              <SceneImage path={entry.imagen} size={180} ancha etiqueta={entry.phrase} />
            </View>

            <Text style={[styles.frase, sonando === 'en' && styles.sonando]}>
              {entry.phrase}
            </Text>
            {entry.ipa ? <Text style={styles.ipa}>{entry.ipa}</Text> : null}

            <View style={styles.filaAudio}>
              <Button label="🔊 Escuchar" variant="ghost" onPress={tocarEn} />
              <Button label="🐢 Lento" variant="ghost" onPress={tocarLento} />
            </View>

            <Text style={[styles.significado, sonando === 'es' && styles.sonando]}>
              {entry.spanish_main}
            </Text>

            <View style={styles.filaAudio}>
              {entry.audio_es ? (
                <Button label="🔊 Escuchar" variant="ghost" onPress={tocarEs} />
              ) : null}
              <Button label="▶ Ambos" variant="ghost" onPress={tocarAmbos} />
            </View>

            {entry.vulgaridad === 2 ? (
              <Badge label="Fuerte" tone="strong" />
            ) : entry.vulgaridad === 1 ? (
              <Badge label="Cuidado" tone="warn" />
            ) : null}

            {entry.note ? <Text style={styles.nota}>{entry.note}</Text> : null}
          </Card>
        </Animated.View>
      </View>

      <View style={styles.pie}>
        <Button
          label="→"
          accessibilityLabel="Otra frase"
          onPress={siguiente}
          disabled={bloqueado}
          size="lg"
          full
        />
        <Button
          label={guardada ? '★ guardada' : '☆ guardar'}
          accessibilityLabel="Guardar en mi mazo"
          variant="ghost"
          onPress={guardar}
          disabled={guardada}
          full
        />
      </View>

      <Text style={styles.aviso}>
        Aquí no se lleva cuenta de nada. Solo pasa frases.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contador: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textFaint },
  cuerpo: { flex: 1, justifyContent: 'center' },
  tarjetaWrap: { width: '100%' },
  tarjeta: { gap: space.md, alignItems: 'center' },
  /**
   * El hueco de la imagen se reserva siempre, exista el archivo o no.
   * Si el alto cambia según haya imagen, la tarjeta salta cada vez que
   * pasas de frase y el ojo pierde dónde estaba el texto.
   */
  hueco: { width: '100%', alignItems: 'center' },
  frase: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
  ipa: {
    fontSize: font.size.sm,
    color: color.textFaint,
    fontFamily: font.family.ipa,
  },
  significado: {
    fontFamily: font.family.body,
    fontSize: font.size.lg,
    color: color.textMuted,
    textAlign: 'center',
  },
  // El idioma que está sonando ahorita, resaltado sobre el otro.
  sonando: { color: color.accent },
  filaAudio: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    textAlign: 'center',
  },
  /*
   * Apilado, no en fila.
   *
   * En fila, el botón fantasma mide 44 de alto y el grande 58: no había
   * forma de alinearlos sin que uno flotara. Apilados comparten eje y la
   * acción principal queda clarísima.
   */
  pie: {
    gap: space.sm,
    marginTop: space.lg,
  },
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
