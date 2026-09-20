import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { color, font, layout, radius, space } from '@/theme';
import * as ads from '@/services/ads';
import { Icon } from './Icon';
import { Presionable } from './Presionable';

/**
 * Los tres huecos de publicidad, en un solo archivo.
 *
 * Las reglas de colocación son parte del producto, no del negocio, así
 * que viven en el código y no en un documento:
 *
 *   - NUNCA dentro de una sesión de estudio ni de una partida. Un
 *     anuncio a media tarjeta rompe el recuerdo que el ejercicio existe
 *     para construir, el usuario falla la siguiente y culpa a la app.
 *   - NUNCA encima del botón principal.
 *   - La barra de abajo va DEBAJO del tab bar, nunca tapándolo.
 *
 * Mientras no haya un proveedor conectado en services/ads.ts, todo esto
 * se pinta como un espacio reservado y marcado. No hay anuncio falso:
 * un placeholder honesto deja ver el hueco real que va a ocupar.
 */

/* ============================================================
   Barra de abajo, siempre visible
   ============================================================ */

export function AdBar({ bottomInset = 0 }: { bottomInset?: number }) {
  return (
    <View
      style={[styles.bar, { paddingBottom: bottomInset }]}
      accessibilityRole="none"
    >
      <Text style={styles.barLabel}>PUBLICIDAD</Text>
    </View>
  );
}

/* ============================================================
   Pantalla completa

   Se muestra al ABRIR la app. Es el formato que más desinstalaciones
   causa en móvil, así que lleva dos frenos: solo una vez al día, y con
   una cuenta de tres segundos antes de poder cerrarlo, no más. Nunca
   bloquea de verdad: pasados los tres segundos siempre hay salida.
   ============================================================ */

interface FullProps {
  visible: boolean;
  onClose: () => void;
  segundos?: number;
}

export function AdFullScreen({ visible, onClose, segundos = 3 }: FullProps) {
  const [restan, setRestan] = useState(segundos);

  useEffect(() => {
    if (!visible) {
      setRestan(segundos);
      return;
    }
    if (restan <= 0) return;
    const t = setTimeout(() => setRestan((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [visible, restan, segundos]);

  if (!visible) return null;

  return (
    <View style={styles.full}>
      <View style={styles.fullBody}>
        <Text style={styles.fullLabel}>PUBLICIDAD</Text>
        <Text style={styles.fullNota}>
          Aquí va el anuncio de pantalla completa. Se muestra una vez al
          día, al abrir, y nunca dentro de una práctica.
        </Text>
      </View>

      <Presionable
        style={styles.fullCerrar}
        onPress={restan > 0 ? undefined : onClose}
        accessibilityRole="button"
        accessibilityLabel={restan > 0 ? `Espera ${restan}` : 'Cerrar anuncio'}
      >
        <Text style={[styles.fullCerrarTexto, restan > 0 && styles.fullCerrarOff]}>
          {restan > 0 ? `Cerrar en ${restan}` : 'Cerrar'}
        </Text>
        {restan > 0 ? null : <Icon name="close" size="md" color={color.text} />}
      </Presionable>
    </View>
  );
}

/* ============================================================
   Muro por recompensa

   Lo comparten la descarga de packs y el desbloqueo de niveles: el
   usuario ve un video y a cambio abre algo. Siempre voluntario y
   siempre con una salida visible, porque un muro sin salida es una
   reseña de una estrella.
   ============================================================ */

export type ResultadoMuro = 'visto' | 'cancelado' | 'sin_anuncio';

/**
 * El muro es duro: sin ver el anuncio no se abre nada.
 *
 * Queda una sola excepción, y es en desarrollo. Mientras no haya un
 * proveedor conectado, en una build de desarrollo se concede igual;
 * si no, no habría forma de probar la app hasta que AdMob esté puesto,
 * y quedarías sin poder abrir un solo pack en tu propio teléfono.
 *
 * En una build de producción sin proveedor, bloquea. Eso es lo correcto:
 * si el anuncio no carga, no se cobra el contenido por adelantado, pero
 * tampoco se regala. Se le dice al usuario que lo intente más tarde.
 */
export async function pedirRecompensa(): Promise<ResultadoMuro> {
  if (!ads.isAvailable()) {
    // __DEV__ lo inyecta Metro; se lee así para que TypeScript no
    // necesite los tipos globales de React Native solo por esta línea.
    const enDesarrollo =
      (globalThis as { __DEV__?: boolean }).__DEV__ === true;
    return enDesarrollo ? 'visto' : 'sin_anuncio';
  }
  const visto = await ads.showRewarded();
  return visto ? 'visto' : 'cancelado';
}

/** El texto que se le enseña al usuario según por qué no pasó. */
export function razonMuro(r: ResultadoMuro): string {
  if (r === 'cancelado') {
    return 'Se cerró el anuncio antes de terminar. Puedes intentarlo otra vez.';
  }
  return 'No hay anuncios disponibles en este momento. Intenta en un rato.';
}

const styles = StyleSheet.create({
  bar: {
    minHeight: layout.adBar,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: space.sm,
    backgroundColor: color.bgAlto,
    // Una línea fina arriba: separa el anuncio de la navegación sin
    // meter otra franja de color. Que se lean como dos cosas distintas
    // es justamente el punto.
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
  },
  barLabel: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    letterSpacing: 1.4,
    color: color.textFaint,
  },
  full: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    zIndex: 100,
  },
  fullBody: {
    width: '100%',
    flex: 1,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
    marginBottom: space.lg,
  },
  fullLabel: {
    fontFamily: font.family.body,
    fontSize: font.size.xs,
    letterSpacing: 1.6,
    color: color.textFaint,
  },
  fullNota: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    textAlign: 'center',
  },
  fullCerrar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  fullCerrarTexto: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.text,
  },
  fullCerrarOff: { color: color.textFaint },
});
