import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Badge, Card, Carga, Header, ProgressBar, Screen } from '@/components/base';
import { SectionTitle } from '@/components/list';
import {
  dificultadPara,
  estadoDesbloqueo,
  etiquetaDificultad,
} from '@/domain/lectura';
import { getCardStates, getDominadasPorMundo, getEntriesByIds } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/store';
import { loadContent } from '@/store/content';
import * as audio from '@/services/audio';
import { color, font, space } from '@/theme';
import type { CardState, Entry, Lectura } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

interface Fila {
  lectura: Lectura;
  dificultad: number;
  dominadas: number;
  total: number;
  abierta: boolean;
  faltan: number;
}

/**
 * P-21, la biblioteca.
 *
 * Dos secciones: para niños y para todos. La de niños existe porque una
 * historia con vocabulario de trabajo y renta no le sirve a un chavito,
 * y porque un papá que instala esto para su hijo necesita ver de
 * inmediato qué es apropiado sin ponerse a leer.
 *
 * Las cerradas se muestran, no se esconden. Una historia gris que dice
 * "llevas 11 de 15" es una razón para hacer otra sesión; una historia
 * invisible no es nada.
 */
export function LecturasScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const content = useMemo(loadContent, []);
  const carga = useCarga(
    async (): Promise<Fila[]> => {
      if (!user) return [];
      const lecturas = content.lecturas.lecturas;
      const ids = [...new Set(lecturas.flatMap((l) => l.frases))];
      const entradas = await getEntriesByIds(ids);
      const estados = await getCardStates(user.id, ids);
      const porMundo = await getDominadasPorMundo(user.id);

      const mapaEntradas = new Map<number, Entry>(entradas.map((e) => [e.id, e]));
      const mapaEstados = new Map<number, CardState>(estados);

      return lecturas.map((l) => {
        const est = dificultadPara(l, mapaEntradas, mapaEstados);
        const bloq = estadoDesbloqueo(l, porMundo);
        return {
          lectura: l,
          dificultad: est.dificultad,
          dominadas: est.dominadas,
          total: est.total,
          abierta: bloq.abierta,
          faltan: bloq.faltan,
        };
      });
    },
    [user, content],
    { alEnfocar: true, esVacio: (f) => f.length === 0 }
  );

  // Red de seguridad: ninguna voz de lectura sobrevive a salir de aquí.
  useFocusEffect(
    useCallback(() => () => {
      audio.stop();
    }, [])
  );

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Lecturas" />

      <Text style={styles.intro}>
        Historias hechas con frases que ya viste. La dificultad es tuya: baja
        sola conforme aprendes.
      </Text>

      <Carga
        carga={carga}
        vacio={
          <Card>
            <Text style={styles.vacio}>
              Todavía no hay historias cargadas. El archivo lecturas.json está
              vacío o no se generó.
            </Text>
          </Card>
        }
      >
        {(filas) => {
          const ninos = filas.filter((f) => f.lectura.publico === 'ninos');
          const general = filas.filter((f) => f.lectura.publico === 'general');
          return (
            <>
              {ninos.length > 0 ? (
                <>
                  <SectionTitle title="Para niños" count={ninos.length} />
                  <View style={styles.list}>
                    {ninos.map((f) => (
                      <FilaLectura
                        key={f.lectura.id}
                        fila={f}
                        onPress={() =>
                          nav.navigate('Lectura', { lecturaId: f.lectura.id })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}

              {general.length > 0 ? (
                <>
                  <SectionTitle title="Para todos" count={general.length} />
                  <View style={styles.list}>
                    {general.map((f) => (
                      <FilaLectura
                        key={f.lectura.id}
                        fila={f}
                        onPress={() =>
                          nav.navigate('Lectura', { lecturaId: f.lectura.id })
                        }
                      />
                    ))}
                  </View>
                </>
              ) : null}
            </>
          );
        }}
      </Carga>
    </Screen>
  );
}

function FilaLectura({ fila, onPress }: { fila: Fila; onPress: () => void }) {
  const l = fila.lectura;
  const tint =
    color.world[l.mundo as keyof typeof color.world] ?? color.world.dia_a_dia;

  return (
    <Card
      accent={fila.abierta ? tint : color.borderStrong}
      onPress={fila.abierta ? onPress : undefined}
      style={fila.abierta ? styles.item : { ...styles.item, ...styles.cerrada }}
    >
      <View style={styles.itemTop}>
        <Text style={styles.itemTitle}>{l.titulo}</Text>
        {l.publico === 'ninos' ? <Badge label="Niños" tone="good" small /> : null}
      </View>

      <Text style={styles.itemSub}>{l.subtitulo}</Text>

      <Text style={styles.meta}>
        {l.palabras} palabras · {l.capitulos.length}{' '}
        {l.capitulos.length === 1 ? 'capítulo' : 'capítulos'} ·{' '}
        {fila.dominadas} de {fila.total} frases tuyas
      </Text>

      {fila.abierta ? (
        <View style={styles.dif}>
          <ProgressBar
            value={100 - fila.dificultad}
            total={100}
            tint={tint}
            height={5}
          />
          <Text style={styles.difTexto}>
            Dificultad {fila.dificultad} · {etiquetaDificultad(fila.dificultad)}
          </Text>
        </View>
      ) : (
        <Text style={styles.bloqueo}>
          Se abre al dominar {l.desbloquea?.dominadas} frases de{' '}
          {NOMBRE_MUNDO[l.mundo] ?? l.mundo} · te faltan {fila.faltan}
        </Text>
      )}
    </Card>
  );
}

const NOMBRE_MUNDO: Record<string, string> = {
  dia_a_dia: 'Día a día',
  calle: 'Calle y jerga',
  dinero: 'Dinero y trabajo',
  gente: 'Gente y vínculos',
  cultura: 'Cultura y escuela',
  tech: 'Tecnología',
  legal: 'Legal y trámites',
  fonetica: 'Pronunciación',
};

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  list: { gap: space.sm, marginBottom: space.md },
  item: { gap: 4 },
  cerrada: { opacity: 0.6 },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  itemTitle: {
    fontSize: font.size.lg,
    fontFamily: font.family.heading,
    color: color.text,
    flexShrink: 1,
  },
  itemSub: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  meta: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint, marginTop: 2 },
  dif: { gap: 4, marginTop: space.sm },
  difTexto: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  bloqueo: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.riskWarn,
    marginTop: space.sm,
  },
  vacio: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
