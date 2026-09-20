import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Text } from 'react-native';
import { imageSource } from '@/services/media';
import { blur, color, filoLuz, font, gradiente, radius, shadow, sol, space } from '@/theme';
import { Presionable } from './Presionable';

/** Dos letras a partir del id de la portada: 'dia_a_dia' -> 'DD'. */
function iniciales(id: string): string {
  const partes = id.split(/[_\s-]+/).filter(Boolean);
  const a = partes[0];
  if (!a) return '';
  const b = partes[1];
  if (!b) return a.slice(0, 2).toUpperCase();
  return (a[0]! + b[0]!).toUpperCase();
}

interface Props {
  children: ReactNode;
  onPress?: () => void;
  /** Toque largo, para acciones secundarias (p. ej. oír algo sin abrir la tarjeta). */
  onLongPress?: () => void;
  style?: ViewStyle;
  elevated?: boolean;
  /**
   * Id de degradado para las tarjetas que hacen de portada: una
   * categoría, un juego, un mundo. Sin esto la tarjeta es vidrio liso.
   */
  portada?: keyof typeof gradiente | string;
  /**
   * Alto del hueco de portada. Cuando viene, la tarjeta reserva esa
   * franja arriba SIEMPRE, exista la imagen o no. Si el alto cambiara
   * según haya archivo, la lista entera se reacomodaría el día que
   * metas las imágenes, y hasta entonces se ve distinta a como va a
   * quedar.
   */
  altoPortada?: number;
  /**
   * Ruta de la imagen de portada, tipo 'img/mundos/calle.webp'.
   *
   * Si el archivo no existe, la tarjeta se queda con su degradado y no
   * pasa nada. Así se pueden ir metiendo las imágenes de una en una sin
   * que la pantalla se vea rota mientras tanto, que es el estado en el
   * que va a vivir esto durante semanas.
   */
  imagen?: string | null;
}

/**
 * Superficie de vidrio.
 *
 * La profundidad la da el FILO DE LUZ, no el desenfoque: una envoltura
 * de 1px pintada como degradado, que brilla arriba a la izquierda (donde
 * está el sol) y se apaga abajo a la derecha. Sobre tinta, una tarjeta
 * con filo se lee como una capa de vidrio; una con borde parejo se lee
 * como un rectángulo dibujado.
 *
 * Cuesta dos vistas y ninguna GPU, así que va en TODAS las tarjetas. El
 * BlurView queda para las barras flotantes, que es donde hay algo
 * moviéndose por detrás que valga la pena desenfocar.
 *
 * El acento ya NO se pinta como franja izquierda. Esa franja partía
 * cada tarjeta en dos y con veinte en pantalla la lista parecía un
 * código de barras.
 */
export function Card({
  children,
  onPress,
  onLongPress,
  style,
  elevated,
  portada,
  imagen,
  altoPortada,
}: Props) {
  const [imagenFallo, setImagenFallo] = React.useState(false);

  /*
   * Reparto del `style` entre la envoltura y el cuerpo.
   *
   * La envoltura pinta el filo de luz y lleva la sombra, asi que solo le
   * corresponde lo que situa la tarjeta en la pagina. Todo lo que ordena
   * el contenido (padding, gap, alineacion) tiene que ir en el cuerpo: si
   * se queda fuera, el padding se vuelve un marco visible y se ve una
   * tarjeta dentro de otra.
   */
  const plano = (Array.isArray(style) ? Object.assign({}, ...style) : style ?? {}) as Record<string, unknown>;
  const FUERA = [
    'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
    'marginHorizontal', 'marginVertical', 'width', 'minWidth', 'maxWidth',
    'height', 'minHeight', 'maxHeight', 'alignSelf', 'flex', 'flexGrow',
    'flexShrink', 'position', 'top', 'bottom', 'left', 'right', 'zIndex',
  ] as const;
  const estiloFuera: Record<string, unknown> = {};
  const estiloDentro: Record<string, unknown> = { ...plano };
  for (const k of FUERA) {
    if (plano[k] !== undefined) {
      estiloFuera[k] = plano[k];
      delete estiloDentro[k];
    }
  }
  const fuente = imagen && !imagenFallo ? imageSource(imagen) : null;
  const marco: ViewStyle[] = [
    styles.card,
    // El acento ya no pinta borde. Queda como línea fina abajo, que
    // marca la categoría sin encerrar la tarjeta.
  ].filter(Boolean) as ViewStyle[];

  const colores = portada ? gradiente[portada] ?? gradiente.neutro : null;

  const cuerpo = (
    <View style={marco}>
      {fuente ? (
        <Image
          source={fuente}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImagenFallo(true)}
        />
      ) : colores ? (
        <LinearGradient
          colors={[colores[0], colores[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : Platform.OS === 'ios' ? (
        // El desenfoque solo en iOS. En Android una BlurView cuesta una
        // vista nativa por tarjeta y con quince en pantalla se siente al
        // hacer scroll. Ahí la tarjeta va sólida y, gracias al filo de
        // luz, nadie nota la diferencia.
        <BlurView
          intensity={blur.suave}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {colores || fuente ? <View style={styles.velo} /> : null}

      {altoPortada ? (
        <View style={[styles.portada, { height: altoPortada }]}>
          {!fuente ? (
            <Text style={styles.portadaVacia}>
              {portada ? iniciales(String(portada)) : ''}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.contenido}>{children}</View>
    </View>
  );

  // Envoltura de 1px con el borde degradado. Es lo que convierte la
  // tarjeta en una lámina con canto, en vez de un bloque plano.
  const body = (
    <LinearGradient
      colors={filoLuz}
      start={sol.start}
      end={sol.end}
      style={[
        styles.filo,
        elevated ? styles.elevated : styles.apoyada,
        estiloFuera as ViewStyle,
      ].filter(Boolean) as ViewStyle[]}
    >
      {cuerpo}
    </LinearGradient>
  );

  if (!onPress && !onLongPress) return body;

  return (
    <Presionable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
    >
      {body}
    </Presionable>
  );
}

const styles = StyleSheet.create({
  /** Envoltura de 1px: aquí vive el filo de luz y la sombra. */
  filo: {
    borderRadius: radius.lg,
    padding: 1,
  },
  apoyada: shadow.card,
  elevated: shadow.raised,
  card: {
    // Un punto menos de radio que el filo, para que el canto quede
    // parejo por dentro y por fuera.
    borderRadius: radius.lg - 1,
    backgroundColor: color.surface,
    overflow: 'hidden',
  },
  /**
   * Sobre tinta el velo oscurece: el texto es hueso claro, así que lo
   * que hay que hacer es hundir la portada, no aclararla.
   */
  velo: {
    ...StyleSheet.absoluteFill,
    backgroundColor: color.veloPortada,
  },
  /**
   * El hueco de la portada. Mientras no haya archivo se ve el degradado
   * con la inicial en grande; cuando metas la imagen, ocupa esta misma
   * franja y nada se mueve de lugar.
   */
  portada: { alignItems: 'center', justifyContent: 'center', padding: space.md },
  portadaVacia: {
    fontSize: 34,
    fontFamily: font.family.display,
    letterSpacing: 2,
    color: color.textSobrePortada,
  },
  /*
   * `gap` por defecto dentro de toda tarjeta.
   *
   * Sin él, título, cuerpo y etiqueta quedaban pegados y la tarjeta se
   * leía como un párrafo en vez de como tres cosas distintas. Es el
   * mismo problema repetido en todas las secciones, así que se arregla
   * aquí una vez y no pantalla por pantalla.
   *
   * Una pantalla que necesite otro aire lo pasa en `style` y gana, porque
   * el estilo propio se aplica después.
   */
  contenido: { padding: space.lg, gap: space.md },
});
