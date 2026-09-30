import { StyleSheet } from 'react-native';
import { color } from './paleta';
import { font } from './tokens';

/** Estilos de texto compartidos. Evita repetir fontSize/color por pantalla. */
export const text = StyleSheet.create({
  display: {
    fontFamily: font.family.display,
    fontSize: font.size.display,
    letterSpacing: font.size.display * -0.015,
    color: color.text,
    lineHeight: font.size.display * 1.15,
  },
  h1: {
    fontFamily: font.family.display,
    fontSize: font.size.xxl,
    letterSpacing: font.size.xxl * -0.015,
    color: color.text,
    lineHeight: font.size.xxl * 1.2,
  },
  h2: {
    fontFamily: font.family.heading,
    fontSize: font.size.xl,
    color: color.text,
    lineHeight: font.size.xl * 1.25,
  },
  h3: {
    fontFamily: font.family.heading,
    fontSize: font.size.lg,
    color: color.text,
  },
  body: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.text,
    lineHeight: font.size.md * 1.5,
  },
  bodyMuted: {
    fontFamily: font.family.body,
    fontSize: font.size.md,
    color: color.textMuted,
    lineHeight: font.size.md * 1.5,
  },
  small: {
    fontFamily: font.family.body,
    fontSize: font.size.sm,
    color: color.textMuted,
    lineHeight: font.size.sm * 1.45,
  },
  tiny: {
    fontFamily: font.family.bodyStrong,
    fontSize: font.size.xs,
    color: color.textMuted,
  },
  ipa: {
    fontFamily: font.family.ipa,
    fontSize: font.size.md,
    color: color.textMuted,
    letterSpacing: 0.3,
  },
});
