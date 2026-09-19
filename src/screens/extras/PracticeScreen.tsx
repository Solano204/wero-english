import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, ProgressBar, Screen } from '@/components/base';
import { getGameRecords, getHablaResumen, getRetoSemanal, getUsoModos } from '@/db/economy';
import { resumenTodos } from '@/db/levels';
import { getRecentDays } from '@/db/progress';
import { getStats } from '@/db/queries';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { PORTADA_JUEGO, color, font, radius, shadow, space, text } from '@/theme';
import { dayKey } from '@/utils/date';
import type { JuegoRecord, RetoSemanal } from '@/types';
import type { RootStackParams } from '@/navigation/routes';
import { FilaModo } from './practicar/FilaModo';
import { GrupoPlegable } from './practicar/GrupoPlegable';
import { ORDEN, elegirDestacados, elegirHoy, type ModoId, type MotivoHoy, type Uso } from './practicar/hoy';
import { GRUPOS, MODOS, type Modo } from './practicar/modos';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Resumen = Awaited<ReturnType<typeof getStats>>;

/** El botón de HOY dice qué va a pasar al tocarlo. */
function etiquetaHoy(motivo: MotivoHoy, modo: ModoId, atoradas: number): string {
  if (motivo === 'atoradas') return `Corregir ${atoradas} ${atoradas === 1 ? 'error' : 'errores'}`;
  if (motivo === 'ultimo') return `Seguir con ${MODOS[modo].titulo}`;
  return 'Empezar';
}

/**
 * Practicar: una sola cosa destacada (HOY), tres modos a mano y el resto
 * en grupos plegados. Ningún modo se quitó: solo cambió la jerarquía.
 *
 * HOY sale de lo que la app ya guarda (ver `elegirHoy`): frases atoradas,
 * el último modo usado o, sin historial, Frases al azar.
 */
export function PracticeScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const abiertos = useSettingsStore((s) => s.practicarGruposAbiertos);
  const guardarAjuste = useSettingsStore((s) => s.set);

  const [records, setRecords] = useState<Record<string, JuegoRecord>>({});
  const [reto, setReto] = useState<RetoSemanal | null>(null);
  const [habla, setHabla] = useState({ intentos: 0, dominados: 0 });
  const [niveles, setNiveles] = useState<
    Record<string, { jugados: number; estrellas: number; siguiente: number }>
  >({});
  const [stats, setStats] = useState<Resumen | null>(null);
  const [uso, setUso] = useState<Uso>({});
  const [hoyFrases, setHoyFrases] = useState(0);
  // Hasta que carga, HOY se maqueta pero no se ve ni se toca: si no, pintaría
  // el caso "usuario nuevo" un instante y luego saltaría a otro.
  const [listo, setListo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getGameRecords(user.id).then(setRecords);
      void getRetoSemanal(user.id).then(setReto);
      void getHablaResumen(user.id).then(setHabla);
      void resumenTodos(user.id).then(setNiveles);
      void Promise.all([getStats(user.id), getUsoModos(user.id), getRecentDays(user.id, 1)])
        .then(([s, u, dias]) => {
          setStats(s);
          setUso(u);
          setHoyFrases(dias[0]?.dia === dayKey() ? dias[0].respuestas : 0);
        })
        .catch((err) => console.warn('[Practicar] no se pudo leer el progreso', err))
        .finally(() => setListo(true));
    }, [user])
  );

  const atoradas = stats?.atoradas ?? 0;
  const racha = stats?.racha ?? 0;
  const hoy = elegirHoy(atoradas, uso);
  const destacados = elegirDestacados(uso, hoy.modo);
  const modoHoy = MODOS[hoy.modo];

  const datoHoy = [
    hoyFrases > 0 ? `Llevas ${hoyFrases} ${hoyFrases === 1 ? 'frase' : 'frases'} hoy` : null,
    racha > 0 ? `Racha: ${racha} ${racha === 1 ? 'día' : 'días'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  /** Con niveles, lo útil es dónde te quedaste; sin ellos, el mejor puntaje. */
  const marca = (juego: string): string | null => {
    const n = niveles[juego];
    if (n && n.jugados > 0) return `nivel ${n.siguiente} · ${n.estrellas} estrellas`;
    if (n) return 'nivel 1 · 200 niveles';
    const r = records[juego];
    return r && r.partidas > 0 ? `mejor: ${r.mejor}` : null;
  };

  const datoDe = (id: ModoId): string | null => {
    switch (id) {
      case 'colmena':
      case 'pares':
      case 'caida':
      case 'dulces':
      case 'cazala':
        return marca(id);
      case 'pares_minimos':
        return habla.dominados > 0 ? `${habla.dominados} pares limpios` : 'nuevo';
      case 'phrasal':
        return `${loadContent().phrasal.verbos.length} frases`;
      case 'atoran':
        return atoradas > 0 ? `${atoradas} frases` : null;
      case 'mazo':
        return stats && stats.favoritas > 0 ? `${stats.favoritas} guardadas` : null;
      default:
        return null;
    }
  };

  const alternar = (grupo: string) => {
    if (!user) return;
    const siguiente = abiertos.includes(grupo)
      ? abiertos.filter((g) => g !== grupo)
      : [...abiertos, grupo];
    void guardarAjuste(user.id, 'practicarGruposAbiertos', siguiente);
  };

  return (
    <Screen scroll>
      <View style={styles.bloques}>
        <View style={styles.bloque}>
          <Text style={styles.title}>Practicar</Text>
          <View style={styles.hoy}>
            <View
              style={listo ? styles.hoyContenido : styles.hoyOculto}
              accessibilityElementsHidden={!listo}
              importantForAccessibility={listo ? 'auto' : 'no-hide-descendants'}
            >
              <View style={styles.hoyTexto}>
                <Text style={styles.hoyEtiqueta}>Hoy</Text>
                <Text style={styles.hoyTitulo}>{modoHoy.titulo}</Text>
                <Text style={styles.hoyCuerpo}>{modoHoy.cuerpo}</Text>
              </View>
              <Button
                label={etiquetaHoy(hoy.motivo, hoy.modo, atoradas)}
                size="lg"
                full
                onPress={() => modoHoy.ir(nav)}
              />
              {datoHoy ? <Text style={styles.hoyDato}>{datoHoy}</Text> : null}
            </View>
          </View>
        </View>

        <View style={styles.bloque}>
          <Text style={text.h3}>Destacados</Text>
          {destacados.map((id) => (
            <Destacado key={id} modo={MODOS[id]} dato={datoDe(id)} onPress={() => MODOS[id].ir(nav)} />
          ))}
        </View>

        <View style={styles.bloque}>
          <Text style={text.h3}>Todo lo demás</Text>
          {GRUPOS.map((g) => {
            const ids = ORDEN.filter((id) => MODOS[id].grupo === g.id && !destacados.includes(id));
            return (
              <GrupoPlegable
                key={g.id}
                titulo={g.titulo}
                total={ids.length}
                abierto={abiertos.includes(g.id)}
                onAlternar={() => alternar(g.id)}
              >
                {ids.map((id, i) => (
                  <FilaModo
                    key={id}
                    titulo={MODOS[id].titulo}
                    dato={datoDe(id)}
                    primera={i === 0}
                    onPress={() => MODOS[id].ir(nav)}
                  />
                ))}
              </GrupoPlegable>
            );
          })}
        </View>

        {reto ? (
          <View style={styles.bloque}>
            <Text style={text.h3}>Esta semana</Text>
            <Card style={styles.reto}>
              <View style={styles.retoTop}>
                <Text style={styles.retoTitle}>Reto de la semana</Text>
                <Text style={styles.retoNum}>
                  {reto.llevas} de {reto.meta}
                </Text>
              </View>
              <ProgressBar value={Math.min(reto.llevas, reto.meta)} total={reto.meta} />
              <Text style={styles.retoBody}>
                {reto.cumplido
                  ? 'Cumplido. La semana que entra empieza otro.'
                  : 'Cuenta lo que aciertas estudiando y jugando. No hay reloj y no se pierde.'}
              </Text>
            </Card>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

interface DestacadoProps {
  modo: Modo;
  dato: string | null;
  onPress: () => void;
}

/** Tarjeta mediana: pesa menos que HOY y más que un renglón de grupo. */
function Destacado({ modo, dato, onPress }: DestacadoProps) {
  return (
    <Card
      onPress={onPress}
      style={styles.item}
      portada={modo.arte}
      imagen={PORTADA_JUEGO[modo.arte]}
      altoPortada={56}
    >
      <View style={styles.itemTop}>
        <Text style={styles.itemTitle}>{modo.titulo}</Text>
        {dato ? <Text style={styles.itemExtra}>{dato}</Text> : null}
      </View>
      <Text style={styles.itemBody} numberOfLines={2}>
        {modo.cuerpo}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  // Entre bloques 32; dentro de un bloque 16 (ESP-2).
  bloques: { gap: space.xxl },
  bloque: { gap: space.lg },
  title: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  // La única superficie de color de la app (ver tokens.ts, decisión 5).
  hoy: {
    backgroundColor: color.contraste,
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.lg,
    ...shadow.card,
  },
  hoyContenido: { gap: space.lg },
  hoyOculto: { gap: space.lg, opacity: 0, pointerEvents: 'none' },
  hoyTexto: { gap: space.sm },
  hoyEtiqueta: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: color.accent,
  },
  hoyTitulo: {
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
    color: color.onContraste,
  },
  hoyCuerpo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.onContraste,
  },
  hoyDato: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
  item: { gap: space.xs },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  itemTitle: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
    flexShrink: 1,
  },
  itemExtra: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  itemBody: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
  reto: { gap: space.sm },
  retoTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  retoTitle: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  retoNum: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.accent,
  },
  retoBody: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
});
