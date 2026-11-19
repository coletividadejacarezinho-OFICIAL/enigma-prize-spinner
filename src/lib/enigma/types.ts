export type DrawResult = {
  winner: string;
  /** Position of the winner in `names` at spin time. */
  index: number;
  /** Final wheel rotation in degrees, so the wheel reopens where it stopped. */
  rotation: number;
  at: number;
  /** Entry that won (E02). Older results have only the name; names on a confirmed list are unique. */
  entryId?: string;
};

export type Merchant = {
  id: string;
  name: string;
  logo?: string;
  createdAt: number;
};

export type RecordingMode = "roleta-voz" | "roleta-camera" | "voz";

/**
 * A recording of a draw. Older ones are simulated tests (no camera, no file);
 * `real` ones have a video kept in this browser's IndexedDB under the same id.
 */
export type Recording = {
  id: string;
  mode: RecordingMode;
  mic: boolean;
  startedAt: number;
  durationMs: number;
  /** Set when the wheel was spun during this recording (first result). */
  winner?: string;
  real?: true;
  mimeType?: string;
  size?: number;
  /** Every round decided while recording. */
  rounds?: { prize: string; merchant: string; winner: string }[];
};

export type RecordingSession = {
  drawId: string;
  mode: RecordingMode;
  mic: boolean;
  startedAt: number;
};

/** Why an entry waits for the organizer before it can go on the wheel. */
export type PendingReason =
  | { kind: "repetido"; withId: string }
  | { kind: "parecido"; withId: string }
  | { kind: "conferir" };

export type BotSituation = "acertou" | "conferir";

/** One person in the Nomes list. Only "ready" entries can be confirmed for the wheel. */
export type Entry = {
  id: string;
  /** Display name: what the wheel and the group message show. */
  name: string;
  source: "manual" | "bot";
  status: "ready" | "pending";
  reason?: PendingReason;
  /** Fictitious bot sender ids linked to this person, so a repeated message never adds a second spot. */
  senderIds?: string[];
  /** Bot entries: "HH:MM" in Jacarezinho and what the bot said. */
  botTime?: string;
  botSituation?: BotSituation;
  addedAt: number;
};

export type BotOutcome = "entrou" | "revisao" | "repetida" | "fora-do-prazo";

/** A simulated bot message and what happened to it (demonstration only). */
export type BotMessage = {
  id: string;
  name: string;
  senderId: string;
  time: string;
  situation: BotSituation;
  outcome: BotOutcome;
  at: number;
};

/** A courtesy after the first one; the first stays in the draw's own merchant/prize/result fields. */
export type Prize = {
  id: string;
  merchantId?: string;
  merchant: string;
  merchantLogo?: string;
  prize: string;
  result?: DrawResult;
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
  /** The confirmed list: exactly what the wheel and "Mandar lista no grupo" use. */
  names: string[];
  /** Working list in Nomes; changes here need a new confirmation before reaching `names`. */
  entries?: Entry[];
  botMessages?: BotMessage[];
  isSample?: true;
  /** Result of the first courtesy; set as soon as any round is spun, so it also locks the list. */
  result?: DrawResult;
  /** Courtesies 2, 3…: same list of names, one winner each, spun in order. */
  extraPrizes?: Prize[];
  /** "Quem ganhar pode ganhar de novo neste sorteio?" — only asked with 2 or more courtesies. */
  repeatWinners?: boolean;
  /** Round the Roleta shows (0-based); moves on only through "Sortear próxima cortesia". */
  shownRound?: number;
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
  /** Spin track volume 0..1 (E06); missing = 0.7. */
  volume?: number;
  /** Test recording in progress, kept so switching tabs doesn't stop it. */
  recording?: RecordingSession;
};

export const GROUP_NAME = "COLETIVIDADE JACAREZINHO PR";
export const APP_NAME = "Enigma Premiado";
export const MIN_NAMES_TO_SPIN = 2;
/** Bot entries close at this time, Jacarezinho (America/Sao_Paulo) local time. */
export const BOT_CLOSE_TIME = "19:30";
export const BOT_TIME_ZONE = "America/Sao_Paulo";
/** Days a confirmed courtesy keeps the shop on the Listão, counting the draw day itself. */
export const LISTAO_DAYS = 30;

export const RECORDING_MODES: { id: RecordingMode; label: string; video: boolean }[] = [
  { id: "roleta-voz", label: "Só a roleta", video: true },
  { id: "roleta-camera", label: "Roleta com meu rosto", video: true },
  { id: "voz", label: "Só minha voz", video: false },
];
