/**
 * Several courtesies in one draw (stage 8): each round gives one courtesy to one
 * winner from the same confirmed list, in order. Pure functions only.
 */
import { formatDateBR, merchantOf, resultMessage } from "./logic";
import { MIN_NAMES_TO_SPIN } from "./types";
import type { Draw, DrawResult, Merchant, Prize } from "./types";

export type Round = {
  index: number;
  merchantId?: string;
  merchantName: string;
  merchantLogo: string | undefined;
  prize: string;
  result?: DrawResult;
};

/** Every courtesy of a draw, the first one coming from the draw's own fields. */
export function roundsOf(draw: Draw, merchants: Merchant[]): Round[] {
  const first = merchantOf(merchants, draw);
  const rounds: Round[] = [
    {
      index: 0,
      ...(draw.merchantId ? { merchantId: draw.merchantId } : {}),
      merchantName: first.name,
      merchantLogo: first.logo,
      prize: draw.prize,
      ...(draw.result ? { result: draw.result } : {}),
    },
  ];
  (draw.extraPrizes ?? []).forEach((p, i) => {
    const m = p.merchantId ? merchants.find((x) => x.id === p.merchantId) : undefined;
    rounds.push({
      index: i + 1,
      ...(p.merchantId ? { merchantId: p.merchantId } : {}),
      merchantName: m?.name ?? p.merchant,
      merchantLogo: m ? m.logo : p.merchantLogo,
      prize: p.prize,
      ...(p.result ? { result: p.result } : {}),
    });
  });
  return rounds;
}

export function roundCount(draw: Draw): number {
  return 1 + (draw.extraPrizes?.length ?? 0);
}

export function roundResult(draw: Draw, index: number): DrawResult | undefined {
  return index === 0 ? draw.result : draw.extraPrizes?.[index - 1]?.result;
}

/** Saves one round's result; a round that already has a winner never changes. */
export function withRoundResult(draw: Draw, index: number, result: DrawResult): Draw {
  if (roundResult(draw, index)) return draw;
  if (index === 0) return { ...draw, result };
  const extra = draw.extraPrizes ?? [];
  if (!extra[index - 1]) return draw;
  return { ...draw, extraPrizes: extra.map((p, i) => (i === index - 1 ? { ...p, result } : p)) };
}

/** The round on the Roleta: the saved one, clamped to the draw's courtesies. */
export function shownRound(draw: Draw): number {
  return Math.max(0, Math.min(draw.shownRound ?? 0, roundCount(draw) - 1));
}

/** Rounds are spun in order, so the next one needs every earlier round decided. */
export function canShowRound(draw: Draw, index: number): boolean {
  if (index < 0 || index >= roundCount(draw)) return false;
  for (let i = 0; i < index; i++) if (!roundResult(draw, i)) return false;
  return true;
}

/** "Sortear próxima cortesia". */
export function nextRound(draw: Draw): Draw {
  const next = shownRound(draw) + 1;
  return canShowRound(draw, next) ? { ...draw, shownRound: next } : draw;
}

export function allRoundsDone(draw: Draw): boolean {
  for (let i = 0; i < roundCount(draw); i++) if (!roundResult(draw, i)) return false;
  return true;
}

/** Before the first spin of a draw with 2 or more courtesies, the repeat question must be answered. */
export function needsRepeatAnswer(draw: Draw): boolean {
  return roundCount(draw) > 1 && draw.repeatWinners === undefined && !draw.result;
}

/**
 * Names on the wheel for one round: the confirmed list, minus the winners of
 * earlier rounds when "Quem ganhar pode ganhar de novo?" was answered "Não".
 * One spot is removed per earlier win, so a different person with the same name stays.
 */
export function poolFor(draw: Draw, index: number): string[] {
  if (draw.repeatWinners !== false) return [...draw.names];
  const pool = [...draw.names];
  for (let i = 0; i < index; i++) {
    const r = roundResult(draw, i);
    if (!r) continue;
    // Earlier winners leave by their entry ID; older results only have the (unique) name.
    const name = (r.entryId && draw.entries?.find((e) => e.id === r.entryId)?.name) || r.winner;
    const at = pool.indexOf(name);
    if (at >= 0) pool.splice(at, 1);
  }
  return pool;
}

/** "Prêmio 1 de 2 — Lanche do Burger 7" (only for draws with several courtesies). */
export function roundLabel(index: number, total: number, prize: string): string {
  return `Prêmio ${index + 1} de ${total} — ${prize}`;
}

export type PrizeInput = { id?: string; merchant: Merchant; prize: string };

/** Puts the form's courtesies on a draw, keeping results of courtesies that stay (by id). */
export function applyPrizes(draw: Draw, prizes: PrizeInput[], newId: () => string): Draw {
  const [first, ...rest] = prizes;
  if (!first) return draw;
  const old = new Map((draw.extraPrizes ?? []).map((p) => [p.id, p]));
  const extraPrizes: Prize[] = rest.map((p) => {
    const kept = p.id ? old.get(p.id) : undefined;
    const next: Prize = {
      id: kept?.id ?? newId(),
      merchantId: p.merchant.id,
      merchant: p.merchant.name,
      prize: p.prize.trim(),
    };
    if (kept?.result) next.result = kept.result;
    return next;
  });
  const { extraPrizes: _old, ...base } = draw;
  return {
    ...base,
    merchantId: first.merchant.id,
    merchant: first.merchant.name,
    prize: first.prize.trim(),
    ...(extraPrizes.length > 0 ? { extraPrizes } : {}),
  };
}

/**
 * WhatsApp result for a whole draw. One courtesy keeps the stage 4 message;
 * several courtesies list each prize, shop and winner, and wait until every round is done.
 */
export function drawResultMessage(
  draw: Draw,
  merchants: Merchant[],
  groupName: string,
): string | null {
  const rounds = roundsOf(draw, merchants);
  if (rounds.length === 1)
    return resultMessage(draw, rounds[0]?.merchantName ?? draw.merchant, groupName);
  if (!allRoundsDone(draw)) return null;
  const lines = ["🏆 Resultado do Enigma Premiado", groupName, `📅 ${formatDateBR(draw.date)}`];
  for (const r of rounds) {
    lines.push(
      "",
      `🎁 Prêmio ${r.index + 1}: ${r.prize}`,
      `🤝 Oferecimento: ${r.merchantName}`,
      `🎉 Ganhador(a): ${r.result?.winner ?? ""}`,
    );
  }
  lines.push(
    "",
    "Parabéns! Chame a administração no privado para combinar a retirada.",
    "Reaja com 👍 aqui no grupo!",
  );
  return lines.join("\n");
}

export type SpinPlan = {
  drawId: string;
  round: number;
  pool: string[];
  repeatWinners?: boolean | undefined;
};

/**
 * Saves one round's result only if the draw, round and wheel names are still what the screen showed.
 * "already": the round has a saved result, which is kept. "changed": nothing is saved.
 * An answer to "Quem ganhar pode ganhar de novo?" is saved together with the first result.
 */
export function commitSpin(
  draw: Draw,
  plan: SpinPlan,
  result: DrawResult,
): { draw: Draw; status: "saved" | "already" | "changed" } {
  if (draw.draft || draw.id !== plan.drawId || shownRound(draw) !== plan.round)
    return { draw, status: "changed" };
  if (roundResult(draw, plan.round)) return { draw, status: "already" };
  const base =
    plan.repeatWinners === undefined ? draw : { ...draw, repeatWinners: plan.repeatWinners };
  if (needsRepeatAnswer(base) || !canShowRound(base, plan.round))
    return { draw, status: "changed" };
  const pool = poolFor(base, plan.round);
  if (
    pool.length < minimumNamesForRound(plan.round) ||
    !Number.isInteger(result.index) || !Number.isFinite(result.rotation) || !Number.isFinite(result.at) ||
    pool.length !== plan.pool.length ||
    pool.some((n, i) => n !== plan.pool[i]) ||
    pool[result.index] !== result.winner
  ) {
    return { draw, status: "changed" };
  }
  return { draw: withRoundResult(base, plan.round, result), status: "saved" };
}

/** Stable id of each courtesy: the draw id for the first, the prize id for the rest. */
export function roundIdOf(draw: Draw, index: number): string | undefined {
  if (index === 0) return draw.id;
  return draw.extraPrizes?.[index - 1]?.id;
}

export function roundIndexOf(draw: Draw, roundId: string): number {
  if (roundId === draw.id) return 0;
  const i = (draw.extraPrizes ?? []).findIndex((p) => p.id === roundId);
  return i < 0 ? -1 : i + 1;
}


/** Later courtesies may have one eligible name after earlier winners leave. */
export function minimumNamesForRound(index: number): number {
  return index === 0 ? MIN_NAMES_TO_SPIN : 1;
}
