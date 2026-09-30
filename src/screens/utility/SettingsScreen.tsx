import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Image, StyleSheet, Switch, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Header, Icon, Screen, Presionable } from '@/components/base';
import { SectionTitle } from '@/components/list';
import { useConsentimiento } from '@/components/legal';
import { useAuthStore, useSettingsStore } from '@/store';
import { NOTIF_MAX_POR_DIA } from '@/db/settings';
import { setSimularCargaLenta } from '@/hooks/useCarga';
import * as notifications from '@/services/notifications';
import * as speech from '@/services/speech';
import { color, font, layout, radius, space } from '@/theme';
import type { Nivel } from '@/types';
import type { RootStackParams } from '@/navigation/routes';

type Nav = NativeStackNavigationProp<RootStackParams>;

/** P-11, ajustes. */
export function SettingsScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const eliminarCuenta = useAuthStore((s) => s.eliminarCuenta);
  const s = useSettingsStore();
  const [busy, setBusy] = useState(false);
  const [cargaLenta, setCargaLenta] = useState(false);
  const { pedir: pedirConsentimiento, hoja } = useConsentimiento();
  const micEstado = useMemo(() => speech.isAvailable(), []);
  const notifEstado = useMemo(() => notifications.isAvailable(), []);

  const cambiar = useCallback(
    async <K extends keyof typeof s>(key: K, value: (typeof s)[K]) => {
      if (!user) return;
      // El cast es necesario: el tipo del store incluye métodos además
      // de los ajustes, y set() solo acepta las claves de Settings.
      await s.set(user.id, key as never, value as never);
    },
    [user, s]
  );

  const alternarNivel = useCallback(
    (n: Nivel) => {
      const tiene = s.niveles.includes(n);
      // Nunca se pueden apagar los tres: quedaría una app sin contenido.
      if (tiene && s.niveles.length === 1) return;
      const next = tiene
        ? s.niveles.filter((x) => x !== n)
        : [...s.niveles, n].sort();
      void cambiar('niveles', next as never);
    },
    [s.niveles, cambiar]
  );

  const borrarCuenta = useCallback(() => {
    Alert.alert(
      'Eliminar tu cuenta',
      'Se borra de este teléfono todo tu avance: tarjetas, rachas, juegos y frases guardadas. Wero no tiene servidor, así que no queda copia en ningún lado. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            setBusy(true);
            try {
              await notifications.cancelAll();
              await eliminarCuenta();
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }, [user, eliminarCuenta]);

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Ajustes" />

      <SectionTitle title="Contenido" />
      <Card style={styles.card}>
        <Toggle
          label="Modo limpio"
          hint="Esconde todas las frases con groserías"
          value={s.modoLimpio}
          onChange={(v) => void cambiar('modoLimpio', v as never)}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.label}>Dificultad</Text>
        <Text style={styles.hint}>
          Apaga los niveles que no quieras ver en tus sesiones
        </Text>
        <View style={styles.levels}>
          {([1, 2, 3] as Nivel[]).map((n) => (
            <Button
              key={n}
              label={['Fácil', 'Media', 'Difícil'][n - 1] ?? ''}
              variant="secondary"
              onPress={() => alternarNivel(n)}
              style={s.niveles.includes(n) ? styles.levelOn : styles.level}
            />
          ))}
        </View>
      </Card>

      <SectionTitle title="Sesión" />
      <Card style={styles.card}>
        <Stepper
          label="Frases por sesión"
          value={s.metaDiaria}
          min={5}
          max={60}
          step={5}
          onChange={(v) => void cambiar('metaDiaria', v as never)}
        />
        <Stepper
          label="Nuevas por día"
          value={s.nuevasPorDia}
          min={0}
          max={30}
          step={1}
          onChange={(v) => void cambiar('nuevasPorDia', v as never)}
        />
        <Toggle
          label="Audio automático"
          hint="Suena la frase al aparecer la tarjeta"
          value={s.autoAudio}
          onChange={(v) => void cambiar('autoAudio', v as never)}
        />
        <Toggle
          label="Vibración"
          value={s.haptics}
          onChange={(v) => void cambiar('haptics', v as never)}
        />
        <Toggle
          label="Efectos de sonido"
          hint="Acierto, fallo y los efectos de los juegos"
          value={s.sonidosFeedback}
          onChange={(v) => void cambiar('sonidosFeedback', v as never)}
        />
        <Toggle
          label="Música"
          hint="Suena de fondo en toda la app, más baja en estudio y gramática"
          value={s.musica}
          onChange={(v) => void cambiar('musica', v as never)}
        />
        {s.musica ? (
          <>
            <Stepper
              label="Volumen de la música"
              value={s.volumenMusica}
              min={0}
              max={100}
              step={10}
              onChange={(v) => void cambiar('volumenMusica', v as never)}
            />
            <Toggle
              label="Música en juegos distinta"
              hint="Apagado: los juegos usan la misma pista que el resto de la app"
              value={s.musicaJuegosDistinta}
              onChange={(v) => void cambiar('musicaJuegosDistinta', v as never)}
            />
          </>
        ) : null}
        <Toggle
          label="Contador de seguidas"
          hint="Cuántas llevas bien seguidas. Se borra al terminar la sesión."
          value={s.mostrarSeguidas}
          onChange={(v) => void cambiar('mostrarSeguidas', v as never)}
        />
      </Card>

      <SectionTitle title="Recordatorios" />
      <Card style={styles.card}>
        {!notifEstado.ok ? (
          <Text style={styles.hint}>{notifEstado.razon}</Text>
        ) : null}
        <Toggle
          label="Frases durante el día"
          hint="Cada aviso es una sola frase"
          value={s.notificaciones}
          onChange={async (v) => {
            if (!v) {
              await cambiar('notificaciones', false as never);
              await notifications.cancelAll();
              return;
            }
            // Al prenderlos, primero la hoja que explica cuáles y cada cuánto; «Ahora no» los deja apagados.
            if (!(await pedirConsentimiento('notificaciones'))) return;
            await cambiar('notificaciones', true as never);
            await notifications.requestPermission();
          }}
        />

        {s.notificaciones ? (
          <>
            <Stepper
              label="Cuántas al día"
              value={s.notifPorDia}
              min={0}
              max={NOTIF_MAX_POR_DIA}
              step={1}
              onChange={(v) => void cambiar('notifPorDia', v as never)}
            />
            {s.notifPorDia === 1 ? (
              <>
                <HoraFila
                  label="A qué hora"
                  value={s.horaNotificacion}
                  opciones={['08:00', '13:00', '18:00', '20:00', '21:00']}
                  onChange={(v) => void cambiar('horaNotificacion', v as never)}
                />
                <Text style={styles.hint}>
                  Con una sola al día, llega a esa hora.
                </Text>
              </>
            ) : s.notifPorDia > 1 ? (
              <>
                <HoraFila
                  label="Desde las"
                  value={s.notifDesde}
                  opciones={['07:00', '08:00', '09:00', '10:00', '12:00']}
                  onChange={(v) => void cambiar('notifDesde', v as never)}
                />
                <HoraFila
                  label="Hasta las"
                  value={s.notifHasta}
                  opciones={['18:00', '20:00', '21:00', '22:00']}
                  onChange={(v) => void cambiar('notifHasta', v as never)}
                />
                <Text style={styles.hint}>
                  Se reparten dentro de esa ventana, nunca dos juntas.
                </Text>
              </>
            ) : (
              <Text style={styles.hint}>
                En cero no llega ninguna, pero el permiso se queda puesto por
                si lo prendes otro día.
              </Text>
            )}
            <Text style={styles.hint}>
              Los cambios entran al terminar tu próxima sesión.
            </Text>
          </>
        ) : null}
      </Card>

      <SectionTitle title="Micrófono" />
      <Card style={styles.card}>
        <Text style={styles.label}>
          {micEstado.ok ? 'Disponible' : 'No disponible aquí'}
        </Text>
        <Text style={styles.hint}>
          {micEstado.ok
            ? 'Wero puede oírte y decirte cuál palabra entendió. El audio no sale de tu teléfono y no se graba nada.'
            : micEstado.razon}
        </Text>
        {micEstado.ok ? (
          <Button
            label="Probar con pares mínimos"
            variant="secondary"
            onPress={() => nav.navigate('MinimalPairs', undefined)}
            full
          />
        ) : null}
      </Card>

      <SectionTitle title="Descargas" />
      <Card style={styles.card}>
        <Toggle
          label="Solo con wifi"
          hint="No usar datos móviles para bajar audio e imágenes"
          value={s.soloWifi}
          onChange={(v) => void cambiar('soloWifi', v as never)}
        />
        <Button
          label="Administrar packs"
          variant="secondary"
          onPress={() => nav.navigate('Downloads')}
          full
        />
      </Card>

      <SectionTitle title="Cuenta" />
      <Card style={styles.card}>
        {user ? <Identidad user={user} /> : null}
        <Button
          label="Cerrar sesión"
          variant="secondary"
          onPress={() => void signOut()}
          disabled={busy}
          full
        />
        <Text style={styles.hint}>Al cerrar sesión, tu avance se queda en este teléfono.</Text>
        <Button
          label="Eliminar cuenta"
          variant="danger"
          onPress={borrarCuenta}
          loading={busy}
          full
        />
      </Card>

      <Button
        label="Diagnóstico de datos"
        variant="ghost"
        onPress={() => nav.navigate('Diagnostics')}
        style={styles.diag}
        full
      />

      {__DEV__ ? (
        <>
          <Button
            label="Muestrario de sonidos"
            variant="ghost"
            onPress={() => nav.navigate('SfxSampler', undefined)}
            full
          />
          <Card style={styles.card}>
            <Toggle
              label="Simular carga lenta"
              hint="Le suma 1.5 s a cada carga: para ver el esqueleto de cada pantalla"
              value={cargaLenta}
              onChange={(v) => {
                setCargaLenta(v);
                setSimularCargaLenta(v);
              }}
            />
          </Card>
        </>
      ) : null}
      {hoja}
    </Screen>
  );
}

function Toggle({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggle}>
      <View style={styles.toggleText}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: color.surfaceHigh, true: color.accentSoft }}
        thumbColor={value ? color.accent : color.textFaint}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperControls}>
        <Button
          label="−"
          variant="secondary"
          onPress={() => onChange(Math.max(min, value - step))}
          style={styles.stepBtn}
        />
        <Text style={styles.stepValue}>{value}</Text>
        <Button
          label="+"
          variant="secondary"
          onPress={() => onChange(Math.min(max, value + step))}
          style={styles.stepBtn}
        />
      </View>
    </View>
  );
}

/**
 * Fila de hora con opciones fijas en vez de un selector de reloj.
 *
 * Un time picker nativo abre un modal por cada extremo de la ventana y
 * pide dos toques más. Con cinco horas comunes se resuelve el 95% de
 * los casos en un toque, y quien quiera algo raro puede vivir con la
 * hora más cercana.
 */
function HoraFila({
  label,
  value,
  opciones,
  onChange,
}: {
  label: string;
  value: string;
  opciones: string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.hora}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.horaChips}>
        {opciones.map((h) => (
          <Presionable
            key={h}
            onPress={() => onChange(h)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${h}`}
            style={[styles.horaChip, value === h && styles.horaChipOn]}
          >
            <Text
              style={[styles.horaTexto, value === h && styles.horaTextoOn]}
            >
              {h}
            </Text>
          </Presionable>
        ))}
      </View>
    </View>
  );
}

/** Quién está usando la app: con Google, su foto, nombre y correo; si no, qué tipo de cuenta es. */
function Identidad({ user }: { user: NonNullable<ReturnType<typeof useAuthStore.getState>['user']> }) {
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
  card: { gap: space.lg },
  identidad: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  identidadTexto: { flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: radius.pill },
  avatarVacio: { backgroundColor: color.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  hora: { gap: space.sm },
  horaChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  horaChip: {
    minHeight: layout.tapMin,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    backgroundColor: color.surfaceAlt,
    borderWidth: 1,
    borderColor: color.border,
  },
  horaChipOn: { backgroundColor: color.accentSoft, borderColor: color.accent },
  horaTexto: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  horaTextoOn: { color: color.accent, fontFamily: font.family.bodyStrong },
  label: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, marginTop: space.xs },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  toggleText: { flex: 1 },
  levels: { flexDirection: 'row', gap: space.sm },
  level: { flex: 1 },
  levelOn: { flex: 1, backgroundColor: color.accentSoft, borderColor: color.accent },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperControls: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  stepBtn: { minWidth: 48 },
  stepValue: {
    fontSize: font.size.lg,
    color: color.text,
    fontFamily: font.family.heading,
    minWidth: 36,
    textAlign: 'center',
  },
  diag: { marginTop: space.xl },
});
