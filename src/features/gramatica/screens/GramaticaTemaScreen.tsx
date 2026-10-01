import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Button, Card, EmptyState, Header, NotaInfo, Screen } from '@/shared/ui';
import { EjemploFrase } from '@/features/gramatica/components/EjemploFrase';
import { ErrorQueSeCorrige } from '@/features/gramatica/components/ErrorQueSeCorrige';
import { FormulaFichas } from '@/features/gramatica/components/FormulaFichas';
import { MuroDesbloqueo } from '@/shared/ui/MuroDesbloqueo';
import { segmentos } from '@/domain/gramatica';
import { color, font, space, text, aparecerSubiendo, escalon } from '@/theme';
import { useMovimientoReducido } from '@/shared/hooks/useMovimientoReducido';
import { GRATIS_POR_BLOQUE } from './GramaticaScreen';
import { useTemaGramatica } from '@/features/gramatica/hooks/useTemaGramatica';

/**
 * Un tema de gramática.
 *
 * El orden de la pantalla es el orden en que se entiende algo: primero
 * qué es, luego cuándo se usa, luego cómo se arma, luego ejemplos, y al
 * final el error típico.
 *
 * El error va al final a propósito. Puesto arriba, la gente lo lee, se
 * queda con la frase mal escrita y la recuerda mejor que la correcta.
 * Al final, ya tiene con qué contrastarla.
 */
export function GramaticaTemaScreen() {
  const { nav, gramatica, reducido, scrollY, scrollRef, animandoScroll, llevarAVista, tema, muro, ejemploActivo, reproduciendoTodos, escucharTodos, soltarSecuencia, detenerTodos, posicion } = useTemaGramatica();

  if (!tema) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} />
        <EmptyState
          title="Ese tema no existe"
          body="Puede que el catálogo se haya actualizado."
          actionLabel="Volver"
          onAction={() => nav.goBack()}
        />
      </Screen>
    );
  }

  const cuerpo = (
    <Screen scroll scrollY={scrollY} scrollRef={scrollRef} soltarScroll={animandoScroll}>
      <Header
        onBack={() => nav.goBack()}
        title={gramatica.bloques[tema.bloque]?.nombre ?? 'Gramática'}
      />

      <Animated.View entering={reducido ? undefined : aparecerSubiendo()}>
        <Text style={text.h1} accessibilityRole="header">
          {tema.titulo}
        </Text>
        <Text style={styles.gancho}>{tema.gancho}</Text>
      </Animated.View>

      <Bloque titulo="Qué es" retraso={escalon(1)}>
        <Text style={styles.parrafo}>{tema.idea}</Text>
      </Bloque>

      <Bloque titulo="Cuándo se usa" retraso={escalon(2)}>
        <Text style={styles.parrafo}>{tema.cuando}</Text>
      </Bloque>

      <Bloque titulo="Cómo se arma" retraso={escalon(3)}>
        <FormulaFichas formula={tema.formula} scrollY={scrollY} />
      </Bloque>

      <Bloque titulo="Así se dice" retraso={escalon(4)}>
        <Button
          icon={reproduciendoTodos ? 'stop' : 'play'}
          label={reproduciendoTodos ? 'Detener' : 'Escuchar todos los ejemplos'}
          onPress={reproduciendoTodos ? detenerTodos : () => void escucharTodos()}
          variant={reproduciendoTodos ? 'secondary' : 'primary'}
          style={styles.escucharTodos}
        />
        <View style={styles.ejemplos}>
          {tema.ejemplos.map((e, i) => (
            <EjemploFrase
              key={i}
              ejemplo={e}
              activo={i === ejemploActivo}
              antes={soltarSecuencia}
              alActivarse={llevarAVista}
            />
          ))}
        </View>
      </Bloque>

      {tema.contraste ? (
        <Bloque titulo="La diferencia" retraso={escalon(5)}>
          <Card style={styles.contraste}>
            <Negrita texto={tema.contraste} estilo={styles.contrasteTxt} />
          </Card>
        </Bloque>
      ) : null}

      <Bloque titulo="El error que se corrige" retraso={escalon(6)}>
        <ErrorQueSeCorrige
          mal={tema.error_tipico.mal}
          bien={tema.error_tipico.bien}
          porQue={tema.error_tipico.por_que}
          audioBien={tema.error_tipico.audio_bien}
          scrollY={scrollY}
          antes={soltarSecuencia}
        />
      </Bloque>

      {tema.ojo ? (
        <Bloque titulo="Ojo" retraso={escalon(7)}>
          <NotaInfo>
            <Negrita texto={tema.ojo} estilo={styles.ojoTexto} />
          </NotaInfo>
        </Bloque>
      ) : null}
    </Screen>
  );

  // Los primeros de cada bloque van abiertos: quien llega aquí trae una
  // duda concreta y tiene que poder resolver algo antes de que se le
  // pida nada.
  if (posicion < GRATIS_POR_BLOQUE) return cuerpo;

  return (
    <MuroDesbloqueo
      abierto={muro.abierto}
      puede={muro.puede}
      onDesbloquear={muro.desbloquear}
      nombre={tema.titulo}
      detalle={tema.gancho}
      onVolver={() => nav.goBack()}
    >
      {cuerpo}
    </MuroDesbloqueo>
  );
}

function Bloque({ titulo, retraso, children }: {
  titulo: string; retraso: number; children: React.ReactNode;
}) {
  const reducido = useMovimientoReducido();
  return (
    <Animated.View entering={reducido ? undefined : aparecerSubiendo(retraso)} style={styles.seccion}>
      <Text style={styles.seccionTitulo}>{titulo}</Text>
      {children}
    </Animated.View>
  );
}

/**
 * Pinta **negritas** sin traer un motor de markdown entero.
 * Son cuatro líneas y evita 40 KB de dependencia para un solo símbolo.
 */
function Negrita({ texto, estilo }: { texto: string; estilo: object }) {
  return (
    <Text style={estilo}>
      {segmentos(texto).map((s, i) => (
        <Text key={i} style={s.fuerte ? styles.fuerte : undefined}>
          {s.texto}
        </Text>
      ))}
    </Text>
  );
}

const styles = StyleSheet.create({
  gancho: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    marginTop: space.xs,
    lineHeight: font.size.md * 1.5,
  },
  seccion: { marginTop: space.xl },
  seccionTitulo: {
    fontSize: font.size.xs,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontFamily: font.family.bodyStrong,
    color: color.textFaint,
    marginBottom: space.sm,
  },
  parrafo: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.6,
  },
  escucharTodos: { alignSelf: 'flex-start', marginBottom: space.md },
  ejemplos: { gap: space.md },
  contraste: { backgroundColor: color.surfaceAlt },
  contrasteTxt: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.6,
  },
  ojoTexto: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
  fuerte: { fontFamily: font.family.bodyStrong, color: color.text },
});
