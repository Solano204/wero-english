import { font } from './tokens';

/** Mapa para `useFonts`. Las llaves son los nombres de `font.family`. */
export const fuentes = {
  [font.family.display]: require('../../assets/fonts/BricolageGrotesque-Bold.ttf'),
  [font.family.heading]: require('../../assets/fonts/BricolageGrotesque-SemiBold.ttf'),
  [font.family.body]: require('../../assets/fonts/InstrumentSans-Regular.ttf'),
  [font.family.bodyStrong]: require('../../assets/fonts/InstrumentSans-SemiBold.ttf'),
  [font.family.ipa]: require('../../assets/fonts/CharisSIL-Regular.ttf'),
};
