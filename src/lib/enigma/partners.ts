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
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  return d.length === 10 || d.length === 11 ? d : null;
}
export function formatWhatsapp(d: string): string {
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
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
