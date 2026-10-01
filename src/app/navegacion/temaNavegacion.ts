import { DarkTheme, type Theme } from '@react-navigation/native';
import { color } from '@/theme';

/** Tema de react-navigation, alineado con los tokens de la app. */
export const navTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: color.accent,
    background: color.bg,
    card: color.surface,
    text: color.text,
    border: color.border,
    notification: color.accent,
  },
};
