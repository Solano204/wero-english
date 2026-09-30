import { useEffect } from 'react';
import { AppState, Keyboard, Platform } from 'react-native';
import { NavigationBar } from 'expo-navigation-bar';
import { navigationRef } from '@/navigation';

/**
 * Oculta la barra de navegación de Android (modo inmersivo) y la vuelve a
 * ocultar cada vez que algo pudo haberla mostrado de nuevo.
 *
 * `setHidden(true)` ya deja el comportamiento de "deslizar desde abajo para
 * verla un momento y que se oculte sola" (WindowInsetsControllerCompat con
 * BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE viene puesto por el propio módulo),
 * así que no hay nada más que configurar: solo volver a llamarlo cuando la
 * app regresa a primer plano, se cierra el teclado o cambia de pantalla.
 *
 * En iOS no existe esta barra: no hace nada. Se llama UNA sola vez, en
 * App.tsx.
 */
function ocultar(): void {
  if (Platform.OS !== 'android') return;
  NavigationBar.setStyle('light');
  NavigationBar.setHidden(true);
}

export function useBarraOculta(): void {
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    ocultar();

    const appState = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') ocultar();
    });
    const teclado = Keyboard.addListener('keyboardDidHide', ocultar);
    const desuscribirNav = navigationRef.addListener('state', ocultar);

    return () => {
      appState.remove();
      teclado.remove();
      desuscribirNav();
    };
  }, []);
}
