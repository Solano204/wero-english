import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, Carga, Header, Screen } from '@/shared/ui';
import { Hueso, HuesoTarjeta, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { TarjetaLectura, type LecturaFila } from '@/features/lecturas/components/TarjetaLectura';
import { destacarLectura } from '@/domain/lectura';
import { color, font, space } from '@/theme';
import { useLecturas } from '@/features/lecturas/hooks/useLecturas';

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
  const { nav, carga, abrir } = useLecturas();

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
