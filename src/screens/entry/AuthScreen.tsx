import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Button, Input, Screen } from '@/components/base';
import { useAuthStore } from '@/store';
import { color, font, space, aparecer, desaparecer, motionDuration } from '@/theme';

type Mode = 'in' | 'up';

/**
 * Alta e inicio de sesión.
 *
 * Sin Google, sin correo, sin verificación: usuario y contraseña locales.
 * La decisión tiene un costo que hay que decirle al usuario de frente:
 * si desinstala la app, su progreso se va con ella. Por eso el aviso
 * está en la pantalla y no escondido en los términos.
 */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('up');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const { signIn, signUp, busy, error, clearError } = useAuthStore();

  useEffect(() => {
    clearError();
  }, [mode, clearError]);

  const submit = useCallback(async () => {
    if (mode === 'up') await signUp(username, password);
    else await signIn(username, password);
  }, [mode, username, password, signIn, signUp]);

  const ready = username.trim().length >= 3 && password.length >= 6;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.head}>
          <Text style={styles.logo}>Wero</Text>
          <Text style={styles.tagline}>
            Inglés real, del que se habla de verdad
          </Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Usuario"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="carlos_92"
            hint={mode === 'up' ? 'Letras, números, punto y guion bajo' : undefined}
            textContentType="username"
          />

          <Input
            label="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureToggle
            placeholder="Mínimo 6 caracteres"
            textContentType="password"
            onSubmitEditing={submit}
            returnKeyType="go"
          />

          {error ? (
            <Animated.Text
              entering={aparecer()}
              exiting={desaparecer(motionDuration.rapido)}
              style={styles.error}
            >
              {error}
            </Animated.Text>
          ) : null}

          <Button
            label={mode === 'up' ? 'Crear cuenta' : 'Entrar'}
            onPress={submit}
            disabled={!ready}
            loading={busy}
            size="lg"
            full
          />

          <Pressable
            onPress={() => setMode((m) => (m === 'up' ? 'in' : 'up'))}
            hitSlop={12}
            accessibilityRole="button"
          >
            <Text style={styles.switch}>
              {mode === 'up'
                ? '¿Ya tienes cuenta? Entra aquí'
                : '¿Primera vez? Crea tu cuenta'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.disclaimer}>
          Tu cuenta vive solo en este teléfono. No pedimos correo ni
          conectamos con Google, pero eso significa que si desinstalas la
          app tu progreso se va con ella.
        </Text>
      </KeyboardAvoidingView>
    </Screen>
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
    color: color.riskStrong,
    textAlign: 'center',
  },
  switch: {
    fontSize: font.size.sm,
    color: color.accent,
    textAlign: 'center',
    fontFamily: font.family.bodyStrong,
    paddingVertical: space.sm,
  },
  disclaimer: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textFaint,
    textAlign: 'center',
    lineHeight: font.size.xs * 1.6,
    paddingHorizontal: space.md,
  },
});
