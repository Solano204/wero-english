import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * Vibración. Todo pasa por aquí para poder apagarla desde ajustes
 * con un solo interruptor.
 */

let enabled = true;

export function setHapticsEnabled(v: boolean): void {
  enabled = v;
}

function guard(): boolean {
  return enabled && Platform.OS !== 'web';
}

export function tapLight(): void {
  if (!guard()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function tapMedium(): void {
  if (!guard()) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function success(): void {
  if (!guard()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/**
 * El fallo usa Warning, no Error.
 * El usuario va a fallar cientos de veces por diseño; una vibración de
 * error en cada una hace que la app se sienta como un castigo.
 */
export function failure(): void {
  if (!guard()) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function selection(): void {
  if (!guard()) return;
  void Haptics.selectionAsync();
}
