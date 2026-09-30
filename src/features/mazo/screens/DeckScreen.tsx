import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, type ListRenderItemInfo } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated from 'react-native-reanimated';
import { Carga, EmptyState, Header, Screen } from '@/shared/ui';
import { HuesoTarjeta, ProveedorEsqueleto } from '@/shared/ui/esqueleto';
import { Marcador } from '@/shared/ui/fx/Marcador';
import { AvisoDeshacer } from '@/features/mazo/components/AvisoDeshacer';
import { TarjetaGuardada } from '@/features/mazo/components/TarjetaGuardada';
import { getFavorites } from '@/data/repos/frases';
import { toggleFavorite } from '@/data/repos/tarjetas';
import { quitarDeLista, reinsertar } from '@/domain/guardadas';
import { useCarga } from '@/shared/hooks/useCarga';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as haptics from '@/services/haptics';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { color, font, motionAviso, reacomodarResorte, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { conteo, plural } from '@/domain/texto';
import type { Entry } from '@/types';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Cuántas tarjetas entran animadas al abrir la pantalla; el resto aparece directo. */
const ANIMADAS = 8;
/** Cuánto dura marcada la tarjeta que regresa con «Deshacer» como recién llegada, en ms. */
const REGRESO_MS = 600;
const REACOMODO = reacomodarResorte();

/** Lo que se acaba de quitar (con su lugar, para regresarla) o el fallo al guardar el cambio. */
type AvisoSinId = { tipo: 'quitada'; entry: Entry; indice: number } | { tipo: 'fallo' };
type Aviso = AvisoSinId & { id: number };

/**
 * P-17, mi mazo: las guardadas con estrella, cada una como una tarjeta con su karaoke y su grupo Inglés · Español. Arriba,
 * cuántas hay con el `Marcador`, que baja al quitar. El orden es el de siempre (lo último que repasaste primero): no se
 * guarda la fecha en que se guardó una frase. Aquí no hay «Repasar»: la sesión de estudio no recibe listas sin tocar SM-2
 * ni la cola del día.
 *
 * Quitar: deslizar la tarjeta, mantenerla presionada o la acción del lector de pantalla. La tarjeta se va, las de abajo
 * suben con resorte y un aviso («Quitada de tu mazo · Deshacer») dura 5 s; «Deshacer» la regresa a su lugar. Hay un solo
 * pendiente: quitar otra confirma la anterior. La base se actualiza al quitar, no al vencer el aviso.
 */
export function DeckScreen() {
  const nav = useNavigation<Nav>();
  const reducido = useMovimientoReducido();
  const user = useAuthStore((s) => s.user);
  const filter = useSettingsStore((s) => s.filter);
  const carga = useCarga(
    async () => (user ? getFavorites(user.id, filter()) : []),
    [user, filter],
    { alEnfocar: true, esVacio: (d) => d.length === 0 }
  );

  // La lista que se ve: sale de la base, pero al quitar una frase se recorta al momento (y se regresa al deshacer).
  const [lista, setLista] = useState<Entry[] | null>(null);
  const items = lista ?? carga.datos ?? [];
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (carga.datos) setLista(carga.datos);
  }, [carga.datos]);

  const [aviso, setAviso] = useState<Aviso | null>(null);
  const avisoRef = useRef(aviso);
  avisoRef.current = aviso;
  const [reinsertada, setReinsertada] = useState<number | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regreso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cuenta = useRef(0);

  const soltarTemporizadores = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current);
    if (regreso.current) clearTimeout(regreso.current);
    temporizador.current = null;
    regreso.current = null;
  }, []);
  useEffect(() => soltarTemporizadores, [soltarTemporizadores]);

  // Perder el foco (abrir el Detalle) corta todo el audio: el reproductor de frases es uno solo y compartido.
  useCortarAudioAlSalir();

  const mostrar = useCallback(
    (nuevo: AvisoSinId) => {
      cuenta.current += 1;
      setAviso({ ...nuevo, id: cuenta.current });
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(() => setAviso(null), motionAviso.duracion);
    },
    []
  );

  const quitar = useCallback(
    async (entry: Entry) => {
      if (!user) return;
      const r = quitarDeLista(itemsRef.current, entry.id);
      if (r.indice < 0) return;
      haptics.tapLight();
      setLista(r.lista);
      mostrar({ tipo: 'quitada', entry, indice: r.indice });
      try {
        await toggleFavorite(user.id, entry.id);
      } catch {
        // La base no guardó el cambio: la frase vuelve a su lugar y se avisa.
        setLista((l) => reinsertar(l ?? [], entry, r.indice));
        mostrar({ tipo: 'fallo' });
      }
    },
    [user, mostrar]
  );

  const deshacer = useCallback(async () => {
    const a = avisoRef.current;
    if (!user || !a || a.tipo !== 'quitada') return;
    soltarTemporizadores();
    setAviso(null);
    setReinsertada(a.entry.id);
    regreso.current = setTimeout(() => setReinsertada(null), REGRESO_MS);
    setLista((l) => reinsertar(l ?? [], a.entry, a.indice));
    try {
      await toggleFavorite(user.id, a.entry.id);
    } catch {
      setLista((l) => quitarDeLista(l ?? [], a.entry.id).lista);
      mostrar({ tipo: 'fallo' });
    }
  }, [user, soltarTemporizadores, mostrar]);

  const abrir = useCallback(
    (e: Entry) => nav.navigate('Detail', { entryId: e.id }),
    [nav]
  );
  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Entry>) => (
      <TarjetaGuardada
        entry={item}
        indice={item.id === reinsertada ? 0 : index}
        animar={index < ANIMADAS || item.id === reinsertada}
        onAbrir={abrir}
        onQuitar={quitar}
      />
    ),
    [abrir, quitar, reinsertada]
  );

  const vacio = (
    <EmptyState
      icon="star"
      title="Tu mazo está vacío"
      body="Toca la estrella en cualquier frase para guardarla aquí."
      actionLabel="Ir a Frases sueltas"
      onAction={() => nav.navigate('Azar')}
    />
  );

  if (carga.estado !== 'listo') {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <Carga
          carga={carga}
          vacio={vacio}
          esqueleto={
            <ProveedorEsqueleto etiqueta="Cargando tu mazo" style={styles.list}>
              {Array.from({ length: 6 }, (_, i) => (
                <HuesoTarjeta key={i} lineas={1} />
              ))}
            </ProveedorEsqueleto>
          }
        >
          {() => null}
        </Carga>
      </Screen>
    );
  }

  return (
    <Screen padded={false}>
      <View style={styles.head}>
        <Header onBack={() => nav.goBack()} title="Mi mazo" />
        <View style={styles.conteo} accessible accessibilityRole="header" accessibilityLabel={conteo(items.length, 'guardada')}>
          <View style={styles.conteoVista} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Marcador valor={items.length} tamano={font.size.xxl} color={color.text} />
            <Text style={styles.conteoResto}>{plural(items.length, 'guardada')}</Text>
          </View>
        </View>
      </View>
      {items.length === 0 ? (
        <View style={styles.vacio}>{vacio}</View>
      ) : (
        <Animated.FlatList
          data={items}
          keyExtractor={claveEntrada}
          renderItem={renderItem}
          itemLayoutAnimation={reducido ? undefined : REACOMODO}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separador}
          initialNumToRender={ANIMADAS}
          windowSize={7}
        />
      )}
      {aviso ? (
        <AvisoDeshacer
          key={aviso.id}
          texto={aviso.tipo === 'quitada' ? 'Quitada de tu mazo' : 'No se pudo actualizar tu mazo. Intenta otra vez.'}
          onDeshacer={aviso.tipo === 'quitada' ? deshacer : undefined}
        />
      ) : null}
    </Screen>
  );
}

const claveEntrada = (e: Entry) => String(e.id);

function Separador() {
  return <View style={styles.sep} />;
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: space.lg, paddingTop: space.sm },
  conteo: { marginBottom: space.sm },
  conteoVista: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  conteoResto: { fontFamily: font.family.display, fontSize: font.size.xl, color: color.textMuted },
  vacio: { flex: 1, paddingHorizontal: space.lg },
  list: { padding: space.lg, paddingBottom: space.xxxl },
  sep: { height: space.md },
});
