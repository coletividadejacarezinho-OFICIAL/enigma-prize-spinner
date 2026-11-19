/**
 * Rules for the Nomes list (stage 7): who is ready, who waits for review, what the
 * wheel and the group message use, and how simulated bot messages are handled.
 * Pure functions only, so every rule can be tested without the screen.
 */
import { cleanName, entriesFromNames, formatDateBR, newId, normalizeForCompare } from "./logic";
import {
  BOT_CLOSE_TIME,
  BOT_TIME_ZONE,
  type BotMessage,
  type BotOutcome,
  type BotSituation,
  type Draw,
  type Entry,
  type PendingReason,
} from "./types";

export function entriesOf(draw: Draw): Entry[] {
  return draw.entries ?? entriesFromNames(draw.names, draw.createdAt, false);
}

export function readyEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.status === "ready");
}

export function pendingEntries(entries: Entry[]): Entry[] {
  return entries.filter((e) => e.status === "pending");
}

/** Display names of the ready entries, in list order: what a confirmation saves. */
export function readyNames(entries: Entry[]): string[] {
  return readyEntries(entries).map((e) => e.name);
}

/** True when the Nomes list differs from the confirmed list on the wheel (before the spin). */
export function needsConfirmation(draw: Draw): boolean {
  if (draw.result) return false;
  const next = readyNames(entriesOf(draw));
  return next.length !== draw.names.length || next.some((n, i) => n !== draw.names[i]);
}

/** Saves the ready entries as the confirmed list. A spun draw keeps the list it used. */
export function confirmList(draw: Draw): Draw {
  if (draw.result) return draw;
  return { ...draw, names: readyNames(entriesOf(draw)) };
}

/** An entry (other than `exceptIds`) whose display name is the same once accents and case are ignored. */
export function sameNameEntry(entries: Entry[], name: string, exceptIds: string[] = []): Entry | undefined {
  const key = normalizeForCompare(name);
  return entries.find((e) => !exceptIds.includes(e.id) && normalizeForCompare(e.name) === key);
}

export function manualEntry(name: string, now: number, reason?: PendingReason): Entry {
  const e: Entry = { id: newId(), name: cleanName(name), source: "manual", status: "ready", addedAt: now };
  if (reason) {
    e.status = "pending";
    e.reason = reason;
  }
  return e;
}

export function renameEntry(entries: Entry[], id: string, name: string): Entry[] {
  return entries.map((e) => (e.id === id ? { ...e, name: cleanName(name) } : e));
}

export function removeEntry(entries: Entry[], id: string): Entry[] {
  return entries.filter((e) => e.id !== id);
}

/** "Confirmar acerto": the entry joins the ready list, optionally with a new display name. */
export function confirmEntry(entries: Entry[], id: string, name?: string): Entry[] {
  return entries.map((e) => {
    if (e.id !== id) return e;
    const { reason: _done, ...rest } = e;
    return { ...rest, status: "ready", ...(name ? { name: cleanName(name) } : {}) };
  });
}

/** "É a mesma pessoa": one spot stays; the bot ids move over so repeats are still recognized. */
export function mergeEntry(entries: Entry[], pendingId: string, intoId: string): Entry[] {
  const from = entries.find((e) => e.id === pendingId);
  if (!from || pendingId === intoId) return entries;
  return entries
    .filter((e) => e.id !== pendingId)
    .map((e) => {
      if (e.id !== intoId) return e;
      const ids = [...(e.senderIds ?? []), ...(from.senderIds ?? [])];
      return ids.length > 0 ? { ...e, senderIds: Array.from(new Set(ids)) } : e;
    });
}

function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j] ?? 0;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(up + 1, (prev[j - 1] ?? 0) + 1, diag + cost);
      diag = up;
    }
  }
  return prev[b.length] ?? 0;
}

/** Same name, one name inside the other ("Maria Silva" / "Maria A. Silva"), or a small typo. */
export function similarNames(a: string, b: string): boolean {
  const x = normalizeForCompare(a).replace(/[.]/g, "");
  const y = normalizeForCompare(b).replace(/[.]/g, "");
  if (!x || !y) return false;
  if (x === y) return true;
  const tx = x.split(" ");
  const ty = y.split(" ");
  const [short, long] = tx.length <= ty.length ? [tx, ty] : [ty, tx];
  if (short.every((t) => long.includes(t))) return true;
  const limit = Math.min(x.length, y.length) >= 8 ? 2 : 1;
  return editDistance(x, y) <= limit;
}

/** "HH:MM" in 24h, or null. */
export function cleanTime(value: string): string | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** Current time in Jacarezinho as "HH:MM". */
export function jacarezinhoTime(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: BOT_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const h = parts.find((p) => p.type === "hour")?.value ?? "00";
  const m = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${h}:${m}`;
}

/** The bot only takes messages that arrive before the close time; 19:30 itself is already late. */
export function botWindowOpen(time: string): boolean {
  return time < BOT_CLOSE_TIME;
}

export type BotInput = { name: string; senderId: string; time: string; situation: BotSituation };

/**
 * A simulated bot message for one draw. Never touches a spun draw.
 * - same sender already in the list: "repetida", no new spot;
 * - at or after the close time: "fora-do-prazo", stays out of the list;
 * - name similar to someone in the list: waits for review;
 * - "A conferir": waits for review; otherwise joins the ready list.
 */
export function receiveBotMessage(
  draw: Draw,
  input: BotInput,
  now: number,
): { draw: Draw; outcome: BotOutcome; match?: Entry } {
  const name = cleanName(input.name);
  const senderId = cleanName(input.senderId);
  const time = cleanTime(input.time) ?? input.time;
  const entries = entriesOf(draw);
  if (draw.result) return { draw, outcome: "fora-do-prazo" };

  let outcome: BotOutcome;
  let match: Entry | undefined;
  let next = entries;
  const repeated = entries.find((e) => e.senderIds?.includes(senderId));
  if (repeated) {
    outcome = "repetida";
    match = repeated;
  } else if (!botWindowOpen(time)) {
    outcome = "fora-do-prazo";
  } else {
    match = entries.find((e) => similarNames(e.name, name));
    const entry: Entry = {
      id: newId(),
      name,
      source: "bot",
      status: "ready",
      senderIds: [senderId],
      botTime: time,
      botSituation: input.situation,
      addedAt: now,
    };
    if (match) {
      entry.status = "pending";
      entry.reason = { kind: "parecido", withId: match.id };
    } else if (input.situation === "conferir") {
      entry.status = "pending";
      entry.reason = { kind: "conferir" };
    }
    outcome = entry.status === "ready" ? "entrou" : "revisao";
    next = [...entries, entry];
  }
  const log: BotMessage = { id: newId(), name, senderId, time, situation: input.situation, outcome, at: now };
  return {
    draw: { ...draw, entries: next, botMessages: [...(draw.botMessages ?? []), log] },
    outcome,
    ...(match ? { match } : {}),
  };
}

/** Plain-language reason shown in "Revisar pendências". */
export function pendingReasonText(entry: Entry, entries: Entry[]): string {
  const other = reasonMatch(entry, entries);
  const otherLabel = other ? `“${other.name}”${positionLabel(other, entries)}` : "outra pessoa da lista";
  const botNote = entry.botSituation === "conferir" ? " O bot também marcou “A conferir”." : "";
  switch (entry.reason?.kind) {
    case "repetido":
      return `Já tem ${otherLabel} na lista. Confira se é a mesma pessoa.`;
    case "parecido":
      return `O nome é parecido com ${otherLabel}. Pode ser a mesma pessoa.${botNote}`;
    case "conferir":
      return "O bot marcou “A conferir”. Veja se o palpite está certo.";
    default:
      return "Falta conferir.";
  }
}

/** " (nº 3)" for a ready entry, " (também pendente)" otherwise. */
export function positionLabel(entry: Entry, entries: Entry[]): string {
  const pos = readyEntries(entries).findIndex((e) => e.id === entry.id);
  return pos >= 0 ? ` (nº ${pos + 1})` : " (também pendente)";
}

/** The entry a pending one was compared with, if it is still in the list. */
export function reasonMatch(entry: Entry, entries: Entry[]): Entry | undefined {
  const r = entry.reason;
  if (!r || r.kind === "conferir") return undefined;
  return entries.find((e) => e.id === r.withId);
}

/** "Mandar lista no grupo": built only from the confirmed list, the same one the wheel uses. */
export function listMessage(draw: Draw, merchantName: string, groupName: string): string {
  const n = draw.names.length;
  return [
    "📋 Lista do Enigma Premiado",
    groupName,
    `📅 ${formatDateBR(draw.date)}`,
    `🎁 Cortesia: ${draw.prize}`,
    `🤝 Oferecimento: ${merchantName}`,
    "",
    `✅ ${n} ${n === 1 ? "pessoa confirmada" : "pessoas confirmadas"} na roleta:`,
    ...draw.names.map((name, i) => `${i + 1}. ${name}`),
  ].join("\n");
}

export const BOT_OUTCOME_LABEL: Record<BotOutcome, string> = {
  entrou: "Entrou na lista",
  revisao: "Foi para Revisar pendências",
  repetida: "Mensagem repetida: nenhuma vaga nova",
  "fora-do-prazo": `Chegou às ${BOT_CLOSE_TIME} ou depois: ficou fora da lista`,
};
