import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
  findNodeHandle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParams } from '@/types/rutas';
import { Button } from '@/shared/ui/Button';
import { Presionable } from '@/shared/ui/Presionable';
import { CONSENTIMIENTOS } from '@/config/consentimientos';
import * as consentimiento from '@/services/cuenta/consentimiento';
import type { TipoConsentimiento } from '@/services/cuenta/consentimiento';
import { color, font, radius, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';

interface Props {
  /** Qué hoja mostrar; null la cierra. */
  tipo: TipoConsentimiento | null;
  onAceptar: () => void;
  onAhoraNo: () => void;
  /** Si viene, se muestra «Leer el aviso de privacidad». */
  onLeerAviso?: () => void;
}

/**
 * La hoja que sube antes de que la app tome un dato o pida un permiso: qué se toma, para qué y
 * dónde se guarda, con «Aceptar y continuar» y «Ahora no». «Ahora no» (o tocar fuera, o el botón
 * atrás) nunca bloquea: se sigue sin esa función. Para el lector de pantalla es un diálogo
 * modal que pone el foco en el título al abrir.
 */
export function HojaConsentimiento({ tipo, onAceptar, onAhoraNo, onLeerAviso }: Props) {
  const insets = useSafeAreaInsets();
  const reducido = useMovimientoReducido();
  const titulo = useRef<Text>(null);
  // El último tipo mostrado se conserva mientras la hoja baja, para que no se vacíe a media animación.
  const [mostrado, setMostrado] = useState<TipoConsentimiento | null>(tipo);
  useEffect(() => {
    if (tipo) setMostrado(tipo);
  }, [tipo]);

  const alMostrar = () => {
    const nodo = titulo.current ? findNodeHandle(titulo.current) : null;
    if (nodo) AccessibilityInfo.setAccessibilityFocus(nodo);
  };

  const texto = mostrado ? CONSENTIMIENTOS[mostrado] : null;

  return (
    <Modal
      visible={tipo !== null}
      transparent
      // Se queda en `Modal` (tiene que cubrir el encabezado y responder al botón atrás); translúcido arriba y abajo,
      // para que no se vuelva a asomar la barra de navegación oculta ni cambie el color detrás de la hoja.
      statusBarTranslucent
      navigationBarTranslucent
      animationType={reducido ? 'fade' : 'slide'}
      onRequestClose={onAhoraNo}
      onShow={alMostrar}
    >
      <View style={styles.raiz}>
        {/* El velo: tocar fuera de la hoja es «Ahora no». No es un botón (el lector de pantalla usa los de la hoja), así que no lleva el feedback de `Presionable`. */}
        <View
          style={StyleSheet.absoluteFill}
          onStartShouldSetResponder={() => true}
          onResponderRelease={onAhoraNo}
          accessible={false}
          importantForAccessibility="no"
        />
        {texto ? (
          <View
            style={[styles.hoja, { paddingBottom: insets.bottom + space.lg }]}
            accessibilityViewIsModal
            importantForAccessibility="yes"
          >
            <View style={styles.asa} importantForAccessibility="no" accessibilityElementsHidden />
            <ScrollView contentContainerStyle={styles.contenido} bounces={false}>
              <Text ref={titulo} style={styles.titulo} accessibilityRole="header">
                {texto.titulo}
              </Text>

              <Bloque etiqueta="Qué se toma">
                {texto.toma.map((t) => (
                  <View key={t} style={styles.renglon}>
                    <View style={styles.punto} />
                    <Text style={styles.cuerpo}>{t}</Text>
                  </View>
                ))}
              </Bloque>
              <Bloque etiqueta="Para qué">
                <Text style={styles.cuerpo}>{texto.paraQue}</Text>
              </Bloque>
              <Bloque etiqueta="Dónde se guarda">
                <Text style={styles.cuerpo}>{texto.donde}</Text>
              </Bloque>

              {texto.despues ? <Text style={styles.despues}>{texto.despues}</Text> : null}

              {onLeerAviso ? (
                <Presionable onPress={onLeerAviso} accessibilityRole="link" style={styles.enlace}>
                  <Text style={styles.enlaceTexto}>Leer el aviso de privacidad</Text>
                </Presionable>
              ) : null}
            </ScrollView>

            <View style={styles.botones}>
              <Button label="Aceptar y continuar" onPress={onAceptar} size="lg" full />
              <Button label="Ahora no" variant="ghost" onPress={onAhoraNo} full />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function Bloque({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <View style={styles.bloque}>
      <Text style={styles.etiqueta} accessibilityRole="header">
        {etiqueta}
      </Text>
      {children}
    </View>
  );
}

interface OpcionesPedir {
  /**
   * Para lo que la app pide sola, sin que la persona toque nada (el permiso de notificaciones al
   * terminar una sesión): si ya dijo «Ahora no» a esta versión del aviso, no se le vuelve a insistir.
   */
  sinInsistir?: boolean;
}

/**
 * `pedir(tipo)` resuelve true si ya hay consentimiento vigente o si la persona toca «Aceptar y
 * continuar»; false con «Ahora no». La respuesta se guarda (tipo, fecha y versión del aviso).
 * La pantalla pinta `hoja` en cualquier lugar de su árbol.
 *
 * «Leer el aviso de privacidad» esconde la hoja sin contestarla, abre el aviso y, al volver a
 * esta pantalla, la hoja reaparece con la misma pregunta pendiente.
 */
export function useConsentimiento() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParams>>();
  const [abierta, setAbierta] = useState<TipoConsentimiento | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const leerAviso = () => {
    setLeyendo(true);
    nav.navigate('LegalDoc', { doc: 'privacidad' });
  };

  useFocusEffect(
    useCallback(() => {
      setLeyendo(false);
    }, [])
  );

  const pedir = async (tipo: TipoConsentimiento, { sinInsistir = false }: OpcionesPedir = {}) => {
    if (await consentimiento.vigente(tipo)) return true;
    if (sinInsistir && (await consentimiento.rechazadoVigente(tipo))) return false;
    // Una hoja a la vez: si había otra esperando, cuenta como «Ahora no».
    resolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setAbierta(tipo);
    });
  };

  const responder = (ok: boolean) => {
    const tipo = abierta;
    setAbierta(null);
    if (tipo) void consentimiento.guardar(tipo, ok);
    resolver.current?.(ok);
    resolver.current = null;
  };

  // Si la pantalla se desmonta con una hoja abierta, quien esperaba recibe «Ahora no» y no se queda colgado.
  useEffect(() => () => resolver.current?.(false), []);

  const hoja = (
    <HojaConsentimiento
      tipo={leyendo ? null : abierta}
      onAceptar={() => responder(true)}
      onAhoraNo={() => responder(false)}
      onLeerAviso={leerAviso}
    />
  );
  return { pedir, hoja };
}

const styles = StyleSheet.create({
  raiz: { flex: 1, justifyContent: 'flex-end', backgroundColor: color.veloMuro },
  hoja: {
    maxHeight: '88%',
    backgroundColor: color.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: color.border,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  asa: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: color.border,
    marginBottom: space.md,
  },
  contenido: { gap: space.lg, paddingBottom: space.lg },
  titulo: { fontFamily: font.family.heading, fontSize: font.size.xl, color: color.text },
  bloque: { gap: space.xs },
  etiqueta: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.sm,
    color: color.textMuted,
  },
  cuerpo: {
    flexShrink: 1,
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.text,
  },
  renglon: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  punto: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
    marginTop: space.sm,
  },
  despues: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.5,
    color: color.textMuted,
  },
  enlace: { minHeight: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  enlaceTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.accent },
  botones: { gap: space.sm },
});
