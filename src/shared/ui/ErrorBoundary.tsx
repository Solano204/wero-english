import React, { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { color, font, space } from '@/theme';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Captura cualquier error de render y muestra una pantalla útil.
 *
 * Sin esto, un JSON con una forma inesperada deja al usuario con una
 * pantalla blanca y cero información. Aquí al menos ve el mensaje y
 * puede reintentar sin desinstalar.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('[boundary]', error.message, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.title}>Algo se rompió</Text>
        <Text style={styles.body}>
          La app tuvo un error y no pudo seguir. Toca Reintentar. Si vuelve a
          pasar, ciérrala y ábrela otra vez.
        </Text>
        <ScrollView style={styles.detail}>
          <Text style={styles.mono}>{error.message}</Text>
        </ScrollView>
        <Button label="Reintentar" onPress={this.reset} full />
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
  detail: {
    maxHeight: 180,
    backgroundColor: color.surface,
    borderRadius: 12,
    padding: space.md,
  },
  mono: {
    fontSize: font.size.sm,
    color: color.riskWarn,
    fontFamily: font.family.body,
  },
});
