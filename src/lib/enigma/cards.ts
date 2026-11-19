/**
 * Share-as-image artwork (stage 10): what each picture shows and how it is split
 * into numbered pictures. Pure functions only; the drawing lives in cards-render.ts.
 */
import { winnerNumber } from "./numbers";
import { formatDateBR, type ListaoEntry, type ScheduledEntry } from "./logic";
import { allRoundsDone, roundsOf } from "./rounds";
import type { Draw, Merchant } from "./types";

export type Measure = (text: string) => number;

/**
 * Breaks text into lines no wider than maxWidth. Never drops a character:
 * a single word wider than the line is split between letters.
 */
export function wrapLines(text: string, maxWidth: number, measure: Measure): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (measure(next) <= maxWidth) {
      cur = next;
      continue;
    }
    if (cur) lines.push(cur);
    cur = "";
    if (measure(word) <= maxWidth) {
      cur = word;
      continue;
    }
    let piece = "";
    for (const ch of Array.from(word)) {
      if (piece && measure(piece + ch) > maxWidth) {
        lines.push(piece);
        piece = ch;
      } else piece += ch;
    }
    cur = piece;
  }
  if (cur) lines.push(cur);
  return lines.length > 0 ? lines : [""];
}

/**
 * The biggest size (from `sizes`, largest first) at which the text fits in maxLines.
 * When even the smallest size needs more lines, it keeps every line: nothing is ever cut.
 */
export function fitText(
  text: string,
  maxWidth: number,
  maxLines: number,
  sizes: number[],
  measureAt: (text: string, size: number) => number,
): { size: number; lines: string[] } {
  let last = { size: sizes[sizes.length - 1] ?? 40, lines: [text] };
  for (const size of sizes) {
    const lines = wrapLines(text, maxWidth, (t) => measureAt(t, size));
    last = { size, lines };
    if (lines.length <= maxLines) return last;
  }
  return last;
}

/**
 * Splits items of the given heights into consecutive groups (pictures or columns),
 * keeping their order. `capacity(i)` is the room of group i. An item taller than
 * its group still gets a group of its own, so nothing is ever left out.
 */
export function paginate(heights: number[], capacity: (group: number) => number, gap = 0): number[][] {
  const groups: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  heights.forEach((h, i) => {
    const need = cur.length > 0 ? used + gap + h : h;
    if (cur.length > 0 && need > capacity(groups.length)) {
      groups.push(cur);
      cur = [i];
      used = h;
    } else {
      cur.push(i);
      used = need;
    }
  });
  if (cur.length > 0 || groups.length === 0) groups.push(cur);
  return groups;
}

/** "Parte 2 de 3", only when there is more than one picture. */
export function partLabel(index: number, total: number): string | null {
  return total > 1 ? `Parte ${index + 1} de ${total}` : null;
}

const SMALL_WORDS = new Set(["de", "da", "do", "das", "dos", "e", "a", "o"]);

/** Up to two letters for a shop without a logo: "Padaria Pão de Ouro" → "PP". */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()));
  const letters = words.slice(0, 2).map((w) => Array.from(w)[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export type CardKind = "lista" | "listao" | "ganhador" | "resumo";

/** enigma-lista-2026-11-19-parte-1-de-3.png */
export function cardFileName(kind: CardKind, date: string, part = 0, parts = 1, round?: number): string {
  const r = round !== undefined ? `-premio-${round + 1}` : "";
  const p = parts > 1 ? `-parte-${part + 1}-de-${parts}` : "";
  return `enigma-${kind}-${date}${r}${p}.png`;
}

// ---------- 1. Mandar lista no grupo ----------

export type ListCard = {
  date: string;
  courtesies: { prize: string; merchantName: string }[];
  /** The confirmed list, in wheel order. */
  names: string[];
};

/** Only the confirmed names (`draw.names`), the same ones and order as the wheel. */
export function listCardData(draw: Draw, merchants: Merchant[]): ListCard {
  return {
    date: draw.date,
    courtesies: roundsOf(draw, merchants).map((r) => ({ prize: r.prize, merchantName: r.merchantName })),
    names: [...draw.names],
  };
}

export function participantsLabel(n: number): string {
  return `${n} ${n === 1 ? "participante confirmado" : "participantes confirmados"}`;
}

// ---------- 2. Listão da Alegria ----------

export type ListaoItem =
  | { kind: "section"; title: string }
  | { kind: "shop"; id: string; name: string; logo?: string; note: string };

/** Same information and order as the Listão screen: shops in publicity, then the scheduled ones. */
export function listaoCardItems(active: ListaoEntry[], scheduled: ScheduledEntry[]): ListaoItem[] {
  const shop = (m: Merchant, note: string): ListaoItem => ({
    kind: "shop",
    id: m.id,
    name: m.name,
    ...(m.logo ? { logo: m.logo } : {}),
    note,
  });
  const items: ListaoItem[] = active.map((e) => shop(e.merchant, `Em divulgação até ${formatDateBR(e.until)}`));
  if (scheduled.length > 0) {
    items.push({ kind: "section", title: "Agendados" });
    for (const e of scheduled) items.push(shop(e.merchant, `Começa em ${formatDateBR(e.starts)}`));
  }
  return items;
}

export function shopsLabel(n: number): string {
  return `${n} ${n === 1 ? "comércio em divulgação" : "comércios em divulgação"}`;
}

// ---------- 3. Ganhador do sorteio ----------

export type WinnerCard = {
  date: string;
  round: number;
  /** "Prêmio 2 de 3" for draws with several courtesies. */
  label: string | null;
  winner: string;
  /** Public number in the confirmed list (E06); null for results that cannot be matched. */
  number: number | null;
  prize: string;
  merchantName: string;
  merchantLogo?: string;
};

/** The saved winner of one courtesy; null while that courtesy has not been spun. */
export function winnerCardData(draw: Draw, merchants: Merchant[], index: number): WinnerCard | null {
  const rounds = roundsOf(draw, merchants);
  const r = rounds[index];
  if (!r?.result) return null;
  return {
    date: draw.date,
    round: index,
    label: rounds.length > 1 ? `Prêmio ${index + 1} de ${rounds.length}` : null,
    winner: r.result.winner,
    number: winnerNumber(draw, r.result),
    prize: r.prize,
    merchantName: r.merchantName,
    ...(r.merchantLogo ? { merchantLogo: r.merchantLogo } : {}),
  };
}

export type SummaryCard = {
  date: string;
  rows: { label: string; winner: string; number: number | null; prize: string; merchantName: string; merchantLogo?: string }[];
};

/** All results together, only for draws with several courtesies once every one is spun. */
export function summaryCardData(draw: Draw, merchants: Merchant[]): SummaryCard | null {
  const rounds = roundsOf(draw, merchants);
  if (rounds.length < 2 || !allRoundsDone(draw)) return null;
  return {
    date: draw.date,
    rows: rounds.map((r) => ({
      label: `Prêmio ${r.index + 1}`,
      winner: r.result?.winner ?? "",
      number: winnerNumber(draw, r.result),
      prize: r.prize,
      merchantName: r.merchantName,
      ...(r.merchantLogo ? { merchantLogo: r.merchantLogo } : {}),
    })),
  };
}

export type WinnerChoice = number | "resumo";

/** What "Compartilhar arte do ganhador" can show: each spun courtesy, then the summary. */
export function winnerChoices(draw: Draw, merchants: Merchant[]): { id: WinnerChoice; label: string }[] {
  const rounds = roundsOf(draw, merchants);
  const out: { id: WinnerChoice; label: string }[] = [];
  if (summaryCardData(draw, merchants)) out.push({ id: "resumo", label: "Resumo" });
  for (const r of rounds) if (r.result) out.push({ id: r.index, label: rounds.length > 1 ? `Prêmio ${r.index + 1}` : "Ganhador" });
  return out;
}
