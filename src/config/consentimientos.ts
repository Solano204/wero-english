import type { TipoConsentimiento } from '@/services/consentimiento';

/** Lo que dice cada hoja de consentimiento. Tiene que decir exactamente lo que hace la app: si el código cambia, esto cambia. */
export interface TextoConsentimiento {
  titulo: string;
  /** Qué se toma, en renglones cortos. */
  toma: string[];
  paraQue: string;
  donde: string;
  /** Qué viene después de aceptar, si Android pide su propio permiso. */
  despues?: string;
}

export const CONSENTIMIENTOS: Record<TipoConsentimiento, TextoConsentimiento> = {
  google: {
    titulo: '¿Usar tu cuenta de Google?',
    toma: ['Tu nombre', 'Tu correo', 'Tu foto de perfil'],
    paraQue: 'Para identificarte y guardar tu avance con tu cuenta.',
    donde: 'Solo en este teléfono. Wero no lo manda a ningún servidor.',
    despues: 'Después Android te muestra tus cuentas de Google para que elijas una.',
  },
  microfono: {
    titulo: '¿Usar el micrófono?',
    toma: ['Tu voz, solo mientras dices la palabra'],
    paraQue: 'Para saber qué palabra entendió el teléfono y compararla con la que se pidió.',
    // Verificado en src/services/speech.ts (reconoceEnDispositivo) y en expo-speech-recognition: en Android 13+
    // con en-US instalado se usa el reconocedor del dispositivo; si no, el del sistema, que puede usar la nube.
    donde:
      'Si tu teléfono puede reconocer inglés sin conexión, tu voz se procesa en el teléfono y no sale de él. Si no, la procesa el servicio de voz de tu teléfono (normalmente el de Google), que puede mandarla a sus servidores para entenderla. Wero no graba ni guarda el audio: solo recibe el texto de lo que se entendió.',
    despues: 'Después Android te pide el permiso del micrófono.',
  },
  notificaciones: {
    titulo: '¿Te mandamos frases durante el día?',
    toma: [
      'Hasta 4 avisos al día (tú eliges de 0 a 12), dentro del horario que marques',
      'Cada uno es una frase: una para ver si la sabes, las que tienes por repasar o una que se te atora',
    ],
    paraQue: 'Para que repases un poco sin abrir la app. Se ven en la pantalla bloqueada.',
    donde: 'Se programan en este teléfono. No pasan por ningún servidor.',
    despues: 'Después Android te pide el permiso de notificaciones.',
  },
  descargas: {
    titulo: '¿Descargar audio e imágenes?',
    toma: ['Nada tuyo: solo se piden los archivos del paquete'],
    paraQue:
      'Para oír las frases y ver sus imágenes. Como en cualquier descarga, el servidor de archivos ve tu dirección de internet (IP) y qué paquete pides.',
    donde: 'Los archivos se guardan en este teléfono.',
  },
};
