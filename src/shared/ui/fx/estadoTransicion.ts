import { create } from 'zustand';

export interface Rectangulo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Estado {
  activa: boolean;
  /** Dónde estaba la tarjeta HOY, en coordenadas de ventana. */
  origen: Rectangulo | null;
  /** Centro vertical de la barra de progreso de Study, si ya se montó. */
  barraY: number | null;
}

export const useTransicionHoy = create<Estado>(() => ({ activa: false, origen: null, barraY: null }));

/** Arranca la expansión de la tarjeta y deja que `navegar` abra el destino por debajo. */
export function iniciarTransicionHoy(origen: Rectangulo, navegar: () => void): void {
  if (useTransicionHoy.getState().activa) return;
  useTransicionHoy.setState({ activa: true, origen, barraY: null });
  navegar();
}

/** Study publica dónde quedó su barra de progreso: ahí termina de aplanarse la onda. */
export function publicarBarraEstudio(y: number): void {
  if (useTransicionHoy.getState().activa) useTransicionHoy.setState({ barraY: y });
}

export function terminarTransicionHoy(): void {
  useTransicionHoy.setState({ activa: false, origen: null, barraY: null });
}
