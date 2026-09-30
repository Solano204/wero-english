import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, EmptyState, ErrorCarga, Header, Screen } from '@/components/base';
import { HuesoImagen, HuesoTexto, ProveedorEsqueleto } from '@/components/esqueleto';
import { BotonGuardar } from '@/components/detalle';
import type { Modo, Sonando } from '@/components/mazo/CartaFrase';
import { MazoCartas, MazoVacio, type ManejadorMazo } from '@/components/mazo/MazoCartas';
import { getRandomEntries, isFavorite, toggleFavorite } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
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
  /** Cambia con cada baraja nueva: el mazo se arma de cero (sus valores compartidos nunca retroceden dentro de una tanda). */
  const [tanda, setTanda] = useState(0);
  const mazo = useRef<ManejadorMazo>(null);

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
      setTanda((t) => t + 1);
      setBarajando(false);
    },
    [filter]
  );
  const loading = carga.estado === 'cargando';
  const cargar = carga.reintentar;

  const entry = pool[i];
  // Lo que el mazo avisa al terminar una salida puede llegar antes de que React pinte: la cuenta va también en una referencia.
  const iRef = useRef(0);
  iRef.current = i;
  const largoRef = useRef(0);
  largoRef.current = pool.length;
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

  // Perder el foco también corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir(() => {
    vozToken.current++;
    setSonando(null);
  });

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

  /** La carta de arriba empieza a irse: se corta la voz ANTES de cambiar de frase (un salto rápido dejaría sonando la que ya no se ve). */
  const alLanzar = useCallback(() => {
    haptics.tapLight();
    vozToken.current++;
    audio.stop();
    setSonando(null);
  }, []);

  /** La carta ya salió. Al acabarse la baraja el mazo queda vacío y se pide otra: nunca se repite dentro de la misma tanda. */
  const alAvanzar = useCallback(() => {
    const siguiente = iRef.current + 1;
    iRef.current = siguiente;
    if (siguiente >= largoRef.current) {
      setBarajando(true);
      setPool([]);
      void cargar();
      return;
    }
    setI(siguiente);
  }, [cargar]);

  const pedirSiguiente = useCallback(() => mazo.current?.siguiente(), []);

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

  /** Deslizar hacia arriba solo guarda: quitar una frase de Mi mazo se hace con el botón. */
  const guardarDeslizando = useCallback(() => {
    if (guardada) haptics.tapLight();
    else void alternarGuardada();
  }, [guardada, alternarGuardada]);

  if (carga.estado === 'error') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Frases sueltas" />
        <ErrorCarga onReintentar={carga.reintentar} />
      </Screen>
    );
  }

  // Mientras llega la baraja, o al acabarse las 60, el mazo se ve vacío en su mismo lugar: la pantalla no salta.
  const mazoVacio = (loading || barajando) && pool.length === 0;

  if (!entry && !mazoVacio) {
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

      <View style={styles.zona}>
        {entry ? (
          <MazoCartas
            key={tanda}
            ref={mazo}
            entradas={pool}
            actual={i}
            sonando={sonando}
            onSonar={sonar}
            guardada={guardada}
            onGuardar={alternarGuardada}
            onGuardarDeslizando={guardarDeslizando}
            alLanzar={alLanzar}
            alAvanzar={alAvanzar}
          />
        ) : loading ? (
          carga.demora ? (
            <ProveedorEsqueleto etiqueta="Barajando frases" style={styles.esqueletoCarta}>
              <HuesoImagen />
              <HuesoTexto lineas={2} style={styles.esqueletoTexto} />
            </ProveedorEsqueleto>
          ) : null
        ) : (
          <MazoVacio />
        )}
      </View>

      <View style={[styles.pie, !entry && styles.pieApagado]} pointerEvents={entry ? 'auto' : 'none'}>
        <View style={styles.boton}>
          <Button
            label="Siguiente"
            icon="arrow-right"
            iconAlFinal
            onPress={pedirSiguiente}
            size="lg"
            full
            style={styles.botonPie}
          />
        </View>
        <View style={styles.boton}>
          <BotonGuardar
            variante="secondary"
            guardada={guardada}
            pulso={pulso}
            onPress={alternarGuardada}
            style={styles.botonPie}
          />
        </View>
      </View>

      <Text style={styles.aviso}>Aquí no se lleva cuenta de nada. Solo pasa frases.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zona: { flex: 1 },
  esqueletoCarta: { flex: 1, padding: space.xl, justifyContent: 'center', gap: space.lg },
  esqueletoTexto: { alignItems: 'center' },
  pie: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  pieApagado: { opacity: 0.45 },
  boton: { flex: 1 },
  // Dos botones de `lg` en 360 dp: con el padding de `xl` «Siguiente» y su flecha no caben; con `md` sí.
  botonPie: { paddingHorizontal: space.md },
  aviso: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.sm,
  },
});
