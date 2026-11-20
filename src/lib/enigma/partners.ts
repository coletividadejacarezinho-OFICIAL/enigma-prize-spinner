/**
 * P1 (ensaio): partner shops invited into the app. Simulation only — no real login,
 * no messages leave the phone. Pure rules here; the simulated data lives in partners-store.ts.
 */
import { normalizeForCompare } from "./logic";
import { roundIdOf, roundsOf } from "./rounds";
import type { Draw, Merchant } from "./types";

export type Invite = { id: string; kind: "geral" | "individual"; merchantId?: string; createdAt: number };
/** Simulated "Entrar com Google" account of a shop owner. */
export type Account = {
  id: string;
  email: string;
  merchantId?: string;
  /** Profile typed before a shop record exists (general invite). */
  name?: string;
  whatsapp?: string;
  logo?: string;
};
export type Offer = {
  id: string;
  accountId: string;
  merchantId?: string;
  name: string;
  whatsapp: string;
  logo?: string;
  prize: string;
  createdAt: number;
  confirmed?: { drawId: string; roundId: string; at: number; linked: boolean };
};
/** Winner sent to the shop (simulated): name + a fictitious phone. */
export type WinnerNotice = {
  id: string;
  merchantId: string;
  drawId: string;
  roundId: string;
  winner: string;
  phone: string;
  sentAt: number;
};
export type PartnerSim = {
  invites: Invite[];
  accounts: Account[];
  session?: string;
  offers: Offer[];
  notices: WinnerNotice[];
};

export const emptySim = (): PartnerSim => ({ invites: [], accounts: [], offers: [], notices: [] });

export function digits(s: string): string {
  return s.replace(/\D/g, "");
}
/** Brazilian WhatsApp with DDD: 10 or 11 digits (an optional leading 55 is ignored). */
export function cleanWhatsapp(s: string): string | null {
  let d = digits(s);
  const text = s.trimStart();
  if (text.startsWith("+")) {
    if (!d.startsWith("55")) return null;
    d = d.slice(2);
  } else if (!text.startsWith("(") && d.length >= 12 && d.startsWith("55")) {
    d = d.slice(2);
  }
  return d.length === 10 || d.length === 11 ? d : null;
}
export function formatWhatsapp(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

/** Keep partial digits editable and leave excessive or unsupported numbers visible for correction. */
export function maskWhatsapp(value: string): string {
  const text = value.trimStart();
  const all = digits(text);
  const explicit = text.startsWith("+");
  if (explicit && !all.startsWith("55")) return `+${all}`;
  const country = explicit || (!text.startsWith("(") && all.length >= 12 && all.startsWith("55"));
  const local = country ? all.slice(2) : all;
  const prefix = country ? "+55" : "";
  if (!local) return prefix;
  if (local.length <= 2) return `${prefix ? prefix + " " : ""}(${local}`;
  const body = local.slice(2);
  const split = body.length >= 9 ? 5 : 4;
  const number = body.length > split ? body.slice(0, split) + "-" + body.slice(split) : body;
  return `${prefix ? prefix + " " : ""}(${local.slice(0, 2)}) ${number}`;
}

/** A shop already registered with the same name or the same WhatsApp ("Conferir cadastro"). */
export function findExisting(merchants: Merchant[], name: string, whatsapp: string): Merchant | undefined {
  const n = normalizeForCompare(name);
  const w = cleanWhatsapp(whatsapp);
  return merchants.find(
    (m) => (n && normalizeForCompare(m.name) === n) || (w && m.whatsapp && m.whatsapp === w),
  );
}

/** "Burguer 7 ofereceu um hambúrguer com batata". */
export function offerText(o: Pick<Offer, "name" | "prize">): string {
  const prize = o.prize.trim().replace(/[.!]+$/, "");
  return `${o.name} ofereceu ${prize.charAt(0).toLowerCase()}${prize.slice(1)}`;
}

/** Rounds an offer can go to: not a rehearsal and the list not locked by a spin yet. */
export function openDraws(draws: Draw[]): Draw[] {
  return draws.filter((d) => !d.isSample && !d.result);
}

/** Courtesies of this shop already in the draw, so the offer can be linked instead of duplicated. */
export function sameShopRounds(draw: Draw, merchants: Merchant[], merchantId: string) {
  return roundsOf(draw, merchants)
    .filter((r) => r.merchantId === merchantId && !r.result)
    .map((r) => ({ roundId: roundIdOf(draw, r.index)!, prize: r.prize }));
}

/** Adds the offer as a new courtesy at the end of the round (never touches earlier ones). */
export function addOfferCourtesy(draw: Draw, merchant: Merchant, prize: string, id: string): Draw {
  if (draw.result) return draw;
  return {
    ...draw,
    extraPrizes: [
      ...(draw.extraPrizes ?? []),
      { id, merchantId: merchant.id, merchant: merchant.name, prize: prize.trim() },
    ],
    // A second courtesy needs the "ganhar de novo" answer; default keeps winners distinct.
    repeatWinners: draw.repeatWinners ?? false,
  };
}

/** Fictitious phone for the rehearsal, stable for a given winner name. */
export function fakePhone(seed: string): string {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const n = String(10000000 + (h % 89999999)).slice(0, 8);
  return `43 9${n.slice(0, 4)}-${n.slice(4)}`;
}

// ---- Several offers at once (P1 fix). IDs come from the offer, so a double tap or a
// retry after a partial failure finds what was already saved instead of duplicating it.

export const offerDrawId = (o: Pick<Offer, "id">) => `rd-${o.id}`;
export const offerRoundId = (o: Pick<Offer, "id">) => `of-${o.id}`;
export const offerMerchantId = (o: Pick<Offer, "id">) => `mc-${o.id}`;

/** Where an offer already sits in the saved draws (round id = draw id for the first prize). */
export function placementOf(
  draws: Draw[],
  o: Pick<Offer, "id"> & Partial<Pick<Offer, "merchantId">>,
): { drawId: string; roundId: string } | undefined {
  for (const d of draws) {
    const linked = d.offerLinks?.[o.id];
    const roundId = linked ?? (d.id === offerDrawId(o)
      ? d.id
      : d.extraPrizes?.find((p) => p.id === offerRoundId(o))?.id);
    if (!roundId) continue;
    const merchantId = roundId === d.id
      ? d.merchantId
      : d.extraPrizes?.find((p) => p.id === roundId)?.merchantId;
    if (!merchantId || (o.merchantId && merchantId !== o.merchantId))
      throw new Error("O comércio do prêmio foi alterado. Confira o vínculo antes de confirmar a oferta.");
    return { drawId: d.id, roundId };
  }
  return undefined;
}

/** Pending = no link saved yet; only these are shown in "Ofertas recebidas". */
export const pendingOffers = (sim: PartnerSim) => sim.offers.filter((o) => !o.confirmed);

/** One draft with every selected offer, in the order given: first offer = prize 1. */
export function draftFromOffers(
  offers: Offer[],
  merchants: Merchant[],
  date: string,
  now: number,
): Draw | null {
  const shops = offers.map((o) => merchants.find((m) => m.id === o.merchantId));
  const [first, ...rest] = offers;
  if (!first || shops.some((m) => !m)) return null;
  const m0 = shops[0]!;
  return {
    id: offerDrawId(first),
    date,
    merchantId: m0.id,
    merchant: m0.name,
    prize: first.prize.trim(),
    confirmed: true,
    names: [],
    entries: [],
    draft: true,
    ...(rest.length
      ? {
          extraPrizes: rest.map((o, i) => ({
            id: offerRoundId(o),
            merchantId: shops[i + 1]!.id,
            merchant: shops[i + 1]!.name,
            prize: o.prize.trim(),
          })),
          repeatWinners: false,
        }
      : {}),
    createdAt: now,
  };
}

/**
 * Adds offers after the prizes already in the round. `links` maps an offer id to an existing
 * prize the admin explicitly picked as "the same one"; those are not added again.
 * Offers already in the draw are skipped, so running it twice changes nothing.
 */
export function appendOffers(
  draw: Draw,
  offers: Offer[],
  merchants: Merchant[],
  links: Record<string, string> = {},
): Draw {
  if (draw.result) throw new Error("Esta rodada já foi sorteada. Escolha outra rodada.");
  let next = draw;
  for (const o of offers) {
    if (placementOf([next], o)) continue;
    const linked = links[o.id];
    if (linked) {
      const round = roundsOf(next, merchants).find((r) => roundIdOf(next, r.index) === linked);
      if (!round || round.result || !o.merchantId || round.merchantId !== o.merchantId)
        throw new Error("O prêmio associado mudou. Confira a rodada.");
      next = { ...next, offerLinks: { ...next.offerLinks, [o.id]: linked } };
      continue;
    }
    const m = merchants.find((x) => x.id === o.merchantId);
    if (!m) throw new Error("Confira o cadastro do comércio antes de adicionar a oferta.");
    next = addOfferCourtesy(next, m, o.prize, offerRoundId(o));
  }
  return next;
}

export type OfferPlan = {
  /** Offers already saved in a round (earlier half-finished try): only their link is completed. */
  recovered: { offer: Offer; drawId: string; roundId: string }[];
  /** Offers not saved anywhere yet. */
  fresh: Offer[];
};

/** Before creating or adding: find, by offer id, which selected offers already sit in a round. */
export function planOffers(draws: Draw[], selected: Offer[]): OfferPlan {
  const plan: OfferPlan = { recovered: [], fresh: [] };
  for (const o of selected) {
    const p = placementOf(draws, o);
    if (p) plan.recovered.push({ offer: o, ...p });
    else plan.fresh.push(o);
  }
  return plan;
}

/** Message for a recovery: says exactly which offers were finished and where; the rest wait. */
export function recoveryMessage(plan: OfferPlan, draws: Draw[], fmtDate: (iso: string) => string): string {
  const parts = plan.recovered.map((r) => {
    const d = draws.find((x) => x.id === r.drawId);
    return `“${r.offer.prize}” (${r.offer.name}) já estava na rodada de ${d ? fmtDate(d.date) : "?"}`;
  });
  const left = plan.fresh.length
    ? ` ${plan.fresh.length === 1 ? "A outra oferta continua pendente" : `As outras ${plan.fresh.length} ofertas continuam pendentes`}: escolha o destino de novo.`
    : "";
  return `Recuperado: ${parts.join("; ")}.${left}`;
}

