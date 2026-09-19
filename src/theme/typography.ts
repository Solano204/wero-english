import { StyleSheet } from 'react-native';
import { color, font } from './tokens';

/** Estilos de texto compartidos. Evita repetir fontSize/color por pantalla. */
export const text = StyleSheet.create({
  display: {
    fontSize: font.size.display,
    fontWeight: font.weight.bold,
    color: color.text,
    lineHeight: font.size.display * 1.15,
  },
  h1: {
    fontSize: font.size.xxl,
    fontWeight: font.weight.bold,
    color: color.text,
    lineHeight: font.size.xxl * 1.2,
  },
  h2: {
    fontSize: font.size.xl,
    fontWeight: font.weight.semibold,
    color: color.text,
    lineHeight: font.size.xl * 1.25,
  },
  h3: {
    fontSize: font.size.lg,
    fontWeight: font.weight.semibold,
    color: color.text,
  },
  body: {
    fontSize: font.size.md,
    fontWeight: font.weight.regular,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
  bodyMuted: {
    fontSize: font.size.md,
    fontWeight: font.weight.regular,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
  },
  small: {
    fontSize: font.size.sm,
    color: color.textMuted,
    lineHeight: font.size.sm * 1.45,
  },
  tiny: {
    fontSize: font.size.xs,
    color: color.textMuted,
    fontWeight: font.weight.semibold,
  },
  ipa: {
    fontSize: font.size.md,
    color: color.textMuted,
    letterSpacing: 0.3,
  },
});
