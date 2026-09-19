import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Header, Screen } from '@/components/base';
import { color, font, radius, space } from '@/theme';
import type { RootStackParams } from '@/navigation/routes';

/**
 * TEMPORAL. Sirve para elegir la fuente de la interfaz (TIPO-1). Se borra,
 * junto con su ruta y assets/fonts/_prueba/, en cuanto se elija.
 * Solo existe en __DEV__.
 */

type Nav = NativeStackNavigationProp<RootStackParams>;

const CUERPO_PX = 16;
/** letterSpacing en px = tamaño × −1.5 % (regla TIPO-4). */
const TRACKING = -0.015;

const FUENTES = {
  'Sora-SemiBold': require('../../assets/fonts/_prueba/Sora_600SemiBold.ttf'),
  'Sora-Bold': require('../../assets/fonts/_prueba/Sora_700Bold.ttf'),
  'Figtree-Regular': require('../../assets/fonts/_prueba/Figtree_400Regular.ttf'),
  'Figtree-SemiBold': require('../../assets/fonts/_prueba/Figtree_600SemiBold.ttf'),
  'Bricolage-SemiBold': require('../../assets/fonts/_prueba/BricolageGrotesque_600SemiBold.ttf'),
  'Bricolage-Bold': require('../../assets/fonts/_prueba/BricolageGrotesque_700Bold.ttf'),
  'InstrumentSans-Regular': require('../../assets/fonts/_prueba/InstrumentSans_400Regular.ttf'),
  'InstrumentSans-SemiBold': require('../../assets/fonts/_prueba/InstrumentSans_600SemiBold.ttf'),
  'Unbounded-SemiBold': require('../../assets/fonts/_prueba/Unbounded_600SemiBold.ttf'),
  'Unbounded-Bold': require('../../assets/fonts/_prueba/Unbounded_700Bold.ttf'),
  'Lexend-Regular': require('../../assets/fonts/_prueba/Lexend_400Regular.ttf'),
  'Lexend-SemiBold': require('../../assets/fonts/_prueba/Lexend_600SemiBold.ttf'),
  CharisSIL: require('../../assets/fonts/CharisSIL-Regular.ttf'),
};

interface Opcion {
  letra: string;
  nombre: string;
  nota: string;
  display: string;
  semibold: string;
  cuerpo: string;
  cuerpoSemibold: string;
}

const OPCIONES: Opcion[] = [
  {
    letra: 'A',
    nombre: 'Sora + Figtree',
    nota: 'Geométrica y limpia, con aire de señal de audio.',
    display: 'Sora-Bold',
    semibold: 'Sora-SemiBold',
    cuerpo: 'Figtree-Regular',
    cuerpoSemibold: 'Figtree-SemiBold',
  },
  {
    letra: 'B',
    nombre: 'Bricolage Grotesque + Instrument Sans',
    nota: 'Títulos con carácter de cartel de calle; cuerpo sereno.',
    display: 'Bricolage-Bold',
    semibold: 'Bricolage-SemiBold',
    cuerpo: 'InstrumentSans-Regular',
    cuerpoSemibold: 'InstrumentSans-SemiBold',
  },
  {
    letra: 'C',
    nombre: 'Unbounded + Lexend',
    nota: 'El neón más marcado (ancho y redondo); cuerpo hecho para leer.',
    display: 'Unbounded-Bold',
    semibold: 'Unbounded-SemiBold',
    cuerpo: 'Lexend-Regular',
    cuerpoSemibold: 'Lexend-SemiBold',
  },
];

function Muestra({ o }: { o: Opcion }) {
  return (
    <Card style={styles.muestra}>
      <Text style={[styles.etiqueta, { fontFamily: o.cuerpoSemibold }]}>
        {`${o.letra} · ${o.nombre}`}
      </Text>
      <Text style={[styles.nota, { fontFamily: o.cuerpo }]}>{o.nota}</Text>

      <Text style={[styles.display, { fontFamily: o.display }]}>Inglés de calle</Text>
      <Text style={[styles.h1, { fontFamily: o.semibold }]}>¿Cómo se dice «ya me voy»?</Text>
      <Text style={[styles.cuerpo, { fontFamily: o.cuerpo }]}>
        Wero te enseña el inglés que no viene en los libros: jerga, contracciones y las frases
        que se oyen en la calle. Escucha, repite y practica en sesiones de un minuto. ¡Ándale,
        sin miedo a equivocarte!
      </Text>

      <View style={styles.frase}>
        <Text style={[styles.en, { fontFamily: o.cuerpoSemibold }]}>I work from home on Fridays.</Text>
        <Text style={styles.ipa}>/aɪ ˈwɝːk frəm hoʊm ɑːn ˈfraɪdeɪz/</Text>
        <Text style={[styles.es, { fontFamily: o.cuerpo }]}>Trabajo desde casa los viernes.</Text>
      </View>

      <View style={styles.boton}>
        <Text style={[styles.botonTexto, { fontFamily: o.cuerpoSemibold }]}>Escuchar la frase</Text>
      </View>
    </Card>
  );
}

export function FuentesPruebaScreen() {
  const nav = useNavigation<Nav>();
  const [cargadas, error] = useFonts(FUENTES);

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Fuentes (temporal)" />
      <Text style={styles.aviso}>
        Solo en desarrollo. Compara las tres y dime cuál (A, B o C). El IPA va en CharisSIL en
        las tres.
      </Text>
      {error ? (
        <Text style={styles.aviso}>No cargaron las fuentes: {error.message}</Text>
      ) : !cargadas ? (
        <ActivityIndicator color={color.accent} />
      ) : (
        OPCIONES.map((o) => <Muestra key={o.letra} o={o} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  aviso: { fontSize: CUERPO_PX, color: color.textMuted, marginBottom: space.lg },
  muestra: { marginBottom: space.lg },
  etiqueta: { fontSize: CUERPO_PX, color: color.accent },
  nota: { fontSize: CUERPO_PX, color: color.textMuted },
  display: {
    fontSize: font.size.display,
    lineHeight: font.size.display * 1.15,
    letterSpacing: font.size.display * TRACKING,
    color: color.text,
  },
  h1: {
    fontSize: font.size.xxl,
    lineHeight: font.size.xxl * 1.2,
    letterSpacing: font.size.xxl * TRACKING,
    color: color.text,
  },
  cuerpo: { fontSize: CUERPO_PX, lineHeight: CUERPO_PX * 1.5, color: color.text },
  frase: { gap: space.xs },
  en: { fontSize: font.size.lg, color: color.text },
  ipa: { fontFamily: 'CharisSIL', fontSize: CUERPO_PX, color: color.textMuted },
  es: { fontSize: CUERPO_PX, color: color.textMuted },
  boton: {
    alignSelf: 'flex-start',
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  botonTexto: { fontSize: CUERPO_PX, color: color.onAccent },
});
