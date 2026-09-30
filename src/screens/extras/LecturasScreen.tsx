import React, { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Carga, Header, Screen } from '@/components/base';
import { Hueso, HuesoTarjeta, ProveedorEsqueleto } from '@/components/esqueleto';
import { SectionTitle } from '@/components/list';
import { TarjetaLectura, type LecturaFila } from '@/components/lectura/TarjetaLectura';
import { destacarLectura, dificultadPara, estadoDesbloqueo } from '@/domain/lectura';
import { getCardStates, getDominadasPorMundo, getEntriesByIds } from '@/db/queries';
import { useCarga } from '@/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/hooks/useCortarAudioAlSalir';
import { useAuthStore } from '@/store';
import { loadContent } from '@/store/content';
import { color, font, space } from '@/theme';
import type { CardState, Entry } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

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
 *
 * En cada sección va primero, y más grande, la abierta con más frases
 * tuyas: la que más se parece a lo que ya sabes.
 */
export function LecturasScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const content = useMemo(loadContent, []);
  const carga = useCarga(
    async (): Promise<LecturaFila[]> => {
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

  // Red de seguridad: ningún audio de lectura sobrevive a salir de aquí.
  useCortarAudioAlSalir();

  const abrir = useCallback((lecturaId: string) => nav.navigate('Lectura', { lecturaId }), [nav]);

  const grupo = (titulo: string, filas: LecturaFila[]) =>
    filas.length === 0 ? null : (
      <>
        <SectionTitle title={titulo} count={filas.length} />
        <View style={styles.list}>
          {destacarLectura(filas).map(({ fila, destacada }, i) => (
            <TarjetaLectura
              key={fila.lectura.id}
              fila={fila}
              destacada={destacada}
              indice={i}
              onPress={() => abrir(fila.lectura.id)}
            />
          ))}
        </View>
      </>
    );

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Lecturas" />

      <Text style={styles.intro}>
        Historias hechas con frases que ya viste. El anillo se llena con las que ya te sabes y la
        etiqueta baja sola conforme aprendes.
      </Text>

      <Carga
        carga={carga}
        esqueleto={
          <ProveedorEsqueleto etiqueta="Cargando las lecturas">
            {/* El mismo título de sección que trae la lista: sin él, al llegar todo bajaba un renglón. */}
            <View style={styles.tituloHueso}>
              <Hueso width="35%" height={font.size.lg} />
            </View>
            <View style={styles.list}>
              {Array.from({ length: 5 }, (_, i) => (
                <HuesoTarjeta key={i} imagen lineas={1} />
              ))}
            </View>
          </ProveedorEsqueleto>
        }
        vacio={
          <Card>
            <Text style={styles.vacio}>
              Todavía no hay historias cargadas. El archivo lecturas.json está
              vacío o no se generó.
            </Text>
          </Card>
        }
      >
        {(filas) => (
          <>
            {grupo('Para niños', filas.filter((f) => f.lectura.publico === 'ninos'))}
            {grupo('Para todos', filas.filter((f) => f.lectura.publico === 'general'))}
          </>
        )}
      </Carga>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  list: { gap: space.sm, marginBottom: space.md },
  // Mide lo que SectionTitle (título de 18 con su margen).
  tituloHueso: { height: Math.round(font.size.lg * 1.35), justifyContent: 'center', marginTop: space.md, marginBottom: space.sm },
  vacio: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
});
