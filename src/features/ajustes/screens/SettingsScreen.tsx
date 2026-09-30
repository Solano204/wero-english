import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Header, Screen } from '@/shared/ui';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { FilaLegal } from '@/features/ajustes/components/FilaLegal';
import { setSimularCargaLenta } from '@/shared/hooks/useCarga';
import { color, font, space } from '@/theme';
import type { Nivel } from '@/types';
import { useAjustes } from '@/features/ajustes/hooks/useAjustes';
import { Toggle } from '@/features/ajustes/components/ControlesAjustes';
import { Identidad } from '@/features/ajustes/components/Identidad';
import { SeccionRecordatorios } from '@/features/ajustes/components/SeccionRecordatorios';
import { SeccionSesion } from '@/features/ajustes/components/SeccionSesion';

/** P-11, ajustes. */
export function SettingsScreen() {
  const { nav, user, signOut, s, cargaLenta, setCargaLenta, pedirConsentimiento, hoja, micEstado, notifEstado, cambiar, alternarNivel } = useAjustes();

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

      <SeccionSesion s={s} cambiar={cambiar} />

      <SeccionRecordatorios s={s} cambiar={cambiar} notifEstado={notifEstado} pedirConsentimiento={pedirConsentimiento} />

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
          full
        />
        <Text style={styles.hint}>Al cerrar sesión, tu avance se queda en este teléfono.</Text>
      </Card>

      <SectionTitle title="Legal" />
      <Card style={styles.card}>
        <FilaLegal
          icono="info"
          titulo="Aviso de privacidad"
          detalle="Qué datos usa Wero, dónde se guardan y tus derechos"
          onPress={() => nav.navigate('LegalDoc', { doc: 'privacidad' })}
        />
        <FilaLegal
          icono="book"
          titulo="Términos y condiciones"
          detalle="Las reglas para usar la app"
          onPress={() => nav.navigate('LegalDoc', { doc: 'terminos' })}
        />
        <FilaLegal
          icono="warning"
          titulo="Borrar cuenta y datos"
          detalle="Borra tu cuenta y todo tu avance de este teléfono y cierra la sesión"
          onPress={() => nav.navigate('Borrar', { modo: 'cuenta' })}
          borra
        />
        <FilaLegal
          icono="repeat"
          titulo="Borrar todos mis datos"
          detalle="Tu avance vuelve a cero; sigues con tu sesión"
          onPress={() => nav.navigate('Borrar', { modo: 'datos' })}
          borra
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
          <Button
            label="Probar reconocimiento"
            variant="ghost"
            onPress={() => nav.navigate('ProbarVoz', undefined)}
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

const styles = StyleSheet.create({
  card: { gap: space.lg },
  label: { fontFamily: font.family.body, fontSize: font.size.md, color: color.text },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, marginTop: space.xs },
  levels: { flexDirection: 'row', gap: space.sm },
  level: { flex: 1 },
  levelOn: { flex: 1, backgroundColor: color.accentSoft, borderColor: color.accent },
  diag: { marginTop: space.xl },
});
