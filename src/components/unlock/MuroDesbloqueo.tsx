import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { Button, Icon } from '@/components/base';
import { useAuthStore, useUnlockStore } from '@/store';
import type { TipoDesbloqueo } from '@/db/unlock';
import { color, filoLuz, font, radius, shadow, sol, space, aparecer, aparecerSubiendo } from '@/theme';

interface Props {
  tipo: TipoDesbloqueo;
  id: string;
  /** Cómo se llama lo que se abre. Va en el título. */
  nombre: string;
  /** Qué hay dentro, en una línea. */
  detalle?: string;
  onVolver?: () => void;
  children: React.ReactNode;
}

/**
 * Muro de desbloqueo.
 *
 * Cubre el contenido con desenfoque en vez de esconderlo. Se ve que hay
 * algo detrás, que es justo lo que da ganas de abrirlo, pero no se puede
 * usar ni leer a medias.
 *
 * Tres cosas que el muro dice explícitamente, porque son las tres dudas
 * que tiene cualquiera antes de tocar un botón que dice "anuncio":
 *
 *   · un anuncio, una vez
 *   · queda abierto para siempre, también sin internet
 *   · no se vuelve a pedir
 *
 * Y una regla que no se negocia: esto NUNCA cubre la sesión de frases al
 * azar, el progreso propio ni los ajustes. Se cobra por contenido extra,
 * no por usar la app.
 */
export function MuroDesbloqueo({
  tipo,
  id,
  nombre,
  detalle,
  onVolver,
  children,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const abierto = useUnlockStore((s) => s.abierto(tipo, id));
  const abrir = useUnlockStore((s) => s.abrir);
  const [abriendo, setAbriendo] = useState(false);

  if (abierto) return <>{children}</>;

  const desbloquear = async () => {
    if (!user || abriendo) return;
    setAbriendo(true);
    await abrir(user.id, tipo, id);
    setAbriendo(false);
  };

  return (
    <View style={styles.raiz}>
      {/* El contenido sigue montado detrás: al desbloquear no hay que
          volver a cargarlo y la transición es instantánea. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {children}
      </View>

      <Animated.View entering={aparecer()} style={StyleSheet.absoluteFill}>
        <BlurView intensity={38} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.velo]} />
      </Animated.View>

      <Animated.View entering={aparecerSubiendo()} style={styles.centro}>
        <LinearGradient
          colors={filoLuz}
          start={sol.start}
          end={sol.end}
          style={styles.filo}
        >
          <View style={styles.caja}>
            <View style={styles.candado}>
              <Icon name="lock" size="lg" color={color.accent} />
            </View>

            <Text style={styles.titulo}>{nombre}</Text>
            {detalle ? <Text style={styles.detalle}>{detalle}</Text> : null}

            <View style={styles.trato}>
              <Punto texto="Un anuncio, una sola vez" />
              <Punto texto="Queda abierto para siempre, también sin internet" />
              <Punto texto="No se te vuelve a pedir aquí" />
            </View>

            <Button
              label={abriendo ? 'Abriendo…' : 'Ver anuncio y abrir'}
              accessibilityHint="Muestra un anuncio y abre esto para siempre, también sin internet"
              onPress={desbloquear}
              disabled={abriendo}
              full
            />
            {onVolver ? (
              <Button label="Ahora no" variant="ghost" onPress={onVolver} full />
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

function Punto({ texto }: { texto: string }) {
  return (
    <View style={styles.punto}>
      <Icon name="check" size="sm" color={color.accent} />
      <Text style={styles.puntoTxt}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1 },
  velo: { backgroundColor: color.veloMuro },
  centro: { flex: 1, justifyContent: 'center', padding: space.lg },
  filo: { borderRadius: radius.xl, padding: 1, ...shadow.raised },
  caja: {
    borderRadius: radius.xl - 1,
    backgroundColor: color.surface,
    padding: space.xl,
    gap: space.md,
  },
  candado: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.accentSoft,
  },
  titulo: {
    fontSize: font.size.xl,
    fontFamily: font.family.display,
    color: color.text,
    textAlign: 'center',
  },
  detalle: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    textAlign: 'center',
    lineHeight: font.size.md * 1.5,
  },
  trato: { gap: space.sm, paddingVertical: space.sm },
  punto: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  puntoTxt: { flex: 1, fontFamily: font.family.body, fontSize: font.size.sm, color: color.text, lineHeight: font.size.sm * 1.5 },
});
