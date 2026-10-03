import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Presionable } from '@/shared/ui';
import { resumenRespuestas, type PasoPerfil, type RespuestasPerfil } from '@/domain/perfilInicial';
import { color, font, layout, space } from '@/theme';

/**
 * «Revisa tus respuestas»: cada pregunta con su respuesta y un «Cambiar» que lleva a esa pregunta (y regresa aquí
 * al contestarla). «Listo» termina; si van a llegar avisos, es también el momento de pedir el permiso, y aquí mismo
 * se dice si el teléfono no puede o si el permiso quedó apagado.
 */
export function ResumenPerfil({
  respuestas,
  notifEstado,
  permisoNegado,
  onCambiar,
  onListo,
  onSinAvisos,
}: {
  respuestas: RespuestasPerfil;
  notifEstado: { ok: boolean; razon?: string };
  permisoNegado: boolean;
  onCambiar: (paso: PasoPerfil) => void;
  onListo: () => void;
  onSinAvisos: () => void;
}) {
  const pedirPermiso = respuestas.porDia > 0 && notifEstado.ok && !permisoNegado;
  return (
    <View style={styles.paso}>
      <Text style={styles.titulo} accessibilityRole="header">
        Revisa tus respuestas
      </Text>
      <Text style={styles.bajada}>Todo se puede cambiar después, en Ajustes → Mi perfil.</Text>

      <View style={styles.lista}>
        {resumenRespuestas(respuestas).map((r) => (
          <Card key={r.paso} style={styles.renglon}>
            <View style={styles.textos}>
              <Text style={styles.pregunta}>{r.pregunta}</Text>
              <Text style={styles.respuesta}>{r.respuesta}</Text>
            </View>
            <Presionable
              onPress={() => onCambiar(r.paso)}
              accessibilityRole="button"
              accessibilityLabel={`Cambiar: ${r.pregunta}`}
              style={styles.cambiar}
            >
              <Text style={styles.cambiarTexto}>Cambiar</Text>
            </Presionable>
          </Card>
        ))}
      </View>

      {!notifEstado.ok ? (
        <Card style={styles.aviso}>
          <Text style={styles.avisoTitulo}>Aquí todavía no llegan</Text>
          <Text style={styles.avisoTexto}>
            {notifEstado.razon} Tus ajustes se guardan de una vez, así que cuando eso pase ya quedan puestos.
          </Text>
        </Card>
      ) : permisoNegado ? (
        <Card style={styles.aviso}>
          <Text style={styles.avisoTitulo}>El permiso quedó apagado</Text>
          <Text style={styles.avisoTexto}>
            Sin permiso no llega ninguna frase. Se prende desde los ajustes del teléfono, en la sección de
            notificaciones de Wero. La app funciona igual sin eso.
          </Text>
        </Card>
      ) : null}

      <View style={styles.acciones}>
        {pedirPermiso ? <Text style={styles.hint}>Al tocar «Listo» te pedimos permiso para mandarte los avisos.</Text> : null}
        <Button label="Listo" onPress={onListo} full size="lg" />
        {pedirPermiso ? <Button label="Empezar sin avisos" variant="ghost" onPress={onSinAvisos} full /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paso: { gap: space.md },
  titulo: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  bajada: { fontFamily: font.family.body, fontSize: font.size.md, color: color.textMuted },
  lista: { gap: space.sm, marginTop: space.sm },
  renglon: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  textos: { flex: 1, gap: space.xs },
  pregunta: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
  respuesta: { fontFamily: font.family.bodyStrong, fontSize: font.size.md, color: color.text },
  cambiar: { minHeight: layout.tapMin, minWidth: layout.tapMin, justifyContent: 'center', alignItems: 'center' },
  cambiarTexto: { fontFamily: font.family.bodyStrong, fontSize: font.size.sm, color: color.accent },
  aviso: { gap: space.xs },
  avisoTitulo: { fontSize: font.size.md, fontFamily: font.family.bodyStrong, color: color.riskWarn },
  avisoTexto: { fontFamily: font.family.body, fontSize: font.size.md, lineHeight: font.size.md * 1.5, color: color.textMuted },
  acciones: { gap: space.sm, marginTop: space.lg },
  hint: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
