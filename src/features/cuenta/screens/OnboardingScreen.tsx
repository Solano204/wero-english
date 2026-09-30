import React from 'react';
import { conteo } from '@/domain/texto';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, ProgressBar, Screen, Presionable } from '@/shared/ui';
import { color, font, space } from '@/theme';
import { usePrimerosPasos } from '@/features/cuenta/hooks/usePrimerosPasos';
import { PasoCuantas } from '@/features/cuenta/components/PasoCuantas';
import { Pregunta } from '@/features/cuenta/components/Pregunta';
import { PRESENTACION, Presentacion } from '@/features/cuenta/components/Presentacion';

/**
 * P-01, la entrada.
 *
 * Cinco preguntas, una por pantalla, tres opciones cada una y un
 * "Saltar" siempre visible. La forma está copiada de la competencia
 * porque ahí la tienen bien: una decisión a la vez se contesta, una
 * pantalla con cinco campos se abandona.
 *
 * Lo que no se copió: el paso de notificaciones de ellos junta el
 * permiso del sistema con el guardado de ajustes en un solo botón, y si
 * el usuario niega el permiso los ajustes quedan guardados y nada
 * funciona, en silencio. Aquí se detecta el rechazo y se dice en la
 * misma pantalla.
 *
 * Ninguna respuesta es obligatoria y ninguna se manda a ningún lado:
 * todo se guarda en la tabla ajuste del teléfono.
 */
export function OnboardingScreen() {
  const { user, settings, paso, permisoNegado, notifEstado, avanzar, slide, setSlide, terminar, saltarTodo, hoja, pedirNotificaciones, total } = usePrimerosPasos();

  return (
    <Screen scroll>
      <View style={styles.head}>
        <View style={styles.barra}>
          <ProgressBar value={paso} total={total} />
        </View>
        {paso > 0 ? (
          <Presionable
            onPress={saltarTodo}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Saltar la configuración"
          >
            <Text style={styles.saltar}>Saltar</Text>
          </Presionable>
        ) : null}
      </View>

      {paso === 0 ? (
        <Presentacion
          slide={slide}
          onSiguiente={() => {
            if (slide + 1 < PRESENTACION.length) setSlide((v) => v + 1);
            else avanzar();
          }}
        />
      ) : null}

      {paso === 1 ? (
        <Pregunta
          titulo="¿Te enseñamos las groserías?"
          bajada="El catálogo trae lenguaje fuerte marcado. Tú decides si aparece."
          opciones={[
            { label: 'Sí, para eso vine', valor: false },
            { label: 'No, déjalo limpio', valor: true },
          ]}
          onPick={(v) => {
            if (user) void settings.set(user.id, 'modoLimpio', Boolean(v));
            avanzar();
          }}
          nota="Aunque salgan, cada frase trae su aviso de dónde no decirla."
        />
      ) : null}

      {paso === 2 ? (
        <PasoCuantas
          valor={settings.notifPorDia}
          onChange={(n) => {
            if (user) void settings.set(user.id, 'notifPorDia', n);
          }}
          desde={settings.notifDesde}
          hasta={settings.notifHasta}
          onVentana={(d, h) => {
            if (!user) return;
            void settings.set(user.id, 'notifDesde', d);
            void settings.set(user.id, 'notifHasta', h);
          }}
          onSiguiente={avanzar}
        />
      ) : null}

      {paso === 3 ? (
        <View style={styles.paso}>
          <Text style={styles.titulo}>Ya está</Text>
          <Text style={styles.bajada}>
            {settings.notifPorDia > 0
              ? `Te van a llegar ${conteo(settings.notifPorDia, 'frase')} al día entre las ${settings.notifDesde} y las ${settings.notifHasta}.`
              : 'No te vamos a mandar nada. Puedes prenderlo después en Ajustes.'}
          </Text>

          {!notifEstado.ok ? (
            <Card style={styles.aviso}>
              <Text style={styles.avisoTitulo}>Aquí todavía no llegan</Text>
              <Text style={styles.avisoTexto}>
                {notifEstado.razon} Tus ajustes se guardan de una vez, así que
                cuando eso pase ya quedan puestos.
              </Text>
            </Card>
          ) : permisoNegado ? (
            <Card style={styles.aviso}>
              <Text style={styles.avisoTitulo}>El permiso quedó apagado</Text>
              <Text style={styles.avisoTexto}>
                Sin permiso no llega ninguna frase. Se prende desde los ajustes
                del teléfono, en la sección de notificaciones de Wero. La app
                funciona igual sin eso.
              </Text>
            </Card>
          ) : null}

          <View style={styles.acciones}>
            {settings.notifPorDia > 0 && !permisoNegado && notifEstado.ok ? (
              <Button
                label="Permitir y empezar"
                onPress={pedirNotificaciones}
                full
                size="lg"
              />
            ) : null}
            <Button
              label={
                notifEstado.ok && !permisoNegado
                  ? 'Empezar sin avisos'
                  : 'Entrar a la app'
              }
              variant={
                settings.notifPorDia > 0 && !permisoNegado && notifEstado.ok
                  ? 'ghost'
                  : 'primary'
              }
              onPress={terminar}
              full
            />
          </View>
        </View>
      ) : null}
      {hoja}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginBottom: space.xl,
  },
  barra: { flex: 1 },
  saltar: { color: color.textMuted, fontFamily: font.family.body, fontSize: font.size.sm },
  paso: { gap: space.md },
  titulo: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  bajada: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  aviso: { gap: 4 },
  avisoTitulo: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.riskWarn,
  },
  avisoTexto: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  acciones: { gap: space.sm, marginTop: space.lg },
});
