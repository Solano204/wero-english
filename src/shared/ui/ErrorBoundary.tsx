import React, { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { registrarFalla } from '@/services/fallas';
import { navigationRef } from '@/shared/navegacion/navigationRef';
import { color, font, space } from '@/theme';

interface Props {
  children: ReactNode;
  /**
   * `pantalla`: rodea una sola pantalla (va en el `screenLayout` de cada navegador): si falla, las demás siguen y se
   * puede volver a Practicar. `app`: el último recurso, alrededor de toda la navegación.
   */
  alcance?: 'app' | 'pantalla';
  /** El nombre de la ruta, para el registro de errores. */
  pantalla?: string;
}

interface State {
  error: Error | null;
  /** Sube con cada «Reintentar»: la pantalla se vuelve a montar desde cero, no con el estado que la tumbó. */
  intento: number;
}

/** ¿Hay adónde volver? En la entrada y en las preguntas de bienvenida todavía no existe Practicar. */
function hayPracticar(): boolean {
  try {
    return navigationRef.isReady() && (navigationRef.getRootState()?.routeNames ?? []).includes('Main');
  } catch {
    return false;
  }
}

/**
 * Captura un error de render y muestra una pantalla amable en vez de una en blanco: «Algo se atoró. Vuelve a
 * intentar.», con «Reintentar» y, si se puede, «Volver a Practicar». El error se anota en el registro local
 * (services/fallas.ts); no se enseña el mensaje técnico, que no le sirve a quien usa la app y sí está en el reporte de
 * Ajustes → Acerca de.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null, intento: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    const conComponentes = new Error(error.message);
    conComponentes.name = error.name;
    conComponentes.stack = `${error.stack ?? ''}\n\nComponentes:${info.componentStack ?? ''}`;
    void registrarFalla(conComponentes, this.props.alcance === 'app' ? 'render:app' : 'render', this.props.pantalla);
  }

  private reintentar = () => this.setState((s) => ({ error: null, intento: s.intento + 1 }));

  private volverAPracticar = () => {
    this.setState((s) => ({ error: null, intento: s.intento + 1 }));
    if (navigationRef.isReady()) navigationRef.navigate('Main', { screen: 'Practice' });
  };

  override render() {
    const { error, intento } = this.state;
    const { alcance = 'app', pantalla } = this.props;
    if (!error) return <React.Fragment key={intento}>{this.props.children}</React.Fragment>;

    // En toda la app, reintentar ya vuelve a montar la navegación desde Practicar.
    const puedeVolver = alcance === 'pantalla' && pantalla !== 'Practice' && hayPracticar();
    return (
      <View style={styles.wrap} accessibilityRole="alert">
        <Text style={styles.title} accessibilityRole="header">
          Algo se atoró.
        </Text>
        <Text style={styles.body}>Vuelve a intentar. Si sigue pasando, cierra la app y ábrela otra vez.</Text>
        <View style={styles.botones}>
          <Button label={alcance === 'app' ? 'Volver a Practicar' : 'Reintentar'} onPress={this.reintentar} size="lg" full />
          {puedeVolver ? <Button label="Volver a Practicar" variant="ghost" onPress={this.volverAPracticar} full /> : null}
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: color.bg,
    padding: space.xl,
    justifyContent: 'center',
    gap: space.lg,
  },
  title: {
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    fontFamily: font.family.display,
    color: color.text,
  },
  body: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
  },
  botones: { gap: space.sm },
});
