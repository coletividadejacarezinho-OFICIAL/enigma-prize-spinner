export type DrawResult = {
  winner: string;
  /** Position of the winner in `names` at spin time. */
  index: number;
  /** Final wheel rotation in degrees, so the wheel reopens where it stopped. */
  rotation: number;
  at: number;
};

export type Draw = {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  merchant: string;
  prize: string;
  merchantLogo?: string;
  names: string[];
  isSample?: true;
  result?: DrawResult;
  createdAt: number;
};

export type AppState = {
  version: 1;
  draws: Draw[];
  currentId: string;
  groupLogo?: string;
  sound: boolean;
};

export const GROUP_NAME = "COLETIVIDADE JACAREZINHO PR";
export const APP_NAME = "Enigma Premiado";
export const MIN_NAMES_TO_SPIN = 2;
