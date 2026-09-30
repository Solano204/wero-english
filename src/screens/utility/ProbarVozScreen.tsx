import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Header, Screen } from '@/shared/ui';
import { MedidorMicrofono } from '@/shared/ui/MedidorMicrofono';
import { juzgar } from '@/domain/minimalPairs';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import { useEscucha } from '@/shared/hooks/useEscucha';
import * as speech from '@/services/voz';
import type { ResultadoEscucha } from '@/services/voz';
import { loadContent } from '@/data/contenido';
import { color, font, radius, space } from '@/theme';
import { normalizeAnswer } from '@/domain/texto';
import type { ParMinimoRound } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Resultado = 'acierto' | 'confusa' | 'no_entendi';

/** Los cinco pares de la prueba de antes y después. */
const PARES: [string, string][] = [
  ['ship', 'sheep'],
  ['bit', 'beat'],
  ['cat', 'cut'],
  ['live', 'leave'],
  ['full', 'fool'],
];

const ronda = (objetivo: string, confusa: string): ParMinimoRound => ({
  id: `prueba:${objetivo}`,
  objetivo,
  confusa,
  objetivoIpa: '',
  objetivoEs: '',
  confusaEs: '',
  audioObjetivo: '',
  fonema: '',
  elErrorTipico: '',
});

/**
 * Cómo se juzgaba ANTES (hasta la versión anterior de minimalPairs.ts): solo la primera alternativa y solo la palabra
 * exacta. Se deja aquí, en la pantalla de prueba, para comparar las dos formas sobre los MISMOS intentos.
 */
function juzgarAntes(r: ParMinimoRound, e: ResultadoEscucha): Resultado {
  const primera = e.origen === 'final' ? e.alternativas[0]?.texto : undefined;
  if (!primera) return 'no_entendi';
  const palabras = normalizeAnswer(primera).split(' ');
  if (palabras.includes(normalizeAnswer(r.objetivo))) return 'acierto';
  if (palabras.includes(normalizeAnswer(r.confusa))) return 'confusa';
  return 'no_entendi';
}

interface Intento {
  par: string;
  /** Lo que la persona dijo que iba a decir. */
  dije: 'objetivo' | 'confusa';
  antes: Resultado;
  despues: Resultado;
}

/** «Correcto» = el juez dijo lo que la persona sí dijo (la buena → acierto; la otra → confusa). */
const correcto = (i: Intento, r: Resultado) => (i.dije === 'objetivo' ? r === 'acierto' : r === 'confusa');

/**
 * Solo en __DEV__: «Probar reconocimiento». Eliges el par y cuál de las dos vas a decir, hablas, y se ve todo lo que
 * mandó el reconocedor: alternativas con su confianza, parciales, volumen, si fue en el teléfono y el veredicto de
 * antes y el de ahora. Abajo, la cuenta de los intentos de esta sesión: el porcentaje de veredictos correctos de cada
 * forma de juzgar, por par y en total (la prueba de 20 intentos con 5 pares).
 */
export function ProbarVozScreen() {
  const nav = useNavigation<Nav>();
  useCortarAudioAlSalir();
  const disponible = useMemo(() => speech.isAvailable(), []);
  const variantes = useMemo(() => loadContent().confusionesVoz.pares, []);
  const { fase, ocupado, sinVoz, parcial, nivel, escuchar } = useEscucha();
  const [par, setPar] = useState(0);
  const [dije, setDije] = useState<'objetivo' | 'confusa'>('objetivo');
  const [ultimo, setUltimo] = useState<ResultadoEscucha | null>(null);
  const [intentos, setIntentos] = useState<Intento[]>([]);
  const [enDispositivo, setEnDispositivo] = useState<boolean | null>(null);
  const [descarga, setDescarga] = useState<string | null>(null);

  useEffect(() => {
    void speech.reconoceEnDispositivo().then(setEnDispositivo);
  }, []);

  const [objetivo, confusa] = PARES[par] ?? PARES[0]!;
  const r = useMemo(() => ronda(objetivo, confusa), [objetivo, confusa]);

  const probar = useCallback(async () => {
    const ok = await speech.requestPermission();
    if (!ok) return;
    const e = await escuchar([r.objetivo, r.confusa]);
    if (!e) return;
    setUltimo(e);
    const despues = juzgar(r, e.alternativas, variantes);
    setIntentos((lista) => [
      ...lista,
      {
        par: `${r.objetivo}/${r.confusa}`,
        dije,
        antes: juzgarAntes(r, e),
        despues: despues.tipo === 'no_disponible' ? 'no_entendi' : despues.tipo,
      },
    ]);
  }, [escuchar, r, variantes, dije]);

  const veredicto = ultimo ? juzgar(r, ultimo.alternativas, variantes) : null;
  const porcentaje = (lista: Intento[], cual: 'antes' | 'despues') =>
    lista.length === 0 ? '—' : `${Math.round((lista.filter((i) => correcto(i, i[cual])).length / lista.length) * 100)} %`;

  if (!disponible.ok) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Probar reconocimiento" />
        <Text style={styles.texto}>{disponible.razon}</Text>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Probar reconocimiento" />

      <Card style={styles.card}>
        <Text style={styles.etiqueta}>Par</Text>
        <View style={styles.fila}>
          {PARES.map(([a, b], i) => (
            <Button key={a} label={`${a}/${b}`} variant={i === par ? 'secondary' : 'ghost'} onPress={() => setPar(i)} />
          ))}
        </View>
        <Text style={styles.etiqueta}>Voy a decir</Text>
        <View style={styles.fila}>
          <Button label={objetivo} variant={dije === 'objetivo' ? 'secondary' : 'ghost'} onPress={() => setDije('objetivo')} />
          <Button label={confusa} variant={dije === 'confusa' ? 'secondary' : 'ghost'} onPress={() => setDije('confusa')} />
        </View>
      </Card>

      <View style={styles.centro}>
        <MedidorMicrofono nivel={nivel} activo={fase === 'escuchando'} />
        <Text style={styles.texto}>{sinVoz ? 'No te escucho' : fase === 'inactivo' ? ' ' : fase}</Text>
        <Text style={styles.dato}>{parcial ? `Parcial: ${parcial}` : ' '}</Text>
        <Button label={ocupado ? 'Escuchando…' : 'Hablar'} onPress={() => void probar()} disabled={ocupado} full size="lg" />
      </View>

      <Card style={styles.card}>
        <Text style={styles.etiqueta}>Reconocedor</Text>
        <Text style={styles.dato}>
          {enDispositivo === null ? '…' : enDispositivo ? 'En el teléfono (sin conexión, en-US instalado)' : 'Del sistema (puede usar la nube)'}
        </Text>
        {!enDispositivo ? (
          <Button
            label="Descargar inglés sin conexión"
           
            variant="ghost"
            onPress={() => void speech.descargarInglesSinConexion().then(setDescarga)}
          />
        ) : null}
        {descarga ? <Text style={styles.dato}>{`Descarga: ${descarga}`}</Text> : null}
      </Card>

      {ultimo ? (
        <Card style={styles.card}>
          <Text style={styles.etiqueta}>Último intento</Text>
          <Text style={styles.dato}>{`Origen: ${ultimo.origen} · en el teléfono: ${ultimo.enDispositivo ? 'sí' : 'no'} · error: ${ultimo.error ?? '—'}`}</Text>
          <Text style={styles.dato}>{`Volumen máximo: ${ultimo.volumenMax.toFixed(1)}`}</Text>
          {ultimo.alternativas.map((a, i) => (
            <Text key={`${i}:${a.texto}`} style={styles.dato}>
              {`${i + 1}. ${a.texto}  (${a.confianza === null ? 'sin confianza' : a.confianza.toFixed(2)})`}
            </Text>
          ))}
          {ultimo.parciales.length > 0 ? <Text style={styles.dato}>{`Parciales: ${ultimo.parciales.join(' · ')}`}</Text> : null}
          <Text style={styles.texto}>{`Veredicto: ${veredicto?.tipo ?? '—'} · antes: ${juzgarAntes(r, ultimo)}`}</Text>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <Text style={styles.etiqueta}>{`Intentos: ${intentos.length} · correctos antes ${porcentaje(intentos, 'antes')} · ahora ${porcentaje(intentos, 'despues')}`}</Text>
        {PARES.map(([a, b]) => {
          const delPar = intentos.filter((i) => i.par === `${a}/${b}`);
          return (
            <Text key={a} style={styles.dato}>
              {`${a}/${b}: ${delPar.length} · antes ${porcentaje(delPar, 'antes')} · ahora ${porcentaje(delPar, 'despues')}`}
            </Text>
          );
        })}
        <Button label="Reiniciar la cuenta" variant="ghost" onPress={() => setIntentos([])} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm, marginBottom: space.md },
  fila: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  centro: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.textMuted },
  texto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  dato: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, borderRadius: radius.sm },
});
