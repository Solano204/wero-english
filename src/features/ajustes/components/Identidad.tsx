import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Icon } from '@/shared/ui';
import { color, font, radius, space } from '@/theme';
import type { User } from '@/types';

/** Quién está usando la app: con Google, su foto, nombre y correo; si no, qué tipo de cuenta es. */
export function Identidad({ user }: { user: User }) {
  const [sinFoto, setSinFoto] = useState(false);
  if (user.google_sub) {
    return (
      <View style={styles.identidad}>
        {user.foto && !sinFoto ? (
          <Image
            source={{ uri: user.foto }}
            style={styles.avatar}
            onError={() => setSinFoto(true)}
            accessibilityIgnoresInvertColors
            accessible={false}
          />
        ) : (
          <View style={[styles.avatar, styles.avatarVacio]}>
            <Icon name="smile" size="md" color={color.textMuted} />
          </View>
        )}
        <View style={styles.identidadTexto}>
          <Text style={styles.label}>{user.nombre ?? 'Tu cuenta de Google'}</Text>
          {user.email ? <Text style={styles.hint}>{user.email}</Text> : null}
        </View>
      </View>
    );
  }
  const sinCuenta = user.username.startsWith('invitado_');
  return (
    <View>
      <Text style={styles.label}>{sinCuenta ? 'Sin cuenta' : user.username}</Text>
      <Text style={styles.hint}>
        {sinCuenta
          ? 'Para ligar tu avance a Google, cierra sesión y entra con Google: te lo vamos a ofrecer.'
          : 'Cuenta con usuario y contraseña, solo en este teléfono.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identidad: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identidadTexto: { flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: radius.pill },
  avatarVacio: { backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, marginTop: space.xs },
});
