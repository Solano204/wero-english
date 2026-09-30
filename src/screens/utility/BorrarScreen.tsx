import React, { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CommonActions, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Card, Header, Screen } from '@/shared/ui';
import { BotonMantener } from '@/components/legal/BotonMantener';
import { useAuthStore } from '@/estado/useAuthStore';
import { color, font, radius, space } from '@/theme';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;
type Ruta = RouteProp<RootStackParams, 'Borrar'>;

function Lista({ titulo, renglones }: { titulo: string; renglones: string[] }) {
  return (
    <View style={styles.lista}>
      <Text style={styles.subtitulo} accessibilityRole="header">
        {titulo}
      </Text>
      {renglones.map((r) => (
        <View key={r} style={styles.renglon}>
          <View style={styles.punto} />
          <Text style={styles.cuerpo}>{r}</Text>
        </View>
      ))}
    </View>
  );
}

/**
 * Las dos confirmaciones que borran (Ajustes, sección Legal):
 *
 *  - `cuenta`: la cuenta y todos los datos. Termina en la entrada, sin atrás posible (la pila
 *    entera cambia a la de entrada), con «Tu cuenta y tus datos se borraron de este teléfono.».
 *  - `datos`: todo el avance, sin cerrar la sesión (sin cuenta, el perfil completo). Termina en
 *    Practicar, como usuario nuevo.
 *
 * Dice exactamente qué se borra y qué se queda, y pide la confirmación fuerte (mantener presionado).
 */
export function BorrarScreen() {
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Ruta>();
  const user = useAuthStore((s) => s.user);
  const busy = useAuthStore((s) => s.busy);
  const error = useAuthStore((s) => s.error);
  const eliminarCuenta = useAuthStore((s) => s.eliminarCuenta);
  const borrarMisDatos = useAuthStore((s) => s.borrarMisDatos);

  const conGoogle = Boolean(user?.google_sub);
  const sinCuenta = !conGoogle && Boolean(user?.username.startsWith('invitado_'));
  const cuenta = params.modo === 'cuenta';

  const confirmar = useCallback(async () => {
    if (cuenta) {
      // Al terminar, status 'anon' cambia la navegación a la pila de entrada: no hay nada a qué regresar.
      await eliminarCuenta();
      return;
    }
    const ok = await borrarMisDatos();
    if (ok) {
      nav.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: 'Main', params: { screen: 'Practice' } }] })
      );
    }
  }, [cuenta, eliminarCuenta, borrarMisDatos, nav]);

  const avance = [
    'Tu avance y tu racha',
    'Tu mazo y tus frases atoradas',
    'Tus niveles de los juegos y tus lecturas',
    'Tus ajustes y recordatorios',
  ];

  let intro: string;
  let seBorra: string[];
  let seQueda: string[] | null;
  if (cuenta) {
    intro =
      'Se borra de este teléfono tu cuenta en Wero y todo lo tuyo. Como Wero no tiene servidor, no queda copia en ningún lado.';
    seBorra = [
      conGoogle ? 'Tu cuenta en la app (se desvincula tu cuenta de Google)' : 'Tu cuenta en la app',
      ...avance,
      'Los paquetes de audio e imágenes que solo tú descargaste',
    ];
    seQueda = null;
  } else if (sinCuenta) {
    intro = 'Como usas la app sin cuenta, se borra tu perfil completo y empiezas uno nuevo, desde cero.';
    seBorra = ['Tu perfil sin cuenta', ...avance];
    seQueda = ['La app, lista para empezar de nuevo sin cuenta'];
  } else {
    intro = 'Tu avance vuelve a cero, pero sigues dentro con tu sesión.';
    seBorra = avance;
    seQueda = [conGoogle ? 'Tu sesión con Google (tu nombre, correo y foto)' : 'Tu usuario y tu contraseña'];
  }

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title={cuenta ? 'Borrar cuenta y datos' : 'Borrar todos mis datos'} />
      <View style={styles.bloques}>
        <Text style={styles.cuerpo}>{intro}</Text>

        <Card style={styles.card}>
          <Lista titulo="Se borra" renglones={seBorra} />
          {seQueda ? <Lista titulo="Se queda" renglones={seQueda} /> : null}
        </Card>

        <Text style={[styles.cuerpo, styles.fuerte]}>No se puede deshacer.</Text>

        {cuenta && conGoogle ? (
          <View style={styles.lista}>
            <Text style={styles.subtitulo} accessibilityRole="header">
              Quitarle a Wero el acceso a tu cuenta de Google
            </Text>
            <Text style={styles.cuerpo}>
              Wero no guarda nada en tu cuenta de Google. Si además quieres quitarle el permiso de identificarte:
            </Text>
            {[
              'Entra a myaccount.google.com.',
              'Ve a Seguridad.',
              'Abre «Tus conexiones con apps y servicios de terceros».',
              'Busca Wero y quítale el acceso.',
            ].map((paso, i) => (
              <View key={paso} style={styles.renglon}>
                <Text style={[styles.cuerpo, styles.numero]}>{i + 1}.</Text>
                <Text style={styles.cuerpo}>{paso}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {error ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <BotonMantener
          etiqueta="Mantén presionado para borrar"
          cargando={busy}
          onConfirmar={() => void confirmar()}
          dialogo={{
            titulo: cuenta ? '¿Borrar tu cuenta y tus datos?' : '¿Borrar todos tus datos?',
            mensaje: `${intro} No se puede deshacer.`,
            boton: cuenta ? 'Borrar cuenta y datos' : 'Borrar mis datos',
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bloques: { gap: space.lg },
  card: { gap: space.lg },
  lista: { gap: space.sm },
  subtitulo: { fontFamily: font.family.heading, fontSize: font.size.lg, color: color.text },
  cuerpo: {
    flexShrink: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
  },
  fuerte: { fontFamily: font.family.bodyStrong, color: color.wrong },
  renglon: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  punto: { width: 6, height: 6, borderRadius: radius.pill, backgroundColor: color.wrong, marginTop: space.sm },
  numero: { minWidth: 20, color: color.textMuted },
  error: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.wrong,
    textAlign: 'center',
  },
});
