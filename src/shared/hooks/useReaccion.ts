import { useState } from 'react';

/**
 * Estado compartido del estallido de cubitos.
 *
 * Existe para que los cinco juegos y la sesión de estudio no repitan el
 * mismo contador. La animación se relanza cambiando un número, no con un
 * temporizador que la apague: así dos aciertos seguidos no se pisan y no
 * hay nada que limpiar al desmontar.
 *
 * Antes esto también manejaba una cara de reacción. Se quitó de toda la
 * app: un emoji grande encima del tablero tapaba justo lo que había que
 * mirar, y en los juegos rápidos llegaba tarde a su propio acierto. Los
 * cubitos hacen el mismo trabajo sin robar la pantalla.
 *
 * `celebra` NO llama a haptics: cada pantalla ya lo hace en su
 * momento exacto, y duplicarlo daría dos vibraciones por respuesta.
 */
export function useReaccion() {
  /** Sube solo con los aciertos: es lo que revienta las cajas. */
  const [trozos, setTrozos] = useState(0);

  const celebra = () => {
    setTrozos((n) => n + 1);
  };

  return { trozos, celebra };
}
