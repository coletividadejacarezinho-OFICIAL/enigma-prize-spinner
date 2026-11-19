import { beforeEach, describe, expect, it } from "vitest";
import { createPartnersRepo, type PartnerAdapter } from "@/lib/enigma/partners-repo";
import { partnerSnapshot, reloadPartners, subscribePartners, tryUpdatePartners, SIM_KEY } from "@/lib/enigma/partners-store";
import { emptySim, draftFromOffers, type PartnerSim } from "@/lib/enigma/partners";
import type { AppState } from "@/lib/enigma/types";

describe.each(["local", "memory"] as const)("contrato de parceiros com adaptador %s", (kind) => {
  let adapter: PartnerAdapter;
  let state: AppState;
  let blocked: boolean;

  beforeEach(() => {
    localStorage.clear();
    reloadPartners();
    state = {
      version: 1, merchants: [{ id: "m", name: "Loja", createdAt: 1 }],
      draws: [], currentId: "", sound: false,
    };
    blocked = false;
    let snapshot: { kind: "ok"; state: PartnerSim } = { kind: "ok", state: emptySim() };
    const listeners = new Set<() => void>();
    adapter = kind === "local" ? {
      kind, getSnapshot: partnerSnapshot, reload: reloadPartners, subscribe: subscribePartners,
      update: (fn) => blocked ? "write" : tryUpdatePartners(fn),
    } : {
      kind, getSnapshot: () => snapshot, reload: () => {},
      subscribe: (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
      update: (fn) => {
        if (blocked) return "write";
        snapshot = { kind: "ok", state: JSON.parse(JSON.stringify(fn(snapshot.state))) };
        listeners.forEach((cb) => cb());
        return "ok";
      },
    };
  });

  const offer = { id: "o", accountId: "a", merchantId: "m", name: "Loja", whatsapp: "43999990000", prize: "Pão", createdAt: 1 };
  const account = { id: "a", email: "a@exemplo.com" };

  it("salva convites, conta e perfil, envia oferta e repete sem duplicar", async () => {
    const repo = createPartnersRepo(adapter, () => state);
    expect((await repo.signIn(account)).ok).toBe(true);
    expect((await repo.saveProfile("a", { name: "Loja", whatsapp: offer.whatsapp })).ok).toBe(true);
    expect((await repo.createInvite({ id: "i", kind: "individual", merchantId: "m", createdAt: 1 })).ok).toBe(true);
    expect((await repo.submitOffer(offer)).ok).toBe(true);
    expect((await repo.submitOffer({ ...offer })).ok).toBe(true);
    expect((await repo.attachShop({ offerId: offer.id, merchantId: "m" })).ok).toBe(true);
    expect((await repo.signIn(account)).ok).toBe(true);
    const snapshot = repo.getSnapshot();
    expect(snapshot?.kind === "ok" && snapshot.state.offers.length).toBe(1);
    expect(snapshot?.kind === "ok" && snapshot.state.accounts[0]?.name).toBe("Loja");
  });

  it("recusa falha de escrita e permite tentar novamente", async () => {
    const repo = createPartnersRepo(adapter, () => state);
    blocked = true;
    expect(await repo.signIn(account)).toMatchObject({ ok: false, error: "write" });
    expect(repo.getSnapshot()?.kind === "ok" && (repo.getSnapshot() as { state: PartnerSim }).state.accounts.length).toBe(0);
    blocked = false;
    expect((await repo.signIn(account)).ok).toBe(true);
  });

  it("confirma apenas o prêmio salvo no destino correto e conserva primeira confirmação", async () => {
    const repo = createPartnersRepo(adapter, () => state);
    await repo.signIn(account);
    await repo.submitOffer(offer);
    expect((await repo.confirmOffers([{ offerId: "o", drawId: "inexistente", roundId: "inexistente", at: 1 }])).ok).toBe(false);
    const draft = draftFromOffers([offer], state.merchants, "2026-11-19", 1)!;
    state.draws = [draft];
    const input = { offerId: "o", drawId: draft.id, roundId: draft.id, at: 2 };
    expect((await repo.confirmOffers([input])).ok).toBe(true);
    expect((await repo.confirmOffers([{ ...input, at: 3 }])).ok).toBe(true);
    const snapshot = repo.getSnapshot();
    expect(snapshot?.kind === "ok" && snapshot.state.offers[0]?.confirmed?.at).toBe(2);
    state.draws = [{ ...draft, merchantId: "outro" }];
    expect(await repo.confirmOffers([input])).toMatchObject({ ok: false, error: "conflict" });
  });

  it("recusa oferta sem conta e aviso que não corresponde a um ganhador salvo", async () => {
    const repo = createPartnersRepo(adapter, () => state);
    expect((await repo.submitOffer(offer)).ok).toBe(false);
    expect((await repo.saveNotice({
      id: "n", merchantId: "m", drawId: "x", roundId: "x", winner: "Ana",
      phone: "fictício", sentAt: 1,
    })).ok).toBe(false);
  });
});

it("preserva dados ilegíveis e recusa sobrescrever a chave local", async () => {
  localStorage.clear();
  localStorage.setItem(SIM_KEY, "{quebrado");
  reloadPartners();
  expect(partnerSnapshot().kind).toBe("broken");
  expect(tryUpdatePartners(emptySim)).toBe("read");
  expect(localStorage.getItem(SIM_KEY)).toBe("{quebrado");
});
