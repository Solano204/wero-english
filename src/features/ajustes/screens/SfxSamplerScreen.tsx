import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, Card, Header, Icon, Screen } from '@/shared/ui';
import { useCortarAudioAlSalir } from '@/shared/hooks/useCortarAudioAlSalir';
import * as audio from '@/services/audio';
import * as haptics from '@/services/haptics';
import type { SfxPackId } from '@/services/audio';
import { color, font, space } from '@/theme';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

const PAQUETES: { id: SfxPackId; nombre: string }[] = [
  { id: 'D', nombre: 'D · Actual' },
  { id: 'A', nombre: 'A · Cristal' },
  { id: 'B', nombre: 'B · Beat' },
  { id: 'C', nombre: 'C · Arcade suave' },
];

/** El háptico va SOLO donde el resto de la app ya lo pone (Paso 5): éxito, fallo, toque y pareja. */
const EFECTOS: { key: string; label: string; tocar: () => Promise<void>; haptico?: () => void }[] = [
  { key: 'success', label: 'Acierto', tocar: audio.playSuccess, haptico: haptics.success },
  { key: 'fail', label: 'Fallo', tocar: audio.playFail, haptico: haptics.tapLight },
  { key: 'tap', label: 'Toque', tocar: audio.playTap, haptico: haptics.selection },
  { key: 'match', label: 'Pareja', tocar: audio.playMatch, haptico: haptics.selection },
  { key: 'combo', label: 'Combo', tocar: audio.playCombo },
  { key: 'nivelCompleto', label: 'Nivel completo', tocar: audio.playNivelCompleto },
  { key: 'caidaPieza', label: 'Caída', tocar: audio.playCaidaPieza },
  { key: 'pista', label: 'Pista', tocar: audio.playPista },
];

const PAUSA_ENTRE_ACIERTOS_MS = 450;
const PAUSA_TRAS_FALLO_MS = 300;

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Solo __DEV__. Compara los 3 paquetes nuevos contra el actual (D) y deja
 * elegir uno para toda la app, sin reiniciar (Paso 4 del rediseño de SFX).
 */
export function SfxSamplerScreen() {
  const nav = useNavigation<Nav>();
  useCortarAudioAlSalir();
  const [activo, setActivo] = useState<SfxPackId>(audio.paqueteSfxActual());
  const [simulando, setSimulando] = useState<SfxPackId | null>(null);

  const activar = useCallback((id: SfxPackId) => {
    audio.setPaqueteSfx(id);
    setActivo(id);
  }, []);

  const usar = useCallback(async (id: SfxPackId) => {
    await audio.guardaPaqueteDevPreferido(id);
    setActivo(id);
  }, []);

  const simularRacha = useCallback(
    async (id: SfxPackId) => {
      if (simulando) return;
      setSimulando(id);
      activar(id);
      audio.reiniciaRacha();
      try {
        for (let i = 0; i < 5; i++) {
          haptics.success();
          void audio.playSuccess();
          await esperar(PAUSA_ENTRE_ACIERTOS_MS);
        }
        haptics.tapLight();
        void audio.playFail();
        await esperar(PAUSA_TRAS_FALLO_MS);
      } finally {
        setSimulando(null);
      }
    },
    [simulando, activar]
  );

  return (
    <Screen scroll>
      <Header onBack={() => nav.goBack()} title="Muestrario de sonidos" />

      <Text style={styles.intro}>
        Solo visible en desarrollo. Prueba cada paquete y elige el que se
        queda para toda la app.
      </Text>

      {PAQUETES.map(({ id, nombre }) => (
        <Card key={id} style={styles.paquete}>
          <View style={styles.paqueteHead}>
            <Text style={styles.paqueteNombre}>{nombre}</Text>
            {activo === id ? <Icon name="check" size="sm" color={color.correct} /> : null}
          </View>

          <View style={styles.grid}>
            {EFECTOS.map((e) => (
              <Button
                key={e.key}
                label={e.label}
                variant="secondary"
                disabled={simulando !== null}
                onPress={() => {
                  activar(id);
                  e.haptico?.();
                  void e.tocar();
                }}
                style={styles.gridBtn}
              />
            ))}
          </View>

          <Button
            label={simulando === id ? 'Sonando…' : 'Simular racha'}
            variant="secondary"
            loading={simulando === id}
            disabled={simulando !== null && simulando !== id}
            onPress={() => void simularRacha(id)}
            full
          />
          <Button
            label={activo === id ? 'Paquete activo' : 'Usar este paquete'}
            variant={activo === id ? 'ghost' : 'primary'}
            disabled={activo === id}
            onPress={() => void usar(id)}
            full
          />
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    marginBottom: space.lg,
  },
  paquete: { gap: space.md, marginBottom: space.lg },
  paqueteHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  paqueteNombre: {
    flexShrink: 1,
    fontFamily: font.family.heading,
    fontSize: font.size.lg,
    color: color.text,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  gridBtn: { flexBasis: '47%', flexGrow: 1 },
});
