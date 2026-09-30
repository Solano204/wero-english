import React from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Header, Screen } from '@/shared/ui';
import { TextoLegal } from '@/features/cuenta/components/TextoLegal';
import { URL_ELIMINAR_CUENTA, URL_PRIVACIDAD, URL_TERMINOS, esUrlReal, fechaLegible } from '@/config/legal';
import { TEXTOS } from '@/features/cuenta/legal/textos';
import type { DocLegal } from '@/types/legal';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'LegalDoc'>;

const URLS: Record<DocLegal, string> = {
  privacidad: URL_PRIVACIDAD,
  terminos: URL_TERMINOS,
  eliminar: URL_ELIMINAR_CUENTA,
};

/**
 * Un texto legal (aviso de privacidad, términos o cómo eliminar la cuenta) leído dentro de la
 * app: va empaquetado, así que se lee sin internet. Arriba, la fecha de última actualización;
 * abajo, «Ver en la web», solo cuando la URL pública ya existe (src/config/legal.ts).
 */
export function LegalDocScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const texto = TEXTOS[params.doc];
  const url = URLS[params.doc];

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title={texto.titulo} />
      <Text style={styles.fecha}>Última actualización: {fechaLegible(texto.fecha)}</Text>
      <TextoLegal bloques={texto.bloques} />
      {esUrlReal(url) ? (
        <Button
          label="Ver en la web"
          variant="secondary"
          icon="link"
          onPress={() => void Linking.openURL(url)}
          style={styles.web}
          full
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  fecha: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  web: { marginTop: space.xl },
});
