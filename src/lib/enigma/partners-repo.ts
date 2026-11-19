/** Partner operations exchange serializable records; storage is behind the adapter. */
import { stableJson } from "./restore";
import { useSyncExternalStore } from "react";
import { repo, type RepoResult } from "./repo";
import { placementOf, type Account, type Invite, type Offer, type PartnerSim, type WinnerNotice } from "./partners";
import { roundsOf, roundIdOf } from "./rounds";
import {
  partnerSnapshot, reloadPartners, subscribePartners, tryUpdatePartners, type PartnerSnapshot,
} from "./partners-store";
import type { AppState } from "./types";

export interface PartnerAdapter {
  kind: "local" | "memory";
  getSnapshot(): PartnerSnapshot;
  subscribe(cb: () => void): () => void;
  reload(): void;
  update(fn: (s: PartnerSim) => PartnerSim): "ok" | "read" | "write" | "restore";
}

export type OfferConfirmation = { offerId: string; drawId: string; roundId: string; at: number };

export interface PartnersRepo {
  readonly kind: "local" | "memory" | "remote";
  getSnapshot(): PartnerSnapshot | null;
  subscribe(cb: () => void): () => void;
  reload(): void;
  createInvite(invite: Invite): Promise<RepoResult>;
  signIn(account: Account): Promise<RepoResult>;
  saveProfile(accountId: string, profile: Pick<Account, "name" | "whatsapp" | "logo">): Promise<RepoResult>;
  attachShop(input: { offerId?: string; accountId?: string; merchantId: string }): Promise<RepoResult>;
  submitOffer(offer: Offer): Promise<RepoResult>;
  confirmOffers(offers: OfferConfirmation[]): Promise<RepoResult>;
  saveNotice(notice: WinnerNotice): Promise<RepoResult>;
}

class PartnerConflict extends Error {}
const fail = (error: "read" | "write" | "restore" | "conflict"): RepoResult => ({
  ok: false, error,
  message: {
    read: "Não foi possível ler os dados dos parceiros. Reabra o aplicativo para conferir.",
    write: "Não foi possível salvar os parceiros. Libere espaço e tente novamente.",
    restore: "Conclua a recuperação da cópia antes de salvar novos dados.",
    conflict: "Os dados da oferta ou da rodada mudaram. Confira antes de confirmar.",
  }[error],
});
const equal = (a: unknown, b: unknown) => stableJson(a) === stableJson(b);

function insert<T extends { id: string }>(records: T[], value: T): T[] {
  const existing = records.find((r) => r.id === value.id);
  if (existing && !equal(existing, value)) throw new PartnerConflict();
  return existing ? records : [...records, value];
}

/** The same command rules can run against localStorage or an isolated memory adapter. */
export function createPartnersRepo(adapter: PartnerAdapter, readApp: () => AppState | null): PartnersRepo {
  const run = async (fn: (s: PartnerSim) => PartnerSim): Promise<RepoResult> => {
    try {
      const result = adapter.update(fn);
      return result === "ok" ? { ok: true, value: undefined } : fail(result);
    } catch (error) {
      if (error instanceof PartnerConflict) return fail("conflict");
      return fail("read");
    }
  };
  const app = () => {
    const state = readApp();
    if (!state) throw new PartnerConflict();
    return state;
  };

  return {
    kind: adapter.kind,
    getSnapshot: adapter.getSnapshot,
    subscribe: adapter.subscribe,
    reload: adapter.reload,
    createInvite: (invite) => run((s) => {
      if (invite.merchantId && !app().merchants.some((m) => m.id === invite.merchantId))
        throw new PartnerConflict();
      const { session: _session, ...rest } = s;
      return { ...rest, invites: insert(s.invites, invite) };
    }),
    signIn: (account) => run((s) => {
      const existing = s.accounts.find((a) => a.id === account.id);
      if (existing && existing.email !== account.email) throw new PartnerConflict();
      return { ...s, accounts: existing ? s.accounts : insert(s.accounts, account), session: account.id };
    }),
    saveProfile: (accountId, profile) => run((s) => {
      if (!s.accounts.some((a) => a.id === accountId)) throw new PartnerConflict();
      return { ...s, accounts: s.accounts.map((a) => a.id === accountId ? { ...a, ...profile } : a) };
    }),
    attachShop: (input) => run((s) => {
      if (!app().merchants.some((m) => m.id === input.merchantId)) throw new PartnerConflict();
      const offer = input.offerId ? s.offers.find((o) => o.id === input.offerId) : undefined;
      const accountId = input.accountId ?? offer?.accountId;
      if (offer?.confirmed && offer.merchantId !== input.merchantId) throw new PartnerConflict();
      if (offer && input.accountId && input.accountId !== offer.accountId) throw new PartnerConflict();
      if ((input.offerId && !offer) || !accountId || !s.accounts.some((a) => a.id === accountId))
        throw new PartnerConflict();
      return {
        ...s,
        offers: s.offers.map((o) => o.id === input.offerId ? { ...o, merchantId: input.merchantId } : o),
        accounts: s.accounts.map((a) => a.id === accountId ? { ...a, merchantId: input.merchantId } : a),
      };
    }),
    submitOffer: (offer) => run((s) => {
      const account = s.accounts.find((a) => a.id === offer.accountId);
      if (!account || !offer.prize.trim() || offer.confirmed ||
          (offer.merchantId && !app().merchants.some((m) => m.id === offer.merchantId)))
        throw new PartnerConflict();
      return { ...s, offers: insert(s.offers, offer) };
    }),
    confirmOffers: (confirmations) => run((s) => {
      const state = app();
      const next = s.offers.map((offer) => {
        const confirmation = confirmations.find((c) => c.offerId === offer.id);
        if (!confirmation) return offer;
        let found: ReturnType<typeof placementOf>;
        try { found = placementOf(state.draws, offer); }
        catch { throw new PartnerConflict(); }
        if (!found || found.drawId !== confirmation.drawId || found.roundId !== confirmation.roundId)
          throw new PartnerConflict();
        if (offer.confirmed) {
          if (offer.confirmed.drawId !== found.drawId || offer.confirmed.roundId !== found.roundId)
            throw new PartnerConflict();
          return offer;
        }
        return {
          ...offer,
          confirmed: {
            ...found, at: confirmation.at,
            linked: !!state.draws.find((d) => d.id === found.drawId)?.offerLinks?.[offer.id],
          },
        };
      });
      if (confirmations.some((c) => !s.offers.some((o) => o.id === c.offerId)))
        throw new PartnerConflict();
      return { ...s, offers: next };
    }),
    saveNotice: (notice) => run((s) => {
      const state = app();
      const draw = state.draws.find((d) => d.id === notice.drawId);
      const round = draw && roundsOf(draw, state.merchants).find((r) => roundIdOf(draw, r.index) === notice.roundId);
      if (!round?.result || draw?.isSample || round.merchantId !== notice.merchantId ||
          round.result.winner !== notice.winner) throw new PartnerConflict();
      const previous = s.notices.find((n) => n.roundId === notice.roundId && n.drawId === notice.drawId);
      return previous ? s : { ...s, notices: insert(s.notices, notice) };
    }),
  };
}

export const localPartnersRepo = createPartnersRepo({
  kind: "local", getSnapshot: partnerSnapshot, subscribe: subscribePartners,
  reload: reloadPartners, update: tryUpdatePartners,
}, () => {
  const snapshot = repo.getSnapshot();
  return snapshot?.kind === "ok" ? snapshot.state : null;
});

export let partnersRepo: PartnersRepo = localPartnersRepo;
export function setPartnersRepo(next: PartnersRepo) { partnersRepo = next; }

export function usePartnerSnapshot(): PartnerSnapshot | null {
  return useSyncExternalStore(
    (cb) => partnersRepo.subscribe(cb),
    () => partnersRepo.getSnapshot(),
    () => null,
  );
}

export function usePartners(): PartnerSim | null {
  const snapshot = usePartnerSnapshot();
  return snapshot?.kind === "ok" ? snapshot.state : null;
}
