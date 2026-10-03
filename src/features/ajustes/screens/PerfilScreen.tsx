import React, { useEffect, useEffectEvent, useState } from 'react';
import { BackHandler, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useShallow } from 'zustand/react/shallow';
import { Card, Header, Presionable, Screen } from '@/shared/ui';
import { PasoCuantas } from '@/shared/ui/PasoCuantas';
import { PreguntaPerfil } from '@/shared/ui/PreguntaPerfil';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { resumenRespuestas, valoresFinales, type PasoPerfil, type RespuestasPerfil } from '@/domain/perfilInicial';
import { color, font, layout, space } from '@/theme';
import type { RootStackParams } from '@/types/rutas';

type Nav = NativeStackNavigationProp<RootStackParams>;

/**
 * Ajustes → Mi perfil: las respuestas del onboarding, con «Cambiar» en cada una. Cambiar abre la misma pantalla
 * de pregunta de la entrada; al guardar se aplica a lo que usa esa respuesta (el filtro de lenguaje, los avisos)
 * sin tocar el avance.
 */
export function PerfilScreen() {
  const nav = useNavigation<Nav>();
  const user = useAuthStore((s) => s.user);
  const s = useSettingsStore(
    useShallow((st) => ({
      modoLimpio: st.modoLimpio,
      notifPorDia: st.notifPorDia,
      notifDesde: st.notifDesde,
      notifHasta: st.notifHasta,
      setVarios: st.setVarios,
    }))
  );
  const actuales: RespuestasPerfil = { limpio: s.modoLimpio, porDia: s.notifPorDia, desde: s.notifDesde, hasta: s.notifHasta };
  const [editando, setEditando] = useState<PasoPerfil | null>(null);
  const [borrador, setBorrador] = useState<RespuestasPerfil>(actuales);

  const cambiar = (paso: PasoPerfil) => {
    setBorrador(actuales);
    setEditando(paso);
  };

  const guardar = async () => {
    if (!user || !editando) return;
    const v = valoresFinales(borrador);
    await s.setVarios(
      user.id,
      editando === 'p1'
        ? { modoLimpio: v.modoLimpio }
        : { notifPorDia: v.notifPorDia, notifDesde: v.notifDesde, notifHasta: v.notifHasta }
    );
    setEditando(null);
  };

  const alAtras = useEffectEvent(() => {
    if (editando) {
      setEditando(null);
      return true;
    }
    return false;
  });
  useEffect(() => {
    const suscripcion = BackHandler.addEventListener('hardwareBackPress', () => alAtras());
    return () => suscripcion.remove();
  }, []);

  return (
    <Screen scroll>
      <Header onBack={() => (editando ? setEditando(null) : nav.goBack())} title="Mi perfil" />

      {editando === 'p1' ? (
        <PreguntaPerfil
          titulo="¿Te enseñamos las groserías?"
          bajada="El catálogo trae lenguaje fuerte marcado. Tú decides si aparece."
          opciones={[
            { label: 'Sí, para eso vine', valor: false },
            { label: 'No, déjalo limpio', valor: true },
          ]}
          valor={borrador.limpio}
          onElegir={(v) => setBorrador({ ...borrador, limpio: Boolean(v) })}
          onSiguiente={() => void guardar()}
          textoBoton="Guardar"
          nota="Aunque salgan, cada frase trae su aviso de dónde no decirla."
        />
      ) : editando === 'p2' ? (
        <PasoCuantas
          valor={borrador.porDia}
          onChange={(n) => setBorrador({ ...borrador, porDia: n })}
          desde={borrador.desde}
          hasta={borrador.hasta}
          onVentana={(desde, hasta) => setBorrador({ ...borrador, desde, hasta })}
          onSiguiente={() => void guardar()}
          textoBoton="Guardar"
        />
      ) : (
        <View style={styles.lista}>
          <Text style={styles.bajada}>Lo que contestaste al entrar. Cambiarlo no borra tu avance.</Text>
          {resumenRespuestas(actuales).map((r) => (
            <Card key={r.paso} style={styles.renglon}>
              <View style={styles.textos}>
                <Text style={styles.pregunta}>{r.pregunta}</Text>
                <Text style={styles.respuesta}>{r.respuesta}</Text>
              </View>
              <Presionable
                onPress={() => cambiar(r.paso)}
                accessibilityRole="button"
                accessibilityLabel={`Cambiar: ${r.pregunta}`}
                style={styles.cambiar}
              >
                <Text style={styles.cambiarTexto}>Cambiar</Text>
              </Presionable>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lista: { gap: space.sm, marginTop: space.md },
  bajada: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted, marginBottom: space.sm },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  textos: { flex: 1, gap: space.xs },
  pregunta: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  respuesta: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  cambiar: { minHeight: layout.tapMin, minWidth: layout.tapMin, justifyContent: 'center', alignItems: 'center' },
  cambiarTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.accent },
});
