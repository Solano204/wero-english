import React from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, Icon, Input, Presionable, Screen, type IconName } from '@/shared/ui';
import { BotonGoogle, ALTO_BOTON_ENTRADA } from '@/features/cuenta/components/BotonGoogle';
import { color, font, radius, space, aparecer, aparecerSubiendo, desaparecer, escalon, motionDuration } from '@/theme';
import * as googleAuth from '@modules/wero-google-auth';
import { useEntrada } from '@/features/cuenta/hooks/useEntrada';

/** Cuánto de la pantalla queda en blanco arriba del título. */
const ESPACIO_SUPERIOR = 0.18;
/** Tamaño del título «Tu cuenta». */
const TITULO = 46;
/** Alto mínimo del área táctil de un enlace. */
const ALTO_ENLACE = 44;

/**
 * La entrada a Wero: «Tu cuenta».
 *
 * El camino principal es «Continuar con Google» (la hoja nativa de cuentas de Android, sin
 * navegador) y, debajo, «Entrar sin cuenta». Las cuentas locales de usuario y contraseña que ya
 * existen siguen entrando por «Ya tengo usuario y contraseña», pero aquí ya no se crean nuevas.
 *
 * Con o sin Google, todo el avance vive solo en el teléfono: Google solo dice quién eres. Por eso
 * la tarjeta «Qué guardamos» lo dice de frente.
 */
export function AuthScreen() {
  const { nav, vista, setVista, accion, username, setUsername, password, setPassword, resolverVinculo, cancelarVinculo, vinculoPendiente, avisoEntrada, busy, error, correr, hoja, conGoogle, sinCuenta, conUsuario } = useEntrada();
  const { height } = useWindowDimensions();

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
      <View style={styles.form}>
        <Animated.Text entering={aparecerSubiendo(escalon(1))} style={styles.subtitulo}>
          Con Google no escribes tu nombre ni tu correo: quedan listos solos.
        </Animated.Text>

        {avisoEntrada ? (
          <Card style={styles.avisoEntrada}>
            <Text style={styles.avisoEntradaTexto} accessibilityLiveRegion="polite" accessibilityRole="alert">
              {avisoEntrada}
            </Text>
          </Card>
        ) : null}

        <Animated.View entering={aparecerSubiendo(escalon(2))} style={styles.tarjeta}>
          <Text style={styles.tarjetaTitulo} accessibilityRole="header">
            Qué guardamos
          </Text>
          <Renglon icono="lock" texto="Tu nombre y tu correo, solo en este teléfono." />
          <Renglon icono="list" texto="Tu avance: frases, repasos, racha, juegos y lecturas." />
          <Renglon icono="phone" texto="Todo vive en este teléfono. Si desinstalas la app, se borra." />
        </Animated.View>

        <Animated.View entering={aparecerSubiendo(escalon(3))} style={styles.botones}>
          {googleAuth.disponible ? (
            <BotonGoogle onPress={() => void conGoogle()} cargando={busy && accion === 'google'} disabled={busy} />
          ) : (
            <Text style={styles.nota}>Entrar con Google está disponible en la app instalada.</Text>
          )}
          <Presionable
            onPress={() => void sinCuenta()}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Entrar sin cuenta"
            accessibilityState={{ disabled: busy, busy: busy && accion === 'sin' }}
            style={[styles.botonSecundario, busy && accion !== 'sin' && styles.apagado]}
          >
            {busy && accion === 'sin' ? <ActivityIndicator size="small" color={color.text} /> : null}
            <Text style={styles.botonSecundarioTexto}>Entrar sin cuenta</Text>
          </Presionable>
          {aviso}
        </Animated.View>

        <Animated.View entering={aparecerSubiendo(escalon(4))} style={styles.pie}>
          <Text style={styles.notaSm}>Puedes vincular o borrar tu cuenta cuando quieras, desde Ajustes.</Text>
          <Enlace texto="Ya tengo usuario y contraseña" onPress={() => setVista('usuario')} />
          <View style={styles.legalFila}>
            <Text style={styles.legalTexto}>Al continuar aceptas los</Text>
            <EnlaceLegal texto="Términos" onPress={() => nav.navigate('LegalDoc', { doc: 'terminos' })} />
            <Text style={styles.legalTexto}>y el</Text>
            <EnlaceLegal texto="Aviso de privacidad" onPress={() => nav.navigate('LegalDoc', { doc: 'privacidad' })} />
            <Text style={styles.legalTexto}>.</Text>
          </View>
          <Text style={styles.legalTexto}>
            Wero incluye lenguaje coloquial y algunas expresiones fuertes. Para mayores de 16 años.
          </Text>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: height * ESPACIO_SUPERIOR }} />
        <Animated.Text entering={aparecerSubiendo(escalon(0))} style={styles.titulo} accessibilityRole="header">
          Tu cuenta
        </Animated.Text>
        {cuerpo}
      </KeyboardAvoidingView>
      {hoja}
    </Screen>
  );
}

/** Un renglón de «Qué guardamos»: ícono de línea a la izquierda, texto a la derecha. */
function Renglon({ icono, texto }: { icono: IconName; texto: string }) {
  return (
    <View style={styles.renglon}>
      <Icon name={icono} size="md" color={color.textMuted} />
      <Text style={styles.renglonTexto}>{texto}</Text>
    </View>
  );
}

function Enlace({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Presionable onPress={onPress} accessibilityRole="button" style={styles.enlaceToque}>
      <Text style={styles.enlace}>{texto}</Text>
    </Presionable>
  );
}

/** Un enlace legal dentro de la frase: chico a la vista, de 44 dp de alto para el dedo. */
function EnlaceLegal({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Presionable onPress={onPress} accessibilityRole="link" accessibilityLabel={texto} style={styles.enlaceLegalToque}>
      <Text style={styles.enlaceLegal}>{texto}</Text>
    </Presionable>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontFamily: font.family.display,
    fontSize: TITULO,
    lineHeight: TITULO * 1.1,
    letterSpacing: TITULO * -0.015,
    color: color.text,
    marginBottom: space.sm,
  },
  subtitulo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
  form: { gap: space.lg },
  tarjeta: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
  },
  tarjetaTitulo: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text },
  renglon: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  renglonTexto: {
    flex: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
  },
  botones: { gap: space.md },
  botonSecundario: {
    height: ALTO_BOTON_ENTRADA,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.surface,
  },
  botonSecundarioTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  apagado: { opacity: 0.5 },
  error: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.wrong,
    lineHeight: font.size.sm * 1.5,
  },
  nota: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
  },
  notaSm: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    lineHeight: font.size.sm * 1.45,
  },
  pie: { gap: space.xs },
  avisoEntrada: { paddingVertical: space.md },
  avisoEntradaTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
  },
  enlaceToque: { minHeight: ALTO_ENLACE, justifyContent: 'center', alignSelf: 'flex-start' },
  enlace: { fontSize: font.size.sm, color: color.accent, fontFamily: font.family.bodyStrong },
  legalFila: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.xs },
  legalTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    lineHeight: font.size.xs * 1.6,
    color: color.textMuted,
  },
  enlaceLegalToque: { minHeight: ALTO_ENLACE, justifyContent: 'center' },
  enlaceLegal: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    color: color.textMuted,
    textDecorationLine: 'underline',
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
});
