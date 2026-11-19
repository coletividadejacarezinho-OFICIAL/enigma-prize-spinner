import { useSyncExternalStore } from "react";

/** The three rehearsal states of the viewer page. */
export const WATCH_STATES = [
  { id: "aguardando", label: "Aguardando o sorteio" },
  { id: "andamento", label: "Sorteio em andamento" },
  { id: "encerrado", label: "Sorteio encerrado" },
] as const;
export type WatchState = (typeof WATCH_STATES)[number]["id"];

export function parseWatchState(value: string): WatchState {
  return WATCH_STATES.some((s) => s.id === value) ? (value as WatchState) : "aguardando";
}

export type WatchInfo = {
  groupLogo?: string;
  shopName: string;
  shopLogo?: string;
  prize: string;
  /** YYYY-MM-DD */
  date: string;
  winner: string;
};

/** Fictitious data owned by /assistir/demo, so it opens without the presenter's saved data. */
export const DEMO_WATCH: WatchInfo = {
  shopName: "Sorveteria Doce Gelo",
  prize: "Um pote de sorvete de 2 litros",
  date: "2026-11-28",
  winner: "Rosa Almeida",
};

/** Fictitious audience sample for "Quem acompanhou". Opening the page is not watching. */
export type AudienceEntry = { name: string; example: boolean; opened: true; played: boolean; liked: boolean };

export const DEMO_AUDIENCE: AudienceEntry[] = [
  { name: "Visitante anônimo", example: false, opened: true, played: true, liked: true },
  { name: "Rosa", example: true, opened: true, played: true, liked: true },
  { name: "Visitante anônimo", example: false, opened: true, played: false, liked: false },
  { name: "Márcio", example: true, opened: true, played: true, liked: false },
  { name: "Visitante anônimo", example: false, opened: true, played: false, liked: true },
  { name: "Visitante anônimo", example: false, opened: true, played: false, liked: false },
];

export function audienceTotals(list: AudienceEntry[]) {
  return {
    opened: list.filter((e) => e.opened).length,
    played: list.filter((e) => e.played).length,
    liked: list.filter((e) => e.liked).length,
  };
}

// The page's own 👍, kept in this browser only and unrelated to WhatsApp reactions.
const LIKE_KEY = "enigma-premiado:assistir-demo:curtida";
const LIKE_EVENT = "enigma-premiado:curtida";

export function readDemoLike(): boolean {
  try {
    return window.localStorage.getItem(LIKE_KEY) === "1";
  } catch {
    return false;
  }
}

/** First tap likes, second tap undoes. Returns the new value. */
export function toggleDemoLike(): boolean {
  const next = !readDemoLike();
  try {
    if (next) window.localStorage.setItem(LIKE_KEY, "1");
    else window.localStorage.removeItem(LIKE_KEY);
  } catch {
    // storage blocked: nothing to keep
  }
  window.dispatchEvent(new Event(LIKE_EVENT));
  return next;
}

function subscribe(cb: () => void) {
  window.addEventListener(LIKE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(LIKE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useDemoLike(): boolean {
  return useSyncExternalStore(subscribe, readDemoLike, () => false);
}
