export type DrawResult = {
  winner: string;
  /** Position of the winner in `names` at spin time. */
  index: number;
  /** Final wheel rotation in degrees, so the wheel reopens where it stopped. */
  rotation: number;
  at: number;
};

export type Merchant = {
  id: string;
  name: string;
  logo?: string;
  createdAt: number;
};

export type RecordingMode = "roleta-voz" | "roleta-camera" | "voz";

/** A simulated test recording: no camera, microphone or file is ever used. */
export type Recording = {
  id: string;
  mode: RecordingMode;
  mic: boolean;
  startedAt: number;
  durationMs: number;
  /** Set when the wheel was spun during this test. */
  winner?: string;
};

export type RecordingSession = {
  drawId: string;
  mode: RecordingMode;
  mic: boolean;
  startedAt: number;
};

export type Draw = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Registered partner shop; its current name and logo win over the copies below. */
  merchantId?: string;
  /** Name copy for display when the shop record is missing (e.g. the test round). */
  merchant: string;
  prize: string;
  /** Logo copy for draws made before shops were registered. */
  merchantLogo?: string;
  /** "O comércio confirmou a cortesia?" — only confirmed draws count for the Listão. */
  confirmed?: boolean;
  names: string[];
  isSample?: true;
  result?: DrawResult;
  recordings?: Recording[];
  createdAt: number;
};

export type AppState = {
  version: 1;
  draws: Draw[];
  merchants: Merchant[];
  currentId: string;
  groupLogo?: string;
  sound: boolean;
  /** Test recording in progress, kept so switching tabs doesn't stop it. */
  recording?: RecordingSession;
};

export const GROUP_NAME = "COLETIVIDADE JACAREZINHO PR";
export const APP_NAME = "Enigma Premiado";
export const MIN_NAMES_TO_SPIN = 2;
/** Days a confirmed courtesy keeps the shop on the Listão, counting the draw day itself. */
export const LISTAO_DAYS = 30;

export const RECORDING_MODES: { id: RecordingMode; label: string; video: boolean }[] = [
  { id: "roleta-voz", label: "Roleta com minha voz", video: true },
  { id: "roleta-camera", label: "Roleta com minha câmera", video: true },
  { id: "voz", label: "Só minha voz", video: false },
];
