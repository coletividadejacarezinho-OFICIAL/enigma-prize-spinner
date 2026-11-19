import type { AppState, Draw } from "./types";

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
    isSample: true,
    createdAt: Date.now(),
  };
  return { version: 1, draws: [sample], currentId: sample.id, sound: true };
}

/** A new round always starts with an empty list of names. */
export function createDraw(input: {
  date: string;
  merchant: string;
  prize: string;
  merchantLogo?: string;
}): Draw {
  const draw: Draw = {
    id: newId(),
    date: input.date,
    merchant: input.merchant.trim(),
    prize: input.prize.trim(),
    names: [],
    createdAt: Date.now(),
  };
  if (input.merchantLogo) draw.merchantLogo = input.merchantLogo;
  return draw;
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

export function shareText(draw: Draw, groupName: string): string {
  const lines = [
    `🎉 Enigma Premiado — ${groupName}`,
    `Sorteio de ${formatDateBR(draw.date)}`,
    "",
    `Ganhador(a): ${draw.result?.winner ?? ""}`,
    `Cortesia: ${draw.prize}`,
    `Oferecimento: ${draw.merchant}`,
  ];
  return lines.join("\n");
}
