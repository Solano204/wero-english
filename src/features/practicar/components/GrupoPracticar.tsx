import React, { type ComponentProps } from 'react';
import { useAuthStore } from '@/estado/useAuthStore';
import { useSettingsStore } from '@/estado/useSettingsStore';
import { GrupoPlegable } from '@/features/practicar/components/GrupoPlegable';

type Props = Omit<ComponentProps<typeof GrupoPlegable>, 'abierto' | 'onAlternar'> & { id: string };

/**
 * Un grupo de «Todo lo demás» con su estado abierto/cerrado. Cada grupo lee solo si él está abierto: abrir o
 * cerrar uno repinta ese grupo, no Practicar entera (con sus lienzos de Skia).
 */
export function GrupoPracticar({ id, ...resto }: Props) {
  const abierto = useSettingsStore((s) => s.practicarGruposAbiertos.includes(id));
  const user = useAuthStore((s) => s.user);

  const alternar = () => {
    if (!user) return;
    const { practicarGruposAbiertos: abiertos, set } = useSettingsStore.getState();
    const siguiente = abiertos.includes(id) ? abiertos.filter((g) => g !== id) : [...abiertos, id];
    void set(user.id, 'practicarGruposAbiertos', siguiente);
  };

  return <GrupoPlegable {...resto} abierto={abierto} onAlternar={alternar} />;
}
