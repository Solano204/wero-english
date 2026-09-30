import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { Card } from '@/shared/ui';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { HoraFila, Stepper, Toggle } from './ControlesAjustes';
import type { useAjustes } from '../hooks/useAjustes';
import { NOTIF_MAX_POR_DIA } from '@/data/repos/ajustes';
import * as notifications from '@/services/notificaciones';
import { color, font, space } from '@/theme';

type Ajustes = ReturnType<typeof useAjustes>;

/** Ajustes › Recordatorios: prender los avisos (con su hoja de consentimiento), cuántos y a qué hora. */
export function SeccionRecordatorios({
  s,
  cambiar,
  notifEstado,
  pedirConsentimiento,
}: Pick<Ajustes, 's' | 'cambiar' | 'notifEstado' | 'pedirConsentimiento'>) {
  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted, marginTop: space.xs },
});
