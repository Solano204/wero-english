import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Carga, Header, Icon, Screen, SkeletonLista, pedirRecompensa, Presionable } from '@/components/base';
import { FilaEstrellas } from '@/components/card';
import {
  abrirConAnuncio,
  getNiveles,
  nivelDesbloqueado,
  nivelesPagados,
  type NivelEstado,
} from '@/db/levels';
import { useCarga } from '@/hooks/useCarga';
import { useAuthStore } from '@/store';
import { loadContent } from '@/store/content';
import { MuroDesbloqueo } from '@/components/unlock';
import { color, depth, font, radius, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

const SIN_ESTADOS = new Map<number, NivelEstado>();
type Ruta = RouteProp<RootStackParams, 'Niveles'>;

/**
 * El mapa de niveles.
 *
 * Doscientos por juego, en cuadrícula de cinco. Se abren de uno en uno y
 * el candado se quita con una estrella, que es la mitad del nivel: no
 * hay forma de quedarse atorado por no sacar el puntaje perfecto.
 *
 * Al abrir, la pantalla salta sola al primer nivel sin terminar. Con
 * doscientos, obligar a bajar hasta donde te quedaste es una molestia
 * diaria que se arregla con una línea.
 */
const TITULOS: Record<string, string> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caída',
  dulces: 'Dulces',
  cazala: 'Cázala',
  pares_minimos: 'Pares mínimos',
};

export function NivelesScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const content = useMemo(loadContent, []);

  const juego = params.juego;
  const def = content.niveles.juegos[juego];

  const carga = useCarga(
    async () => {
      if (!user) return null;
      const estados = await getNiveles(user.id, juego);
      const siguiente = await nivelDesbloqueado(user.id, juego);
      const pagados = await nivelesPagados(user.id, juego);
      return { estados, siguiente, pagados };
    },
    [user, juego],
    { alEnfocar: true }
  );
  const estados = carga.datos?.estados ?? SIN_ESTADOS;
  const siguiente = carga.datos?.siguiente ?? 1;
  // Niveles abiertos con anuncio en esta visita, además de los que ya guardó la base.
  // Se abren de uno en uno y no encadenan.
  const [abiertosAhora, setAbiertosAhora] = useState<number[]>([]);
  const pagados = [...(carga.datos?.pagados ?? []), ...abiertosAhora];
  const scroll = useRef<ScrollView>(null);
  const [abriendo, setAbriendo] = useState(false);

  /**
   * Abre un nivel adelantado a cambio de un anuncio.
   *
   * Solo se ofrece sobre el primer nivel cerrado, no sobre cualquiera:
   * poder saltar del 3 al 180 con un video vacía los 176 de en medio y
   * el usuario se queda sin nada que hacer al día siguiente.
   */
  const saltar = useCallback(
    async (nivel: number) => {
      if (!user || abriendo) return;
      setAbriendo(true);
      const r = await pedirRecompensa();
      if (r === 'visto') {
        // Un anuncio abre UN nivel: el que se pagó, y nada más. No toca
        // `siguiente`, porque eso es la cadena de niveles jugados.
        await abrirConAnuncio(user.id, juego, nivel);
        setAbiertosAhora((prev) => [...prev, nivel]);
      }
      setAbriendo(false);
    },
    [user, juego, abriendo]
  );

  // Al llegar los datos, baja hasta el nivel actual. Cinco por fila, cada fila unos 68 px de alto.
  useEffect(() => {
    if (!carga.datos) return;
    const fila = Math.max(0, Math.floor((carga.datos.siguiente - 1) / 5) - 2);
    const t = setTimeout(
      () => scroll.current?.scrollTo({ y: fila * 68, animated: false }),
      60
    );
    return () => clearTimeout(t);
  }, [carga.datos]);

  if (!def) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Niveles" />
        <Card>
          <Text style={styles.vacio}>
            No hay niveles cargados para este juego. Corre
            scripts/genera_niveles.py.
          </Text>
        </Card>
      </Screen>
    );
  }

  const totalEstrellas = [...estados.values()].reduce(
    (s, e) => s + e.estrellas,
    0
  );

  const contenido = (
    <Screen padded={false}>
      <View style={styles.top}>
        <Header
          onBack={() => nav.goBack()}
          title={def.nombre}
          subtitle={carga.datos ? `${totalEstrellas} de ${def.total * 3} estrellas` : undefined}
        />
      </View>

      <Carga carga={carga} esqueleto={<View style={styles.lista}><SkeletonLista filas={6} alto={68} /></View>}>
        {() => (
          <ScrollView
            ref={scroll}
            contentContainerStyle={styles.lista}
            showsVerticalScrollIndicator={false}
            // Sin esto, Android mantiene las 200 celdas montadas todo el
            // tiempo y el scroll se arrastra.
            removeClippedSubviews
          >
            {def.bandas.map((banda) => {
              const niveles = def.niveles.filter(
                (n) => n.n >= banda.desde && n.n <= banda.hasta
              );
              return (
                <View key={banda.id} style={styles.banda}>
                  <View style={styles.bandaCabeza}>
                    <Text style={styles.bandaNombre}>{banda.nombre}</Text>
                    <Text style={styles.bandaRango}>
                      {banda.desde} a {banda.hasta} · {banda.ids.length} frases
                    </Text>
                  </View>

                  <View style={styles.rejilla}>
                    {niveles.map((nv) => {
                      const est = estados.get(nv.n);
                      const abierto = nv.n <= siguiente || pagados.includes(nv.n);
                      const actual = nv.n === siguiente;
                      // El primer cerrado es el único que se puede saltar.
                      const saltable = !abierto && nv.n === siguiente + 1;
                      return (
                        <Presionable
                          key={nv.n}
                          disabled={!abierto && !saltable}
                          onPress={() => {
                            if (!abierto) {
                              void saltar(nv.n);
                              return;
                            }
                            const ruta = RUTA[juego];
                            if (ruta) nav.navigate(ruta, { nivel: nv.n });
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`Nivel ${nv.n}${
                            abierto ? '' : ', cerrado'
                          }`}
                          style={[styles.celda, !abierto && styles.celdaCerrada, actual && styles.celdaActual, est && est.estrellas > 0 && styles.celdaHecha]}
                        >
                          <Text
                            style={[
                              styles.celdaNum,
                              !abierto && styles.celdaNumOff,
                            ]}
                          >
                            {nv.n}
                          </Text>
                          <View style={styles.estrellas}>
                            {abierto ? (
                              <FilaEstrellas llenas={est?.estrellas ?? 0} color={color.world.fonetica} />
                            ) : saltable ? (
                              <>
                                <Icon name="play" size="sm" color={color.world.fonetica} />
                                <Text style={styles.anuncio}>anuncio</Text>
                              </>
                            ) : (
                              <Text style={styles.anuncio}>·</Text>
                            )}
                          </View>
                        </Presionable>
                      );
                    })}
                  </View>
                </View>
              );
            })}

            <Text style={styles.pie}>
              Terminar un nivel abre el siguiente, saques una estrella o tres.
              El que sigue del último también se puede abrir viendo un anuncio.
              Rejugar nunca te baja lo que ya tenías.
            </Text>
          </ScrollView>
        )}
      </Carga>
    </Screen>
  );

  // Cada juego se abre una vez y queda abierto para siempre. El muro
  // deja ver los niveles por detras: se ve lo que hay, y eso es justo
  // lo que da ganas de abrirlo.
  return (
    <MuroDesbloqueo
      tipo="juego"
      id={juego}
      nombre={TITULOS[juego] ?? "Este juego"}
      detalle="200 niveles, todos con frases de tu catálogo."
      onVolver={() => nav.goBack()}
    >
      {contenido}
    </MuroDesbloqueo>
  );
}

const RUTA: Record<string, 'Colmena' | 'Pares' | 'Caida' | 'Dulces'> = {
  colmena: 'Colmena',
  pares: 'Pares',
  caida: 'Caida',
  dulces: 'Dulces',
};

const styles = StyleSheet.create({
  top: { paddingHorizontal: space.lg, paddingTop: space.sm },
  lista: { paddingHorizontal: space.lg, paddingBottom: space.xxxl },
  banda: { marginBottom: space.xl },
  bandaCabeza: { marginBottom: space.md },
  bandaNombre: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  bandaRango: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  /*
   * Sin sombra por celda, a propósito.
   *
   * Son doscientas celdas en una sola lista, y en Android cada
   * `elevation` es una capa que el sistema compone aparte: doscientas
   * traban el scroll en cualquier teléfono de gama media. El relieve lo
   * da el borde inferior, que no cuesta nada.
   */
  celda: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: radius.md,
    backgroundColor: color.surface,
    borderBottomWidth: depth.md,
    borderBottomColor: color.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  celdaCerrada: { backgroundColor: color.surfaceAlt, borderBottomWidth: 1 },
  celdaActual: { borderColor: color.accent, borderBottomColor: color.accentDeep },
  celdaHecha: { backgroundColor: color.correctSoft },
  celdaNum: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  celdaNumOff: { color: color.textFaint },
  estrellas: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 1 },
  anuncio: { fontFamily: font.family.body, fontSize: 9, color: color.world.fonetica },
  pie: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    marginTop: space.md,
  },
  vacio: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
