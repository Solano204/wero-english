import React from 'react';
import { View } from 'react-native';
import type { Icon as PhosphorIcon } from 'phosphor-react-native';
import { ArrowClockwiseIcon } from 'phosphor-react-native/src/icons/ArrowClockwise';
import { ArrowLeftIcon } from 'phosphor-react-native/src/icons/ArrowLeft';
import { ArrowRightIcon } from 'phosphor-react-native/src/icons/ArrowRight';
import { BarbellIcon } from 'phosphor-react-native/src/icons/Barbell';
import { CaretDownIcon } from 'phosphor-react-native/src/icons/CaretDown';
import { CaretRightIcon } from 'phosphor-react-native/src/icons/CaretRight';
import { CaretUpIcon } from 'phosphor-react-native/src/icons/CaretUp';
import { ChartLineUpIcon } from 'phosphor-react-native/src/icons/ChartLineUp';
import { CheckIcon } from 'phosphor-react-native/src/icons/Check';
import { CellSignalSlashIcon } from 'phosphor-react-native/src/icons/CellSignalSlash';
import { ClockIcon } from 'phosphor-react-native/src/icons/Clock';
import { CompassIcon } from 'phosphor-react-native/src/icons/Compass';
import { EyeIcon } from 'phosphor-react-native/src/icons/Eye';
import { GearSixIcon } from 'phosphor-react-native/src/icons/GearSix';
import { HourglassMediumIcon } from 'phosphor-react-native/src/icons/HourglassMedium';
import { InfoIcon } from 'phosphor-react-native/src/icons/Info';
import { LightbulbIcon } from 'phosphor-react-native/src/icons/Lightbulb';
import { LockSimpleIcon } from 'phosphor-react-native/src/icons/LockSimple';
import { ListChecksIcon } from 'phosphor-react-native/src/icons/ListChecks';
import { DeviceMobileIcon } from 'phosphor-react-native/src/icons/DeviceMobile';
import { SmileyIcon } from 'phosphor-react-native/src/icons/Smiley';
import { MicrophoneSlashIcon } from 'phosphor-react-native/src/icons/MicrophoneSlash';
import { PauseIcon } from 'phosphor-react-native/src/icons/Pause';
import { PlayIcon } from 'phosphor-react-native/src/icons/Play';
import { SkipBackIcon } from 'phosphor-react-native/src/icons/SkipBack';
import { SkipForwardIcon } from 'phosphor-react-native/src/icons/SkipForward';
import { SpeakerHighIcon } from 'phosphor-react-native/src/icons/SpeakerHigh';
import { SpeakerSlashIcon } from 'phosphor-react-native/src/icons/SpeakerSlash';
import { SunIcon } from 'phosphor-react-native/src/icons/Sun';
import { SignpostIcon } from 'phosphor-react-native/src/icons/Signpost';
import { CurrencyDollarIcon } from 'phosphor-react-native/src/icons/CurrencyDollar';
import { UsersThreeIcon } from 'phosphor-react-native/src/icons/UsersThree';
import { MusicNotesIcon } from 'phosphor-react-native/src/icons/MusicNotes';
import { CpuIcon } from 'phosphor-react-native/src/icons/Cpu';
import { ScalesIcon } from 'phosphor-react-native/src/icons/Scales';
import { StarIcon } from 'phosphor-react-native/src/icons/Star';
import { StopIcon } from 'phosphor-react-native/src/icons/Stop';
import { WarningIcon } from 'phosphor-react-native/src/icons/Warning';
import { XIcon } from 'phosphor-react-native/src/icons/X';
import { AnchorIcon } from 'phosphor-react-native/src/icons/Anchor';
import { BookmarkIcon } from 'phosphor-react-native/src/icons/Bookmark';
import { BookOpenIcon } from 'phosphor-react-native/src/icons/BookOpen';
import { BooksIcon } from 'phosphor-react-native/src/icons/Books';
import { CardsIcon } from 'phosphor-react-native/src/icons/Cards';
import { EarIcon } from 'phosphor-react-native/src/icons/Ear';
import { FlameIcon } from 'phosphor-react-native/src/icons/Flame';
import { HeadphonesIcon } from 'phosphor-react-native/src/icons/Headphones';
import { HexagonIcon } from 'phosphor-react-native/src/icons/Hexagon';
import { MicrophoneIcon } from 'phosphor-react-native/src/icons/Microphone';
import { PuzzlePieceIcon } from 'phosphor-react-native/src/icons/PuzzlePiece';
import { ShareNetworkIcon } from 'phosphor-react-native/src/icons/ShareNetwork';
import { ShuffleIcon } from 'phosphor-react-native/src/icons/Shuffle';
import { TargetIcon } from 'phosphor-react-native/src/icons/Target';
import { WaveformIcon } from 'phosphor-react-native/src/icons/Waveform';
import { ArrowDownIcon } from 'phosphor-react-native/src/icons/ArrowDown';
import { CubeIcon } from 'phosphor-react-native/src/icons/Cube';
import { GameControllerIcon } from 'phosphor-react-native/src/icons/GameController';
import { LinkIcon } from 'phosphor-react-native/src/icons/Link';
import { ImageSquareIcon } from 'phosphor-react-native/src/icons/ImageSquare';
import { color } from '@/theme';

/**
 * ÚNICA puerta a los íconos. Nadie más importa phosphor-react-native
 * (check:imports lo vigila). Se importa cada ícono por su archivo, no del
 * índice: Metro no hace tree-shaking y el índice arrastra 1,500 íconos.
 *
 * Los nombres dicen para qué sirve el ícono, no cómo se dibuja: si mañana
 * "slow" pasa de reloj de arena a otra cosa, nadie más se entera.
 */
/** Un solo grosor para toda la app: bold. */
const PESO = 'bold';

interface Definicion {
  Componente: PhosphorIcon;
  /** Solo "star-filled": el estado encendido necesita relleno, no otro grosor. */
  relleno?: boolean;
}

const ICONOS = {
  play: { Componente: PlayIcon },
  pause: { Componente: PauseIcon },
  stop: { Componente: StopIcon },
  previous: { Componente: SkipBackIcon },
  next: { Componente: SkipForwardIcon },
  // Phosphor no trae tortuga: el reloj de arena es lo más cercano a "lento",
  // y por sí solo no dice "lento". Regla: SIEMPRE con el texto "Lento" a la
  // vista (o accessibilityLabel "Lento" si el botón es solo ícono y tiene
  // contexto visual). AudioButton la cumple: en slow, la etiqueta es "Lento".
  slow: { Componente: HourglassMediumIcon },
  volume: { Componente: SpeakerHighIcon },
  'volume-off': { Componente: SpeakerSlashIcon },
  'mic-off': { Componente: MicrophoneSlashIcon },
  star: { Componente: StarIcon },
  'star-filled': { Componente: StarIcon, relleno: true },
  check: { Componente: CheckIcon },
  close: { Componente: XIcon },
  'chevron-right': { Componente: CaretRightIcon },
  'chevron-down': { Componente: CaretDownIcon },
  'chevron-up': { Componente: CaretUpIcon },
  'arrow-right': { Componente: ArrowRightIcon },
  back: { Componente: ArrowLeftIcon },
  repeat: { Componente: ArrowClockwiseIcon },
  lock: { Componente: LockSimpleIcon },
  warning: { Componente: WarningIcon },
  info: { Componente: InfoIcon },
  hint: { Componente: LightbulbIcon },
  reveal: { Componente: EyeIcon },
  explore: { Componente: CompassIcon },
  practice: { Componente: BarbellIcon },
  progress: { Componente: ChartLineUpIcon },
  anchor: { Componente: AnchorIcon },
  bookmark: { Componente: BookmarkIcon },
  book: { Componente: BookOpenIcon },
  books: { Componente: BooksIcon },
  cards: { Componente: CardsIcon },
  ear: { Componente: EarIcon },
  smile: { Componente: SmileyIcon },
  fire: { Componente: FlameIcon },
  headphones: { Componente: HeadphonesIcon },
  hexagon: { Componente: HexagonIcon },
  image: { Componente: ImageSquareIcon },
  microphone: { Componente: MicrophoneIcon },
  puzzle: { Componente: PuzzlePieceIcon },
  shuffle: { Componente: ShuffleIcon },
  target: { Componente: TargetIcon },
  waveform: { Componente: WaveformIcon },
  // Un ícono por mundo: los mundos son una escala de azules y lo que los distingue es el ícono (ver PuntoMundo).
  sun: { Componente: SunIcon },
  signpost: { Componente: SignpostIcon },
  money: { Componente: CurrencyDollarIcon },
  users: { Componente: UsersThreeIcon },
  music: { Componente: MusicNotesIcon },
  cpu: { Componente: CpuIcon },
  scales: { Componente: ScalesIcon },
  'arrow-down': { Componente: ArrowDownIcon },
  cube: { Componente: CubeIcon },
  game: { Componente: GameControllerIcon },
  link: { Componente: LinkIcon },
  // El reloj de ronda de los juegos (Pares): el ícono dice que la barra es tiempo.
  clock: { Componente: ClockIcon },
  // La señal que se rompe de Errores que te delatan: lo que entienden no es lo que dijiste.
  'signal-broken': { Componente: CellSignalSlashIcon },
  share: { Componente: ShareNetworkIcon },
  list: { Componente: ListChecksIcon },
  phone: { Componente: DeviceMobileIcon },
  // La entrada a Ajustes (cuenta, recordatorios, contenido), en el encabezado de Progreso.
  settings: { Componente: GearSixIcon },
} satisfies Record<string, Definicion>;

export type IconName = keyof typeof ICONOS;

export const ICON_NAMES = Object.keys(ICONOS) as IconName[];

export const ICON_SIZE = { sm: 16, md: 20, lg: 24, xl: 32 } as const;
export type IconSize = keyof typeof ICON_SIZE;

interface Props {
  name: IconName;
  size?: IconSize;
  color?: string;
  /** Sin etiqueta el ícono es decorativo y el lector de pantalla lo salta. */
  accessibilityLabel?: string;
}

export function Icon({
  name,
  size = 'md',
  color: tinte = color.text,
  accessibilityLabel,
}: Props) {
  const { Componente, relleno } = ICONOS[name] as Definicion;
  const icono = <Componente size={ICON_SIZE[size]} color={tinte} weight={relleno ? 'fill' : PESO} />;
  if (accessibilityLabel === undefined) return icono;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      {icono}
    </View>
  );
}
