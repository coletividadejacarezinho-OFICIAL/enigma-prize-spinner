/**
 * E08 pure round rules: the weekly window in Jacarezinho, each round's stage and next
 * step, rounds made from a template, and courtesy delivery. No browser APIs.
 */
import { needsConfirmation, entriesOf, pendingEntries, readyEntries } from "./entries";
import { newId } from "./logic";
import { allRoundsDone, roundIdOf, roundsOf } from "./rounds";
import { BOT_TIME_ZONE, MIN_NAMES_TO_SPIN, type Draw, type Merchant } from "./types";

export { windowState, type WindowState } from "./entries";
import type { WindowState } from "./entries";

export const WINDOW_TEXT: Record<WindowState, string> = {
  antes: "Ainda não abriu. Recebe palpites das 19h00 às 19h29.",
  aberta: "Aberto agora: recebendo palpites até 19h29.",
  encerrada: "Encerrado hoje às 19h30. Ainda dá para conferir e lançar nomes à mão.",
  "fora-do-dia": "Hoje não tem Enigma. Funciona de segunda a sexta, das 19h às 19h30.",
};

export const SCHEDULE_TEXT = "Segunda a sexta, das 19h às 19h30 (horário de Jacarezinho)";

/** Day and "HH:MM" in Jacarezinho. */
export function jacarezinhoNow(now: Date = new Date()): { day: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { day: `${v("year")}-${v("month")}-${v("day")}`, time: `${v("hour")}:${v("minute")}` };
}

export type Stage =
  "rascunho" | "nomes" | "conferir" | "confirmar" | "girar" | "entrega" | "entregue";

export const STAGE_LABEL: Record<Stage, string> = {
  rascunho: "Rascunho",
  nomes: "Esperando nomes",
  conferir: "Conferir acertos",
  confirmar: "Pronta para conferir",
  girar: "Pronta para girar",
  entrega: "Entrega pendente",
  entregue: "Tudo entregue",
};

/** Where the round is and the one next step, in plain words. */
export function roundStage(draw: Draw): { stage: Stage; next: string } {
  if (draw.draft)
    return { stage: "rascunho", next: "Termine o rascunho e toque em Lançar rodada." };
  if (draw.result) {
    if (!allRoundsDone(draw))
      return { stage: "girar", next: "Sorteie a próxima cortesia na Roleta." };
    const total = roundsOf(draw, []).length;
    const done = draw.deliveries?.length ?? 0;
    return done >= total
      ? { stage: "entregue", next: "Rodada concluída. Todas as cortesias foram entregues." }
      : {
          stage: "entrega",
          next: `Marque a entrega quando o ganhador retirar (${done} de ${total} entregues).`,
        };
  }
  const entries = entriesOf(draw);
  if (pendingEntries(entries).length > 0)
    return { stage: "conferir", next: "Confira os acertos que estão esperando em Nomes." };
  if (readyEntries(entries).length < MIN_NAMES_TO_SPIN)
    return {
      stage: "nomes",
      next: `Lance os nomes de quem acertou (mínimo ${MIN_NAMES_TO_SPIN}).`,
    };
  if (needsConfirmation(draw))
    return { stage: "confirmar", next: "Lista pronta: confira e confirme para girar." };
  return { stage: "girar", next: "Lista confirmada. Pode girar a roleta." };
}

/**
 * "Usar como modelo": a new round with the same courtesies and shops. Never copies
 * names, winners, recordings, deliveries, the riddle or the shop's confirmation.
 */
export function fromTemplate(src: Draw, date: string, now: number): Draw {
  return {
    id: newId(),
    date,
    ...(src.merchantId ? { merchantId: src.merchantId } : {}),
    merchant: src.merchant,
    ...(src.merchantLogo ? { merchantLogo: src.merchantLogo } : {}),
    prize: src.prize,
    confirmed: false,
    names: [],
    entries: [],
    ...(src.extraPrizes?.length
      ? {
          extraPrizes: src.extraPrizes.map((p) => ({
            id: newId(),
            ...(p.merchantId ? { merchantId: p.merchantId } : {}),
            merchant: p.merchant,
            ...(p.merchantLogo ? { merchantLogo: p.merchantLogo } : {}),
            prize: p.prize,
          })),
        }
      : {}),
    ...(src.repeatWinners !== undefined && src.extraPrizes?.length
      ? { repeatWinners: src.repeatWinners }
      : {}),
    draft: true,
    templateOf: src.id,
    createdAt: now,
  };
}

export type DeliveryRow = {
  roundId: string;
  index: number;
  prize: string;
  merchant: string;
  winner?: string;
  deliveredAt?: number;
};

export function deliveryRows(draw: Draw, merchants: Merchant[]): DeliveryRow[] {
  return roundsOf(draw, merchants).map((r) => {
    const roundId = roundIdOf(draw, r.index) ?? "";
    const d = draw.deliveries?.find((x) => x.roundId === roundId);
    return {
      roundId,
      index: r.index,
      prize: r.prize,
      merchant: r.merchantName,
      ...(r.result ? { winner: r.result.winner } : {}),
      ...(d ? { deliveredAt: d.at } : {}),
    };
  });
}

/** Only a courtesy with a saved winner can be delivered; once marked it keeps its first time. */
export function markDelivered(draw: Draw, roundId: string, at: number): Draw {
  const row = deliveryRows(draw, []).find((r) => r.roundId === roundId);
  if (!row?.winner || row.deliveredAt !== undefined) return draw;
  return { ...draw, deliveries: [...(draw.deliveries ?? []), { roundId, at }] };
}
