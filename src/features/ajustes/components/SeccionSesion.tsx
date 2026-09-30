import React from 'react';
import { StyleSheet } from 'react-native';
import { Card } from '@/shared/ui';
import { SectionTitle } from '@/shared/ui/SectionTitle';
import { Stepper, Toggle } from './ControlesAjustes';
import type { useAjustes } from '../hooks/useAjustes';
import { space } from '@/theme';

type Ajustes = ReturnType<typeof useAjustes>;

/** Ajustes › Sesión: tamaño de la sesión, nuevas por día, audio, vibración, efectos y música. */
export function SeccionSesion({ s, cambiar }: Pick<Ajustes, 's' | 'cambiar'>) {
  return (
    <>
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
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.lg },
});
