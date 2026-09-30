import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Card, Header, Icon, Screen } from '@/components/base';
import { ICONO_MUNDO } from '@/components/list/iconoMundo';
import { loadContent } from '@/store/content';
import { COLOR_BASE, color, font, radius, space, type Color } from '@/theme';
import { contraste } from '@/theme/contraste';
import { leerPaletaDev, usarPaletaDev, type OpcionMundos } from '@/theme/paletaActiva';
import { PALETAS, type Paleta } from '@/theme/paletas';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** Un par de la tabla: qué se mide, sobre qué, y el mínimo (4.5 texto; 3 texto grande, íconos y bloques). */
interface Par {
  nombre: string;
  frente: (c: Color) => string;
  fondo: (c: Color) => string;
  minimo: number;
}

const SUPERFICIES: [string, (c: Color) => string][] = [
  ['bg', (c) => c.bg],
  ['surface', (c) => c.surface],
  ['surfaceAlt', (c) => c.surfaceAlt],
  ['surfaceHigh', (c) => c.surfaceHigh],
];

/** El peor caso de un color de texto sobre las cuatro superficies. */
const sobreSuperficies = (nombre: string, frente: (c: Color) => string): Par[] =>
  SUPERFICIES.map(([s, fondo]) => ({ nombre: `${nombre} / ${s}`, frente, fondo, minimo: 4.5 }));

const PARES: Par[] = [
  ...sobreSuperficies('text', (c) => c.text),
  ...sobreSuperficies('textMuted', (c) => c.textMuted),
  ...sobreSuperficies('textFaint', (c) => c.textFaint),
  ...sobreSuperficies('accent (texto)', (c) => c.accent),
  ...sobreSuperficies('correct', (c) => c.correct),
  ...sobreSuperficies('wrong', (c) => c.wrong),
  ...sobreSuperficies('star', (c) => c.star),
  ...sobreSuperficies('riskStrong', (c) => c.riskStrong),
  { nombre: 'onPrimario / primario (botón)', frente: (c) => c.onPrimario, fondo: (c) => c.primario, minimo: 4.5 },
  { nombre: 'primario / bg (bloque)', frente: (c) => c.primario, fondo: (c) => c.bg, minimo: 3 },
  { nombre: 'onAccent / accent', frente: (c) => c.onAccent, fondo: (c) => c.accent, minimo: 4.5 },
  { nombre: 'onContraste / contraste (HOY)', frente: (c) => c.onContraste, fondo: (c) => c.contraste, minimo: 4.5 },
  { nombre: 'accent / contraste (detalle en HOY)', frente: (c) => c.accent, fondo: (c) => c.contraste, minimo: 3 },
  { nombre: 'onHojaAcierto / hojaAcierto', frente: (c) => c.onHojaAcierto, fondo: (c) => c.hojaAcierto, minimo: 4.5 },
  { nombre: 'wrong / wrongFondo', frente: (c) => c.wrong, fondo: (c) => c.wrongFondo, minimo: 4.5 },
  { nombre: 'barraActivo / pastilla o barra', frente: (c) => c.barraActivo, fondo: (c) => (c.pastilla.startsWith('#') ? c.pastilla : c.veloBarra), minimo: 3 },
  { nombre: 'barraInactivo / barra', frente: (c) => c.barraInactivo, fondo: (c) => c.veloBarra, minimo: 4.5 },
];

function colorDe(p: Paleta): Color {
  return p.color ?? COLOR_BASE;
}

/** Una pantalla en miniatura, con los colores de la paleta: fondo, HOY, tarjeta, botones, veredictos y pestañas. */
function Replica({ c }: { c: Color }) {
  return (
    <View style={[styles.replica, { backgroundColor: c.bg, borderColor: c.border }]}>
      <Text style={[styles.rTitulo, { color: c.text }]}>Practicar</Text>
      <Text style={[styles.rMini, { color: c.textMuted }]}>Tu racha de 12 días</Text>

      <View style={[styles.rHoy, { backgroundColor: c.contraste }]}>
        <Text style={[styles.rHoyTitulo, { color: c.onContraste }]}>HOY</Text>
        <Text style={[styles.rMini, { color: c.onContraste }]}>18 frases por repasar</Text>
        <LinearGradient colors={[c.senalInicio, c.senalMedio, c.senalFin]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.rSenal} />
        <View style={[styles.rBoton, { backgroundColor: c.primario }]}>
          <Text style={[styles.rBotonTexto, { color: c.onPrimario }]}>Empezar</Text>
        </View>
      </View>

      <View style={[styles.rTarjeta, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.rFila}>
          <Icon name="play" size="sm" color={c.accent} />
          <Text style={[styles.rMini, { color: c.text }]}>What's up?</Text>
        </View>
        <Text style={[styles.rMini, { color: c.textFaint }]}>¿Qué onda? · Calle</Text>
        <Text style={[styles.rMini, { color: c.accent }]}>Ver la ficha</Text>
      </View>

      <View style={styles.rFila}>
        <View style={[styles.rChip, { backgroundColor: c.hojaAcierto }]}>
          <Text style={[styles.rMini, { color: c.onHojaAcierto }]}>¡Bien!</Text>
        </View>
        <View style={[styles.rChip, { backgroundColor: c.wrongFondo }]}>
          <Text style={[styles.rMini, { color: c.wrong }]}>Casi</Text>
        </View>
        <View style={[styles.rChip, { backgroundColor: c.surfaceAlt, borderColor: c.borderStrong, borderWidth: 1 }]}>
          <Text style={[styles.rMini, { color: c.text }]}>Otra vez</Text>
        </View>
      </View>

      <View style={[styles.rBarra, { backgroundColor: c.veloBarra }]}>
        <View style={[styles.rPastilla, { backgroundColor: c.pastilla }]}>
          <Icon name="practice" size="md" color={c.barraActivo} />
        </View>
        <Icon name="explore" size="md" color={c.barraInactivo} />
        <Icon name="progress" size="md" color={c.barraInactivo} />
      </View>
    </View>
  );
}

function Mundos({ c, apagados }: { c: Color; apagados: Color['world'] | null }) {
  const nombres = useMemo(() => new Map(loadContent().packs.mundos.map((m) => [m.id, m.nombre])), []);
  const ids = Object.keys(c.world) as (keyof Color['world'])[];
  return (
    <View style={styles.mundos}>
      <Text style={[styles.etiqueta, { color: c.textMuted }]}>(a) Escala de azules + ícono</Text>
      <View style={[styles.mundosCaja, { backgroundColor: c.surface }]}>
        {ids.map((id) => (
          <View key={id} style={styles.mundo}>
            <Icon name={ICONO_MUNDO[id] ?? 'explore'} size="sm" color={c.world[id]} />
            <Text style={[styles.rMini, styles.encoge, { color: c.world[id] }]}>{nombres.get(id) ?? id}</Text>
          </View>
        ))}
      </View>
      {apagados ? (
        <>
          <Text style={[styles.etiqueta, { color: c.textMuted }]}>(b) Tonos apagados, solo en puntos chicos</Text>
          <View style={[styles.mundosCaja, { backgroundColor: c.surface }]}>
            {ids.map((id) => (
              <View key={id} style={styles.mundo}>
                <View style={[styles.punto, { backgroundColor: apagados[id] }]} />
                <Text style={[styles.rMini, styles.encoge, { color: c.text }]}>{nombres.get(id) ?? id}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function TablaContraste({ c }: { c: Color }) {
  const filas = PARES.map((p) => {
    const v = contraste(p.frente(c), p.fondo(c));
    return { nombre: p.nombre, v, pasa: v >= p.minimo, minimo: p.minimo };
  });
  const fallan = filas.filter((f) => !f.pasa).length;
  return (
    <View style={styles.tabla}>
      <Text style={styles.etiqueta}>{fallan === 0 ? `Contraste: los ${filas.length} pares pasan AA` : `Contraste: ${fallan} de ${filas.length} no pasan AA`}</Text>
      {filas.map((f) => (
        <View key={f.nombre} style={styles.filaTabla}>
          <Text style={styles.celda}>{f.nombre}</Text>
          <Text style={[styles.celdaValor, { color: f.pasa ? color.correct : color.wrong }]}>
            {`${f.v.toFixed(2)}:1 ${f.pasa ? 'pasa' : `no (mín. ${f.minimo})`}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Solo en __DEV__: «Muestrario de color». Las paletas candidatas lado a lado (la de hoy como referencia), con una
 * réplica, los colores de mundo en sus dos opciones, la tabla de contraste calculada en vivo y los ajustes hechos para
 * pasar AA. «Usar esta paleta» la aplica a TODA la app real (recarga): así se decide recorriendo las pantallas de
 * verdad, no mirando miniaturas. El botón flotante «Paleta» alterna E, F y G sin volver aquí.
 */
export function MuestrarioScreen() {
  const nav = useNavigation<Nav>();
  const activa = leerPaletaDev();

  const usar = (id: Paleta['id'], mundos: OpcionMundos) => usarPaletaDev(id, mundos);

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Muestrario de color" />
      <Text style={styles.intro}>
        {`Aplicada: ${activa.paleta}${activa.paleta === 'D' ? '' : ` · mundos (${activa.mundos})`}. «Usar esta paleta» recarga la app con ella.`}
      </Text>
      {PALETAS.map((p) => {
        const c = colorDe(p);
        const esActiva = activa.paleta === p.id;
        return (
          <Card key={p.id} style={styles.card}>
            <Text style={styles.nombre}>{`${p.id} · ${p.nombre}${esActiva ? ' (aplicada)' : ''}`}</Text>
            <Text style={styles.descripcion}>{p.descripcion}</Text>
            <Replica c={c} />
            <Mundos c={c} apagados={p.mundosApagados} />
            <TablaContraste c={c} />
            {p.ajustes.length > 0 ? (
              <View style={styles.tabla}>
                <Text style={styles.etiqueta}>Ajustes para pasar AA</Text>
                {p.ajustes.map((a) => (
                  <Text key={a.token} style={styles.celda}>{`${a.token}: ${a.antes} a ${a.despues}. ${a.motivo}`}</Text>
                ))}
              </View>
            ) : null}
            <Button
              label={esActiva ? 'Aplicada' : 'Usar esta paleta'}
              variant={esActiva ? 'ghost' : 'secondary'}
              disabled={esActiva && activa.mundos === 'a'}
              onPress={() => usar(p.id, 'a')}
              full
            />
            {p.mundosApagados ? (
              <Button label="Usar con mundos (b)" variant="ghost" onPress={() => usar(p.id, 'b')} full />
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted, marginBottom: space.md },
  card: { gap: space.md, marginBottom: space.lg },
  nombre: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text },
  descripcion: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  etiqueta: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.textMuted },
  replica: { borderRadius: radius.lg, borderWidth: 1, padding: space.md, gap: space.sm },
  rTitulo: { fontFamily: font.family.display, fontSize: font.size.xl },
  rMini: { fontFamily: font.family.body, fontSize: font.size.sm },
  rHoy: { borderRadius: radius.md, padding: space.md, gap: space.sm },
  rHoyTitulo: { fontFamily: font.family.bodyStrong, fontSize: font.size.md },
  rSenal: { height: space.sm, borderRadius: radius.pill },
  rBoton: { minHeight: 48, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  rBotonTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.md },
  rTarjeta: { borderRadius: radius.md, borderWidth: 1, padding: space.md, gap: space.xs },
  rFila: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  rChip: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  rBarra: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: radius.pill, paddingVertical: space.sm },
  rPastilla: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: space.xs },
  mundos: { gap: space.sm },
  mundosCaja: { borderRadius: radius.md, padding: space.md, flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  mundo: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1 },
  encoge: { flexShrink: 1 },
  punto: { width: space.sm, height: space.sm, borderRadius: radius.pill },
  tabla: { gap: space.xs },
  filaTabla: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  celda: { flexShrink: 1, fontFamily: font.family.body, fontSize: font.size.xs, color: color.textMuted },
  celdaValor: { fontFamily: font.family.bodyStrong, fontSize: font.size.xs },
});
