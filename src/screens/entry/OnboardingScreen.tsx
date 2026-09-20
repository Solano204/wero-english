import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, ProgressBar, Screen, Presionable } from '@/components/base';
import { NOTIF_MAX_POR_DIA } from '@/db/settings';
import { useAuthStore, useSettingsStore } from '@/store';
import { loadContent } from '@/store/content';
import * as notifications from '@/services/notifications';
import { color, font, layout, radius, space, aparecer } from '@/theme';
import type { Nivel } from '@/types';

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
  const user = useAuthStore((s) => s.user);
  const settings = useSettingsStore();
  const [paso, setPaso] = useState(0);
  const [permisoNegado, setPermisoNegado] = useState(false);
  // En Expo Go no hay notificaciones desde el SDK 53. Se dice tal cual
  // en vez de fingir que el usuario negó un permiso que nunca se pidió.
  const notifEstado = useMemo(() => notifications.isAvailable(), []);

  const avanzar = useCallback(() => setPaso((p) => p + 1), []);
  const [slide, setSlide] = useState(0);

  const terminar = useCallback(async () => {
    if (!user) return;
    await settings.set(user.id, 'onboardingHecho', true);
  }, [user, settings]);

  const saltarTodo = useCallback(async () => {
    // Saltar deja los valores por omisión y entra. Nunca se atrapa a
    // nadie en el onboarding.
    await terminar();
  }, [terminar]);

  const pedirNotificaciones = useCallback(async () => {
    if (!user) return;
    if (!notifEstado.ok) {
      await terminar();
      return;
    }
    const ok = await notifications.requestPermission();
    if (!ok) {
      setPermisoNegado(true);
      await settings.set(user.id, 'notificaciones', false);
      return;
    }
    await settings.set(user.id, 'notificaciones', true);
    await notifications.setupChannel();
    await notifications.scheduleNext({
      usuarioId: user.id,
      config: loadContent().notificaciones,
      filter: settings.filter(),
      hora: settings.horaNotificacion,
      racha: 0,
      porDia: settings.notifPorDia,
      desde: settings.notifDesde,
      hasta: settings.notifHasta,
    });
    await terminar();
  }, [user, settings, terminar, notifEstado]);

  const total = 6;

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
          titulo="¿Qué tanto inglés traes?"
          bajada="Para no ahogarte con jerga el primer día"
          opciones={[
            { label: 'Entiendo poco', valor: [1] },
            { label: 'Me defiendo', valor: [1, 2] },
            { label: 'Entiendo casi todo, pero no todo', valor: [1, 2, 3] },
          ]}
          onPick={(v) => {
            if (user) void settings.set(user.id, 'niveles', v as Nivel[]);
            avanzar();
          }}
          nota="Lo puedes cambiar cuando quieras en Ajustes."
        />
      ) : null}

      {paso === 2 ? (
        <Pregunta
          titulo="¿Dónde se te traba el inglés?"
          bajada="Con eso decidimos con qué mundo empiezas"
          opciones={[
            { label: 'En series y streams', valor: 'media' },
            { label: 'En el trabajo', valor: 'trabajo' },
            { label: 'Con amigos gringos', valor: 'amigos' },
            { label: 'En todos lados', valor: 'todo' },
          ]}
          onPick={(v) => {
            if (user) void settings.set(user.id, 'dondeSeTraba', String(v));
            avanzar();
          }}
        />
      ) : null}

      {paso === 3 ? (
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

      {paso === 4 ? (
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

      {paso === 5 ? (
        <View style={styles.paso}>
          <Text style={styles.titulo}>Ya está</Text>
          <Text style={styles.bajada}>
            {settings.notifPorDia > 0
              ? `Te van a llegar ${settings.notifPorDia} frases al día entre las ${settings.notifDesde} y las ${settings.notifHasta}.`
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
    </Screen>
  );
}

/**
 * Las tres pantallas de bienvenida.
 *
 * No es un tour de funciones. Un tour de funciones se salta y no se
 * recuerda. Son tres promesas concretas, y la del medio es la única que
 * ningún competidor puede hacer: te decimos con quién sí y con quién no.
 */
const PRESENTACION: {
  titulo: string;
  cuerpo: string;
  pie: string;
  tinte: string;
}[] = [
  {
    titulo: 'Inglés del que de verdad se oye',
    cuerpo:
      'Nada de "the cat is on the table". Aquí está lo que dicen en los streams, en el trabajo y en la calle: 1,524 frases con audio, imagen y su pronunciación.',
    pie: 'Ocho mundos, de Día a día a Calle y jerga.',
    tinte: color.world.calle,
  },
  {
    titulo: 'Y con quién NO decirlo',
    cuerpo:
      'Cada frase trae su nivel de riesgo: sabes si va con tus amigos o si te puede costar una entrevista.',
    pie: 'Lo ves en la ficha de cada frase.',
    tinte: color.riskWarn,
  },
  {
    titulo: 'Tres minutos al día, sin castigos',
    cuerpo:
      'Sin vidas y sin cronómetro. Si un día no entras, la app no te lo menciona. Tu avance se queda guardado en tu teléfono aunque vuelvas en un mes.',
    pie: 'Ahora sí, tres preguntas rápidas.',
    tinte: color.correct,
  },
];

function Presentacion({
  slide,
  onSiguiente,
}: {
  slide: number;
  onSiguiente: () => void;
}) {
  const s = PRESENTACION[slide];
  if (!s) return null;

  return (
    <Animated.View entering={aparecer()} style={styles.paso}>
      <View style={[styles.marca, { backgroundColor: s.tinte }]} />
      <Text style={styles.titulo}>{s.titulo}</Text>
      <Text style={styles.bajada}>{s.cuerpo}</Text>
      <Text style={styles.nota}>{s.pie}</Text>

      <View style={styles.puntos}>
        {PRESENTACION.map((_, i) => (
          <View
            key={i}
            style={[styles.punto, i === slide && styles.puntoOn]}
          />
        ))}
      </View>

      <Button
        label={slide + 1 < PRESENTACION.length ? 'Siguiente' : 'Empezar'}
        onPress={onSiguiente}
        full
        size="lg"
      />
    </Animated.View>
  );
}

interface Opcion {
  label: string;
  valor: unknown;
}

function Pregunta({
  titulo,
  bajada,
  opciones,
  onPick,
  nota,
}: {
  titulo: string;
  bajada: string;
  opciones: Opcion[];
  onPick: (valor: unknown) => void;
  nota?: string;
}) {
  return (
    <Animated.View entering={aparecer()} style={styles.paso}>
      <Text style={styles.titulo}>{titulo}</Text>
      <Text style={styles.bajada}>{bajada}</Text>

      <View style={styles.opciones}>
        {opciones.map((o) => (
          <Presionable
            key={o.label}
            onPress={() => onPick(o.valor)}
            accessibilityRole="button"
            accessibilityLabel={o.label}
            style={styles.opcion}
          >
            <Text style={styles.opcionTexto}>{o.label}</Text>
          </Presionable>
        ))}
      </View>

      {nota ? <Text style={styles.nota}>{nota}</Text> : null}
    </Animated.View>
  );
}

/**
 * El paso de las notificaciones.
 *
 * El deslizador arranca en cuatro y no en cero. Cero sería lo honesto y
 * también significaría que nadie recibe nunca nada, que es la forma más
 * rápida de matar la retención del día siete. Diez, como la
 * competencia, ya se siente encima. Cuatro es el punto donde hace
 * hábito sin molestar.
 */
function PasoCuantas({
  valor,
  onChange,
  desde,
  hasta,
  onVentana,
  onSiguiente,
}: {
  valor: number;
  onChange: (n: number) => void;
  desde: string;
  hasta: string;
  onVentana: (desde: string, hasta: string) => void;
  onSiguiente: () => void;
}) {
  const opciones = [0, 2, 4, 6, 8, 12].filter((n) => n <= NOTIF_MAX_POR_DIA);
  const ventanas: { label: string; desde: string; hasta: string }[] = [
    { label: 'Todo el día', desde: '09:00', hasta: '21:00' },
    { label: 'Solo en la mañana', desde: '08:00', hasta: '13:00' },
    { label: 'Solo en la tarde', desde: '15:00', hasta: '21:00' },
  ];

  return (
    <Animated.View entering={aparecer()} style={styles.paso}>
      <Text style={styles.titulo}>Recibe frases todo el día</Text>
      <Text style={styles.bajada}>
        Cada aviso es una sola frase
      </Text>

      <Card style={styles.previa}>
        <Text style={styles.previaApp}>Wero · ahora</Text>
        <Text style={styles.previaTexto}>
          ¿Sabes qué significa Out of pocket?
        </Text>
      </Card>

      <Text style={styles.etiqueta}>Cuántas al día</Text>
      <View style={styles.chips}>
        {opciones.map((n) => (
          <Presionable
            key={n}
            onPress={() => onChange(n)}
            accessibilityRole="button"
            accessibilityLabel={`${n} al día`}
            style={[styles.chip, valor === n && styles.chipOn]}
          >
            <Text style={[styles.chipTexto, valor === n && styles.chipTextoOn]}>
              {n === 0 ? 'ninguna' : n}
            </Text>
          </Presionable>
        ))}
      </View>

      {valor > 0 ? (
        <>
          <Text style={styles.etiqueta}>A qué horas</Text>
          <View style={styles.chips}>
            {ventanas.map((v) => {
              const activa = v.desde === desde && v.hasta === hasta;
              return (
                <Presionable
                  key={v.label}
                  onPress={() => onVentana(v.desde, v.hasta)}
                  accessibilityRole="button"
                  accessibilityLabel={v.label}
                  style={[styles.chip, activa && styles.chipOn]}
                >
                  <Text
                    style={[styles.chipTexto, activa && styles.chipTextoOn]}
                  >
                    {v.label}
                  </Text>
                </Presionable>
              );
            })}
          </View>
        </>
      ) : null}

      <Button label="Siguiente" onPress={onSiguiente} full />
    </Animated.View>
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
  opciones: { gap: space.sm, marginTop: space.md },
  opcion: {
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.lg,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  opcionTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  nota: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  previa: { gap: 2, backgroundColor: color.surfaceAlt },
  previaApp: { fontFamily: font.family.body, fontSize: font.size.xs, color: color.textFaint },
  previaTexto: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  etiqueta: {
    fontSize: font.size.xs,
    color: color.textFaint,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  chipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  chipTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  chipTextoOn: { color: color.accent, fontFamily: font.family.bodyStrong },
  aviso: { gap: 4 },
  avisoTitulo: {
    fontSize: font.size.md,
    fontFamily: font.family.bodyStrong,
    color: color.riskWarn,
  },
  avisoTexto: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  acciones: { gap: space.sm, marginTop: space.lg },
  marca: {
    width: 48,
    height: 6,
    borderRadius: radius.pill,
    marginBottom: space.md,
  },
  puntos: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.xl,
    marginBottom: space.lg,
  },
  punto: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: color.border,
  },
  puntoOn: { backgroundColor: color.accent, width: 22 },
});
