import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, ProgressBar, Screen } from '@/components/base';
import { SectionTitle } from '@/components/list';
import { getGameRecords, getHablaResumen, getRetoSemanal } from '@/db/economy';
import { resumenTodos } from '@/db/levels';
import { countDue } from '@/db/queries';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import { PORTADA_JUEGO, color, font, radius, space } from '@/theme';
import type { JuegoRecord, RetoSemanal } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * P-23, el arcade. Antes era un menú plano de ocho modos.
 *
 * La competencia pone aquí cuatro barras en cero, dos candados y un
 * torneo con cuenta regresiva. Es la pantalla a la que llega alguien
 * que no trae ganas de estudiar, y le contesta con un muro.
 *
 * Aquí todo está abierto desde la instalación, cada juego enseña el
 * mejor puntaje del propio usuario y no el de nadie más, y el reto de
 * la semana no tiene reloj que pueda vencerse en contra.
 *
 * Ningún modo que ya existía se quitó: solo quedaron agrupados.
 */
export function PracticeScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);

  const [records, setRecords] = useState<Record<string, JuegoRecord>>({});
  const [reto, setReto] = useState<RetoSemanal | null>(null);
  const [due, setDue] = useState(0);
  const [habla, setHabla] = useState({ intentos: 0, dominados: 0 });
  const [niveles, setNiveles] = useState<
    Record<string, { jugados: number; estrellas: number; siguiente: number }>
  >({});

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      void getGameRecords(user.id).then(setRecords);
      void getRetoSemanal(user.id).then(setReto);
      void countDue(user.id, filter()).then(setDue);
      void getHablaResumen(user.id).then(setHabla);
      void resumenTodos(user.id).then(setNiveles);
    }, [user, filter])
  );

  /**
   * El renglón de la derecha. Con niveles, lo útil no es el mejor
   * puntaje sino dónde te quedaste: es lo que decide si tocas o no.
   */
  const marca = (juego: string): string | null => {
    const n = niveles[juego];
    if (n && n.jugados > 0) {
      return `nivel ${n.siguiente} · ${n.estrellas} estrellas`;
    }
    if (n) return 'nivel 1 · 200 niveles';
    const r = records[juego];
    if (!r || r.partidas === 0) return null;
    return `mejor: ${r.mejor}`;
  };

  return (
    <Screen scroll>
      <View style={styles.head}>
        <Text style={styles.title}>Practicar</Text>
      </View>

      {/* Lo que toca hoy, arriba de todo. Es la única fila que la
          competencia también tiene bien puesta en esta pantalla. */}
      <Card
        style={styles.repaso}
        accent={color.accent}
        portada="azar"
        imagen={PORTADA_JUEGO.azar}
        altoPortada={84}
        onPress={() => nav.navigate('Study', undefined)}
      >
        {/* Ya no hay cola ni pendientes: siempre hay algo que tocar. */}
        <Text style={styles.repasoTitle}>Frases al azar</Text>
        <Text style={styles.repasoBody}>
          Doce frases sueltas del catálogo, en unos tres minutos
        </Text>
      </Card>

      <SectionTitle title="Gramática" />
      <Text style={styles.nota}>
        Ochenta temas explicados desde el español.
      </Text>
      <View style={styles.list}>
        <Modo
          title="Gramática"
          body="Tiempos, modales, condicionales, phrasal verbs y qué decir en cada situación"
          tint={color.world.legal}
          arte="gramatica"
          go={() => nav.navigate('Gramatica')}
        />
      </View>

      <SectionTitle title="Juegos" />
      <Text style={styles.nota}>Todos abiertos. Ninguno con candado.</Text>
      <View style={styles.list}>
        <Modo
          title="Colmena"
          body="Arma la palabra letra por letra · 200 niveles"
          extra={marca('colmena')}
          tint={color.world.fonetica}
          arte="colmena"
          go={() => nav.navigate('Niveles', { juego: 'colmena' })}
        />
        <Modo
          title="Pares"
          body="Junta cada frase con su significado · 200 niveles"
          extra={marca('pares')}
          tint={color.world.dia_a_dia}
          arte="pares"
          go={() => nav.navigate('Niveles', { juego: 'pares' })}
        />
        <Modo
          title="Caída"
          body="Dos opciones bajando, contra reloj · 200 niveles"
          extra={marca('caida')}
          tint={color.riskStrong}
          arte="caida"
          go={() => nav.navigate('Niveles', { juego: 'caida' })}
        />
        <Modo
          title="Dulces"
          body="Tres en línea con frases al azar · 200 niveles"
          extra={marca('dulces')}
          tint={color.world.cultura}
          arte="dulces"
          go={() => nav.navigate('Niveles', { juego: 'dulces' })}
        />
        <Modo
          title="Cázala"
          body="Oye una frase rápida y di qué reducciones traía"
          extra={marca('cazala')}
          tint={color.world.cultura}
          arte="cazala"
          go={() => nav.navigate('Cazala')}
        />
      </View>

      <SectionTitle title="Tu boca y tu oído" />
      <View style={styles.list}>
        <Modo
          title="Di la palabra"
          body="Wero te escucha y te dice cuál palabra entendió"
          extra={
            habla.dominados > 0 ? `${habla.dominados} pares limpios` : 'nuevo'
          }
          tint={color.accent}
          arte="pares_minimos"
          go={() => nav.navigate('MinimalPairs', undefined)}
        />
        <Modo
          title="Modo oído"
          arte="oido"
          body="Escucha en el camión, sin tocar la pantalla"
          tint={color.world.dia_a_dia}
          go={() => nav.navigate('EarMode', undefined)}
        />
        <Modo
          title="Laboratorio de sonidos"
          arte="sonidos"
          body="Los 44 sonidos del inglés y los que no existen en español"
          tint={color.world.fonetica}
          go={() => nav.navigate('Pronunciation', undefined)}
        />
        <Modo
          title="Cómo suena de verdad"
          arte="suena"
          body="Gonna, wanna, wader: lo que se dice y no se escribe"
          tint={color.world.tech}
          go={() => nav.navigate('Contractions')}
        />
      </View>

      <SectionTitle title="Para leer" />
      <View style={styles.list}>
        <Modo
          title="Phrasal verbs"
          body={`${loadContent().phrasal.verbos.length} frases donde la partícula lo cambia todo`}
          tint={color.world.tech}
          arte="phrasal"
          go={() => nav.navigate('Phrasal')}
        />
        <Modo
          title="Al azar"
          body="Frases sueltas, sin algoritmo y sin llevar cuenta"
          tint={color.world.gente}
          arte="azar"
          go={() => nav.navigate('Azar')}
        />
        <Modo
          title="Lecturas"
          body="Historias hechas con frases que ya viste. Hay para niños."
          tint={color.world.legal}
          arte="lecturas"
          go={() => nav.navigate('Lecturas')}
        />
      </View>

      <SectionTitle title="Tus frases" />
      <View style={styles.list}>
        <Modo
          title="Errores que te delatan"
          arte="errores"
          body="Lo que llevas años diciendo mal sin que nadie te corrija"
          tint={color.world.gente}
          go={() => nav.navigate('Errors')}
        />
        <Modo
          title="Se me atoran"
          arte="atoran"
          body="Las que más fallas, sin cronómetro"
          tint={color.riskWarn}
          go={() => nav.navigate('Stuck')}
        />
        <Modo
          title="Mi mazo"
          arte="mazo"
          body="Las que guardaste con estrella"
          tint={color.world.dinero}
          go={() => nav.navigate('Deck')}
        />
      </View>

      {reto ? (
        <>
          <SectionTitle title="Esta semana" />
          <Card style={styles.reto}>
            <View style={styles.retoTop}>
              <Text style={styles.retoTitle}>Reto de la semana</Text>
              <Text style={styles.retoNum}>
                {reto.llevas} de {reto.meta}
              </Text>
            </View>
            <ProgressBar
              value={Math.min(reto.llevas, reto.meta)}
              total={reto.meta}
            />
            <Text style={styles.retoBody}>
              {reto.cumplido
                ? 'Cumplido. La semana que entra empieza otro.'
                : 'Cuenta lo que aciertas estudiando y jugando. No hay reloj y no se pierde.'}
            </Text>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

interface ModoProps {
  title: string;
  body: string;
  tint: string;
  extra?: string | null;
  /** Clave de PORTADA_JUEGO. Sin ella la fila va lisa. */
  arte?: string;
  go: () => void;
}

function Modo({ title, body, tint, extra, arte, go }: ModoProps) {
  return (
    <Card
      accent={tint}
      onPress={go}
      style={styles.item}
      portada={arte ? arte : undefined}
      imagen={arte ? PORTADA_JUEGO[arte] : undefined}
      altoPortada={arte ? 84 : undefined}
    >
      <View style={styles.itemTop}>
        <Text style={styles.itemTitle}>{title}</Text>
        {extra ? <Text style={styles.itemExtra}>{extra}</Text> : null}
      </View>
      <Text style={styles.itemBody}>{body}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  title: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.text,
  },
  repaso: { marginBottom: space.md },
  repasoTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: color.text,
    marginBottom: 4,
  },
  repasoBody: { fontSize: font.size.sm, color: color.textMuted },
  nota: {
    fontSize: font.size.xs,
    color: color.textFaint,
    marginBottom: space.sm,
  },
  list: { gap: space.md, marginBottom: space.lg },
  item: { gap: 4 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  itemTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: color.text,
    flexShrink: 1,
  },
  itemExtra: { fontSize: font.size.xs, color: color.textFaint },
  itemBody: { fontSize: font.size.sm, color: color.textMuted },
  reto: { gap: space.sm },
  retoTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  retoTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: color.text,
  },
  retoNum: {
    fontSize: font.size.md,
    fontWeight: font.weight.bold,
    color: color.accent,
  },
  retoBody: { fontSize: font.size.sm, color: color.textMuted },
});
