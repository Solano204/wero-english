import type { IconName } from '@/shared/ui/Icon';

/**
 * El ícono de cada mundo (colores de mundo, opción a): con una escala de azules el color ya no distingue a un mundo
 * de otro; el ícono sí. Lo pinta `PuntoMundo`.
 */
export const ICONO_MUNDO: Record<string, IconName> = {
  dia_a_dia: 'sun',
  calle: 'signpost',
  dinero: 'money',
  gente: 'users',
  cultura: 'music',
  tech: 'cpu',
  legal: 'scales',
  fonetica: 'waveform',
};
