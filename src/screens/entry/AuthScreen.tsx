import React, { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '@/types/rutas';
import Animated from 'react-native-reanimated';
import { Button, Card, Input, Screen, Presionable } from '@/shared/ui';
import { BotonGoogle } from '@/components/entrada/BotonGoogle';
import { useConsentimiento } from '@/shared/ui/HojaConsentimiento';
import { useAuthStore } from '@/estado/useAuthStore';
import { color, font, layout, space, aparecer, desaparecer, motionDuration } from '@/theme';
import * as googleAuth from '@modules/wero-google-auth';

type Vista = 'inicio' | 'usuario';
type Accion = 'google' | 'sin' | 'usuario' | 'vincular' | 'nueva' | null;

/**
 * La entrada a Wero.
 *
 * El camino principal es «Continuar con Google» (la hoja nativa de cuentas de Android, sin
 * navegador) y, debajo, «Entrar sin cuenta». Las cuentas locales de usuario y contraseña que ya
 * existen siguen entrando por «Ya tengo usuario y contraseña», pero aquí ya no se crean nuevas.
 *
 * Con o sin Google, todo el avance vive solo en el teléfono: Google solo dice quién eres. Por eso
 * el aviso de abajo lo dice de frente, igual que antes.
 */
export function AuthScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [vista, setVista] = useState<Vista>('inicio');
  const [accion, setAccion] = useState<Accion>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const {
    signIn,
    continuarSinCuenta,
    entrarConGoogle,
    resolverVinculo,
    cancelarVinculo,
    vinculoPendiente,
    aviso: avisoEntrada,
    limpiarAviso,
    busy,
    error,
    clearError,
  } = useAuthStore();

  useEffect(() => {
    clearError();
  }, [vista, clearError]);

  // Cada botón muestra su propia carga: el resto solo se bloquea.
  const correr = useCallback(async (quien: Accion, fn: () => Promise<unknown>) => {
    limpiarAviso();
    setAccion(quien);
    try {
      await fn();
    } finally {
      setAccion(null);
    }
  }, [limpiarAviso]);

  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();

  // Primero la hoja que dice qué se toma de Google; «Ahora no» deja la entrada como estaba.
  const conGoogle = useCallback(async () => {
    if (!(await pedirConsentimiento('google'))) return;
    await correr('google', entrarConGoogle);
  }, [correr, entrarConGoogle, pedirConsentimiento]);
  const sinCuenta = useCallback(() => correr('sin', continuarSinCuenta), [correr, continuarSinCuenta]);
  const conUsuario = useCallback(
    () => correr('usuario', () => signIn(username, password)),
    [correr, signIn, username, password]
  );

  const aviso = error ? (
    <Animated.Text
      entering={aparecer()}
      exiting={desaparecer(motionDuration.rapido)}
      style={styles.error}
      accessibilityLiveRegion="polite"
    >
      {error}
    </Animated.Text>
  ) : null;

  let cuerpo: React.ReactNode;
  if (vinculoPendiente) {
    const { candidato, perfil } = vinculoPendiente;
    const deQuien = candidato.username.startsWith('invitado_')
      ? 'En este teléfono ya tienes avance sin cuenta.'
      : `En este teléfono ya hay avance de «${candidato.username}».`;
    cuerpo = (
      <Animated.View entering={aparecer()} style={styles.form}>
        <Card style={styles.vinculo}>
          <Text style={styles.vinculoTitulo}>Vincular tu avance a esta cuenta</Text>
          <Text style={styles.vinculoTexto}>
            {deQuien} Si lo vinculas, lo vas a encontrar cada vez que entres con{' '}
            <Text style={styles.vinculoCorreo}>{perfil.email ?? 'tu cuenta de Google'}</Text>. No se sube nada
            a internet.
          </Text>
        </Card>
        {aviso}
        <Button
          label="Vincular mi avance"
          onPress={() => void correr('vincular', () => resolverVinculo(true))}
          loading={busy && accion === 'vincular'}
          disabled={busy}
          size="lg"
          full
        />
        <Button
          label="Empezar de cero con esta cuenta"
          variant="secondary"
          onPress={() => void correr('nueva', () => resolverVinculo(false))}
          loading={busy && accion === 'nueva'}
          disabled={busy}
          full
        />
        <Text style={styles.nota}>Si empiezas de cero, tu avance anterior se queda en el teléfono.</Text>
        <Button label="Cancelar" variant="ghost" onPress={cancelarVinculo} disabled={busy} full />
      </Animated.View>
    );
  } else if (vista === 'usuario') {
    const listo = username.trim().length >= 3 && password.length >= 6;
    cuerpo = (
      <Animated.View entering={aparecer()} style={styles.form}>
        <Input
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="carlos_92"
          textContentType="username"
        />
        <Input
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureToggle
          placeholder="Mínimo 6 caracteres"
          textContentType="password"
          onSubmitEditing={() => {
            if (listo) void conUsuario();
          }}
          returnKeyType="go"
        />
        {aviso}
        <Button
          label="Entrar"
          onPress={() => void conUsuario()}
          disabled={!listo || busy}
          loading={busy && accion === 'usuario'}
          size="lg"
          full
        />
        <Enlace texto="Volver" onPress={() => setVista('inicio')} />
      </Animated.View>
    );
  } else {
    cuerpo = (
      <Animated.View entering={aparecer()} style={styles.form}>
        {avisoEntrada ? (
          <Card style={styles.avisoEntrada}>
            <Text style={styles.avisoEntradaTexto} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {avisoEntrada}
            </Text>
          </Card>
        ) : null}
        {googleAuth.disponible ? (
          <BotonGoogle onPress={() => void conGoogle()} cargando={busy && accion === 'google'} disabled={busy} />
        ) : (
          <Text style={styles.nota}>Entrar con Google está disponible en la app instalada.</Text>
        )}
        {aviso}
        {error && googleAuth.disponible ? (
          <Button label="Reintentar" variant="secondary" onPress={() => void conGoogle()} disabled={busy} full />
        ) : null}
        <Button
          label="Entrar sin cuenta"
          variant="ghost"
          onPress={() => void sinCuenta()}
          loading={busy && accion === 'sin'}
          disabled={busy}
          full
        />
        <Enlace texto="Ya tengo usuario y contraseña" onPress={() => setVista('usuario')} />
        <View style={styles.legal}>
          <Text style={styles.legalTexto}>Al continuar aceptas los</Text>
          <View style={styles.legalFila}>
            <Enlace texto="Términos" onPress={() => nav.navigate('LegalDoc', { doc: 'terminos' })} />
            <Text style={styles.legalTexto}>y el</Text>
            <Enlace texto="Aviso de privacidad" onPress={() => nav.navigate('LegalDoc', { doc: 'privacidad' })} />
          </View>
        </View>
      </Animated.View>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.head}>
          <Text style={styles.logo}>Wero</Text>
          <Text style={styles.tagline}>Inglés real, del que se habla de verdad</Text>
        </View>

        {cuerpo}

        <Text style={styles.disclaimer}>
          Tu avance vive solo en este teléfono, entres con Google o sin cuenta. Google solo sirve para saber
          que eres tú: no se sube nada a internet. Si desinstalas la app, tu avance se va con ella.
        </Text>
      </KeyboardAvoidingView>
      {hoja}
    </Screen>
  );
}

function Enlace({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Presionable onPress={onPress} accessibilityRole="button" style={styles.enlaceToque}>
      <Text style={styles.enlace}>{texto}</Text>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, justifyContent: 'center', gap: space.xxl },
  head: { alignItems: 'center', gap: space.sm },
  logo: {
    fontSize: 46,
    fontFamily: font.family.display,
    color: color.accent,
    letterSpacing: 46 * -0.015,
  },
  tagline: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
  },
  form: { gap: space.lg },
  error: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.wrong,
    textAlign: 'center',
    lineHeight: font.size.sm * 1.5,
  },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
  },
  avisoEntrada: { paddingVertical: space.md },
  avisoEntradaTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
    textAlign: 'center',
  },
  enlaceToque: { minHeight: layout.tapMin, justifyContent: 'center' },
  legal: { alignItems: 'center' },
  legalFila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: space.xs },
  legalTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, textAlign: 'center' },
  enlace: {
    fontSize: font.size.sm,
    color: color.accent,
    textAlign: 'center',
    fontFamily: font.family.bodyStrong,
    paddingVertical: space.sm,
  },
  vinculo: { gap: space.sm },
  vinculoTitulo: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text },
  vinculoTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
  },
  vinculoCorreo: { fontFamily: font.family.bodyStrong, color: color.text },
  disclaimer: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: font.size.xs * 1.6,
    paddingHorizontal: space.md,
  },
});
