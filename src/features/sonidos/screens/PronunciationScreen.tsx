import React, { useRef, useState, useLayoutEffect } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { EmptyState, Header, IconButton, Screen } from '@/shared/ui';
import { IndiceFonemas } from '@/features/sonidos/components/IndiceFonemas';
import { PaginaFonema } from '@/features/sonidos/components/PaginaFonema';
import { ViajeSimbolo } from '@/features/sonidos/components/ViajeSimbolo';
import { sinBarras } from '@/domain/vocales';
import { color, font, layout, space } from '@/theme';
import type { Fonema } from '@/types';
import { usePronunciacion } from '@/features/sonidos/hooks/usePronunciacion';

interface PagerProps {
  fonemas: Fonema[];
  pagina: number;
  ancho: number;
  onCambia: (indice: number) => void;
  renderPagina: (fonema: Fonema, indice: number) => React.ReactNode;
}

/**
 * Las páginas de fonemas, una junto a otra: se pasa deslizando a los lados. Solo se montan la página actual y sus
 * vecinas; las demás son un hueco del mismo ancho. El índice se actualiza al cruzar la mitad, así la vecina que
 * viene ya está montada cuando se llega a ella.
 */
function Pager({ fonemas, pagina, ancho, onCambia, renderPagina }: PagerProps) {
  // Solo el lugar inicial: si `contentOffset` siguiera a la página, pelearía con el dedo.
  const [inicial] = useState(pagina);
  const actual = useRef(pagina);
  useLayoutEffect(() => {
    actual.current = pagina;
  }, [pagina]);
  const [alto, setAlto] = useState(0);

  return (
    <View style={styles.flex} onLayout={(e) => setAlto(e.nativeEvent.layout.height)}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        contentOffset={{ x: inicial * ancho, y: 0 }}
        scrollEventThrottle={32}
        onScroll={(e) => {
          const i = Math.round(e.nativeEvent.contentOffset.x / ancho);
          if (i !== actual.current && i >= 0 && i < fonemas.length) onCambia(i);
        }}
      >
        {fonemas.map((f, i) => (
          <View key={f.id} style={{ width: ancho, height: alto }}>
            {alto > 0 && Math.abs(i - pagina) <= 1 ? renderPagina(f, i) : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * P-10, el laboratorio de sonidos.
 *
 * Abre con un índice de los 53 fonemas y cada uno es una página completa; entre fonemas se pasa deslizando. Si
 * llega `fonemaId`, abre directo en esa página.
 */
export function PronunciationScreen() {
  const { nav, fonemas, total, ancho, pagina, montada, ultima, viaje, enPagina, repitiendo, alternarRepetir, abrir, cambiarPagina, volverAlIndice, simboloMedido, finViaje, practicarPares, estiloIndice, estiloPagina } = usePronunciacion();

  if (fonemas.length === 0) {
    return (
      <Screen>
        <Header onBack={() => nav.goBack()} title="Sonidos" />
        <EmptyState
          icon="warning"
          title="Falta el contenido"
          body="Pega fonemas.json en assets/data y recarga la app."
        />
      </Screen>
    );
  }

  const vista = pagina ?? ultima.current;
  const actual = fonemas[vista];

  return (
    <Screen padded={false}>
      <View style={styles.flex}>
        <Animated.View
          style={[StyleSheet.absoluteFill, estiloIndice]}
          pointerEvents={enPagina ? 'none' : 'auto'}
          importantForAccessibility={enPagina ? 'no-hide-descendants' : 'auto'}
          accessibilityElementsHidden={enPagina}
        >
          <IndiceFonemas fonemas={fonemas} onAbrir={abrir} onAtras={() => nav.goBack()} />
        </Animated.View>

        {montada && actual ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, estiloPagina]}
            pointerEvents={enPagina ? 'auto' : 'none'}
            importantForAccessibility={enPagina ? 'auto' : 'no-hide-descendants'}
            accessibilityElementsHidden={!enPagina}
          >
            <View style={styles.barra}>
              <View style={styles.lado}>
                <IconButton icono="back" etiqueta="Volver al índice" tamano="sm" onPress={volverAlIndice} />
              </View>
              <View style={styles.centro}>
                <Text style={styles.barraSimbolo} accessibilityLabel={actual.nombre}>
                  {sinBarras(actual.ipa)}
                </Text>
                <Text style={styles.cuenta}>{`${vista + 1} de ${total}`}</Text>
              </View>
              <View style={styles.lado} />
            </View>

            <Pager
              fonemas={fonemas}
              pagina={vista}
              ancho={ancho}
              onCambia={cambiarPagina}
              renderPagina={(f, i) => (
                <PaginaFonema
                  fonema={f}
                  esActual={enPagina && i === vista}
                  simboloOculto={viaje !== null && i === vista}
                  alSimboloMedido={viaje && !viaje.hasta && i === vista ? simboloMedido : undefined}
                  repitiendo={repitiendo === f.id}
                  alRepetir={alternarRepetir}
                  alPracticar={practicarPares}
                />
              )}
            />
          </Animated.View>
        ) : null}

        {viaje ? <ViajeSimbolo viaje={viaje} onFin={finViaje} /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tapMin,
    paddingHorizontal: layout.screenPad,
    paddingTop: space.sm,
  },
  lado: { width: 56, justifyContent: 'center' },
  centro: { flex: 1, alignItems: 'center' },
  // Charis SIL solo trae Regular: se compensa con tamaño, no con peso.
  barraSimbolo: {
    fontFamily: font.family.ipa,
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    color: color.accent,
  },
  cuenta: { fontFamily: font.family.body, fontSize: font.size.sm, color: color.textMuted },
});
