import React, { useEffect, useEffectEvent } from 'react';
import { AccessibilityInfo, Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { Icon, Presionable, Screen } from '@/shared/ui';
import { color, font, layout, motionDuration, motionEasing, space } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { textoProgreso } from '@/domain/perfilInicial';
import { usePrimerosPasos } from '@/features/cuenta/hooks/usePrimerosPasos';
import { PasoCuantas } from '@/shared/ui/PasoCuantas';
import { PreguntaPerfil } from '@/shared/ui/PreguntaPerfil';
import { PRESENTACION, Presentacion } from '@/features/cuenta/components/Presentacion';
import { ProgresoPerfil } from '@/features/cuenta/components/ProgresoPerfil';
import { ResumenPerfil } from '@/features/cuenta/components/ResumenPerfil';

/** Lo que dura el deslizamiento de una pregunta a otra (ms). */
const DESLIZA_MS = 220;

/**
 * P-01, la entrada.
 *
 * Presentación, dos preguntas (una por pantalla) y «Revisa tus respuestas». Se puede regresar a cualquier
 * pregunta, cambiar la respuesta y seguir: las demás se conservan, y si cierra la app a la mitad continúa donde
 * iba. Un «Saltar» siempre visible.
 *
 * Lo que no se copió de la competencia: su paso de notificaciones junta el permiso del sistema con el guardado de
 * ajustes en un solo botón, y si el usuario niega el permiso los ajustes quedan guardados y nada funciona, en
 * silencio. Aquí se detecta el rechazo y se dice en el resumen.
 *
 * Ninguna respuesta es obligatoria y ninguna se manda a ningún lado: todo se guarda en la tabla ajuste del teléfono,
 * y las respuestas no deciden qué frases te tocan.
 */
export function OnboardingScreen() {
  const p = usePrimerosPasos();
  const reducido = useMovimientoReducido();
  const { paso, slide, setSlide } = p;

  const confirmarSalida = () =>
    Alert.alert('¿Salir de Wero?', 'Lo que contestaste queda guardado: al volver sigues donde ibas.', [
      { text: 'Quedarme', style: 'cancel' },
      { text: 'Salir', onPress: () => BackHandler.exitApp() },
    ]);

  // El botón atrás del sistema y el gesto de atrás: una pregunta (o slide) hacia atrás; en la primera, preguntan.
  const alAtrasSistema = useEffectEvent(() => {
    if (paso === 'intro') {
      if (slide > 0) setSlide(slide - 1);
      else confirmarSalida();
    } else if (paso === 'p1') confirmarSalida();
    else p.atras();
    return true;
  });
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => alAtrasSistema());
    return () => suscripcion.remove();
  }, []);

  const anunciar = useEffectEvent(() => {
    if (paso !== 'intro') AccessibilityInfo.announceForAccessibility(textoProgreso(paso));
  });
  useEffect(() => {
    anunciar();
  }, [paso]);

  const entrada = reducido
    ? FadeIn.duration(motionDuration.rapido)
    : (p.direccion === 'adelante' ? SlideInRight : SlideInLeft).duration(DESLIZA_MS).easing(motionEasing.entrar);

  return (
    <Screen scroll>
      {paso !== 'intro' ? (
        <View style={styles.head}>
          {paso !== 'p1' ? (
            <Presionable
              onPress={p.atras}
              accessibilityRole="button"
              accessibilityLabel="Atrás"
              style={styles.atras}
            >
              <Icon name="back" size="lg" color={color.text} />
            </Presionable>
          ) : (
            <View style={styles.atras} />
          )}
          <ProgresoPerfil paso={paso} alcanzado={p.alcanzado} onIr={p.irA} />
          <Presionable
            onPress={p.saltarTodo}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Saltar la configuración"
          >
            <Text style={styles.saltar}>Saltar</Text>
          </Presionable>
        </View>
      ) : null}

      <Animated.View key={paso} entering={entrada}>
        {paso === 'intro' ? (
          <Presentacion
            slide={slide}
            onSiguiente={() => {
              if (slide + 1 < PRESENTACION.length) setSlide((v) => v + 1);
              else p.empezar();
            }}
          />
        ) : null}

        {paso === 'p1' ? (
          <PreguntaPerfil
            titulo="¿Te enseñamos las groserías?"
            bajada="El catálogo trae lenguaje fuerte marcado. Tú decides si aparece."
            opciones={[
              { label: 'Sí, para eso vine', valor: false },
              { label: 'No, déjalo limpio', valor: true },
            ]}
            valor={p.respuestas.limpio}
            onElegir={p.elegirLimpio}
            onSiguiente={p.siguiente}
            nota="Aunque salgan, cada frase trae su aviso de dónde no decirla."
          />
        ) : null}

        {paso === 'p2' ? (
          <PasoCuantas
            valor={p.respuestas.porDia}
            onChange={p.cambiarPorDia}
            desde={p.respuestas.desde}
            hasta={p.respuestas.hasta}
            onVentana={p.cambiarVentana}
            onSiguiente={p.siguiente}
          />
        ) : null}

        {paso === 'resumen' ? (
          <ResumenPerfil
            respuestas={p.respuestas}
            notifEstado={p.notifEstado}
            permisoNegado={p.permisoNegado}
            onCambiar={p.cambiarDesdeResumen}
            onListo={p.respuestas.porDia > 0 && p.notifEstado.ok && !p.permisoNegado ? p.pedirNotificaciones : p.terminar}
            onSinAvisos={p.terminar}
          />
        ) : null}
      </Animated.View>
      {p.hoja}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.lg,
  },
  atras: { width: layout.tapMin, height: layout.tapMin, alignItems: 'center', justifyContent: 'center' },
  saltar: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.sm },
});
