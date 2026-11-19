import {
  LISTAO_DAYS,
  RECORDING_MODES,
  type AppState,
  type Draw,
  type Entry,
  type Merchant,
  type Recording,
  type RecordingSession,
} from "./types";

export const SAMPLE_NAMES = [
  "Ana Souza",
  "Bruno Lima",
  "Carla Mendes",
  "Diego Rocha",
  "Elaine Costa",
  "Fábio Nunes",
];

export function todayISO(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD -> DD/MM/AAAA */
export function formatDateBR(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createSampleState(): AppState {
  const sample: Draw = {
    id: newId(),
    date: todayISO(),
    merchant: "Padaria Pão de Ouro",
    prize: "Uma cesta de café da manhã para 2 pessoas",
    names: [...SAMPLE_NAMES],
    entries: entriesFromNames(SAMPLE_NAMES, Date.now(), false),
    isSample: true,
    createdAt: Date.now(),
  };
  return { version: 1, draws: [sample], merchants: [], currentId: sample.id, sound: true };
}

/** A new round always starts with an empty list of names. */
export function createDraw(input: {
  date: string;
  merchant: Merchant;
  prize: string;
  confirmed: boolean;
}): Draw {
  return {
    id: newId(),
    date: input.date,
    merchantId: input.merchant.id,
    merchant: input.merchant.name,
    prize: input.prize.trim(),
    confirmed: input.confirmed,
    names: [],
    entries: [],
    createdAt: Date.now(),
  };
}

/**
 * Entries for a list saved before stage 7. When `flagRepeats` is on, a name that
 * repeats an earlier one waits in "Revisar pendências" instead of being dropped.
 */
export function entriesFromNames(names: string[], now: number, flagRepeats: boolean): Entry[] {
  const seen = new Map<string, string>();
  return names.map((name, i) => {
    const id = `e${now}-${i}`;
    const key = normalizeForCompare(name);
    const first = seen.get(key);
    if (flagRepeats && first) {
      return { id, name, source: "manual", status: "pending", reason: { kind: "repetido", withId: first }, addedAt: now };
    }
    if (!first) seen.set(key, id);
    return { id, name, source: "manual", status: "ready", addedAt: now };
  });
}

export function createMerchant(input: { name: string; logo?: string | undefined }): Merchant {
  const m: Merchant = { id: newId(), name: cleanName(input.name), createdAt: Date.now() };
  if (input.logo) m.logo = input.logo;
  return m;
}

/** Name and logo to show for a draw: the registered shop's current data when there is one. */
export function merchantOf(
  merchants: Merchant[],
  draw: Draw,
): { name: string; logo: string | undefined } {
  const m = draw.merchantId ? merchants.find((x) => x.id === draw.merchantId) : undefined;
  if (m) return { name: m.name, logo: m.logo };
  return { name: draw.merchant, logo: draw.merchantLogo };
}

/**
 * Older saved data had no shop records: give it an empty list and turn the shop
 * names of real (non-test) draws into registered shops, once per name.
 */
export function migrateState(state: AppState): AppState {
  const merchants: Merchant[] = Array.isArray(state.merchants) ? [...state.merchants] : [];
  let changed = !Array.isArray(state.merchants);
  const draws = state.draws.map((raw) => {
    let d = raw;
    if (!Array.isArray(d.entries)) {
      // The saved list stays as the confirmed one; a spun draw keeps every name it used.
      d = { ...d, entries: entriesFromNames(d.names, d.createdAt, !d.result) };
      changed = true;
    }
    if (d.merchantId || d.isSample) return d;
    const key = normalizeForCompare(d.merchant);
    let m = merchants.find((x) => normalizeForCompare(x.name) === key);
    if (!m) {
      m = createMerchant({ name: d.merchant, logo: d.merchantLogo });
      m.createdAt = d.createdAt;
      merchants.push(m);
    } else if (!m.logo && d.merchantLogo) {
      m.logo = d.merchantLogo;
    }
    changed = true;
    return { ...d, merchantId: m.id };
  });
  return changed ? { ...state, merchants, draws } : state;
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
}

export type ListaoEntry = {
  merchant: Merchant;
  /** Most recent confirmed draw date that has already arrived. */
  since: string;
  /** Last day on the Listão (inclusive). */
  until: string;
};

export type ScheduledEntry = { merchant: Merchant; starts: string };

/**
 * The Listão da Alegria: shops with a confirmed courtesy, each listed once.
 * A shop stays for LISTAO_DAYS calendar days counting its latest arrived draw date;
 * a confirmed courtesy dated in the future is only scheduled.
 */
export function buildListao(
  state: Pick<AppState, "draws" | "merchants">,
  today: string,
): { active: ListaoEntry[]; scheduled: ScheduledEntry[] } {
  const latestPast = new Map<string, string>();
  const earliestFuture = new Map<string, string>();
  for (const d of state.draws) {
    if (d.isSample || d.confirmed !== true || !d.merchantId) continue;
    if (d.date <= today) {
      const prev = latestPast.get(d.merchantId);
      if (!prev || d.date > prev) latestPast.set(d.merchantId, d.date);
    } else {
      const prev = earliestFuture.get(d.merchantId);
      if (!prev || d.date < prev) earliestFuture.set(d.merchantId, d.date);
    }
  }
  const active: ListaoEntry[] = [];
  const scheduled: ScheduledEntry[] = [];
  for (const merchant of state.merchants) {
    const since = latestPast.get(merchant.id);
    const until = since ? addDaysISO(since, LISTAO_DAYS - 1) : undefined;
    if (since && until && today <= until) {
      active.push({ merchant, since, until });
      continue;
    }
    const starts = earliestFuture.get(merchant.id);
    if (starts) scheduled.push({ merchant, starts });
  }
  const byName = (a: { merchant: Merchant }, b: { merchant: Merchant }) =>
    a.merchant.name.localeCompare(b.merchant.name, "pt-BR");
  active.sort(byName);
  scheduled.sort((a, b) => a.starts.localeCompare(b.starts) || byName(a, b));
  return { active, scheduled };
}

export function listaoText(groupName: string, today: string, entries: ListaoEntry[]): string {
  const lines = [groupName, "🎉 Listão da Alegria", formatDateBR(today), ""];
  if (entries.length === 0) lines.push("Nenhum comércio em divulgação hoje");
  else {
    lines.push("Parceiros em divulgação:");
    for (const e of entries) lines.push(`• ${e.merchant.name}`);
  }
  return lines.join("\n");
}

export function cleanName(name: string): string {
  return name.replace(/\s+/g, " ").trim();
}

/** One name per line; blank lines are skipped. */
export function parsePastedList(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanName(line.replace(/^\s*\d+\s*[-.)]\s*/, "")))
    .filter((line) => line.length > 0);
}

export function normalizeForCompare(name: string): string {
  return cleanName(name)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Maps each list position to every position (0-based) holding the same name, for names that repeat. */
export function findDuplicates(names: string[]): Map<number, number[]> {
  const groups = new Map<string, number[]>();
  names.forEach((name, i) => {
    const key = normalizeForCompare(name);
    const list = groups.get(key) ?? [];
    list.push(i);
    groups.set(key, list);
  });
  const result = new Map<number, number[]>();
  for (const positions of groups.values()) {
    if (positions.length < 2) continue;
    for (const p of positions) result.set(p, positions);
  }
  return result;
}

/** Uniform random index in [0, count). */
export function pickWinnerIndex(count: number, random: () => number = secureRandom): number {
  if (count <= 0) throw new Error("No names to draw from");
  return Math.min(count - 1, Math.floor(random() * count));
}

export function secureRandom(): number {
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] ?? 0) / 4294967296;
  }
  return Math.random();
}

/**
 * Angles run clockwise from the top, where the pointer sits.
 * Segment i spans [i * seg, (i + 1) * seg] before rotation.
 */
export function targetRotation(
  current: number,
  index: number,
  count: number,
  jitter01 = 0.5,
  extraTurns = 6,
): number {
  const seg = 360 / count;
  // Stay within the middle 70% of the segment so the pointer never lands on a border.
  const offset = seg * (0.15 + 0.7 * jitter01);
  const angle = index * seg + offset;
  const wanted = (((360 - angle) % 360) + 360) % 360;
  const currentMod = ((current % 360) + 360) % 360;
  const delta = (((wanted - currentMod) % 360) + 360) % 360;
  return current + extraTurns * 360 + delta;
}

export function segmentAtPointer(rotation: number, count: number): number {
  const seg = 360 / count;
  const angle = (((-rotation) % 360) + 360) % 360;
  return Math.min(count - 1, Math.floor(angle / seg));
}

/**
 * WhatsApp result message, built only from the saved result of that draw.
 * Returns null while the draw has no result, so nothing can be shared before a spin.
 */
export function resultMessage(draw: Draw, merchantName: string, groupName: string): string | null {
  if (!draw.result) return null;
  return [
    "🏆 Resultado do Enigma Premiado",
    groupName,
    `📅 ${formatDateBR(draw.date)}`,
    `🎉 Ganhador(a): ${draw.result.winner}`,
    `🎁 Cortesia: ${draw.prize}`,
    `🤝 Oferecimento: ${merchantName}`,
    "",
    "Parabéns! Chame a administração no privado para combinar a retirada.",
    "Reaja com 👍 aqui no grupo!",
  ].join("\n");
}

/** Opens WhatsApp with the text filled in; the person picks the group and taps Enviar. */
export function whatsappLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** mm:ss, or h:mm:ss past an hour. */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${String(m).padStart(2, "0")}:${sec}`;
}

/** Video modes may turn the microphone off; "Só minha voz" always keeps it on. */
export function micFor(mode: RecordingSession["mode"], mic: boolean): boolean {
  const video = RECORDING_MODES.find((m) => m.id === mode)?.video ?? false;
  return video ? mic : true;
}

/** Closes a test recording; the winner counts only if the wheel was spun after it started. */
export function finishRecording(session: RecordingSession, draw: Draw, now: number): Recording {
  const rec: Recording = {
    id: newId(),
    mode: session.mode,
    mic: micFor(session.mode, session.mic),
    startedAt: session.startedAt,
    durationMs: Math.max(0, now - session.startedAt),
  };
  if (draw.result && draw.result.at >= session.startedAt) rec.winner = draw.result.winner;
  return rec;
}
