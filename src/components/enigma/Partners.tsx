/** P1 (ensaio): admin side of partner shops — invites, received offers, winner sent to the shop. */
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Gift, Send, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { GoldButton, SecondaryButton } from "./GoldButton";
import { MerchantLogo } from "./Logos";
import { fieldClass } from "./fields";
import { report } from "@/lib/enigma/feedback";
import { formatDateBR, newId, todayISO } from "@/lib/enigma/logic";
import {
  appendOffers,
  draftFromOffers,
  fakePhone,
  offerMerchantId,
  placementOf,
  planOffers,
  recoveryMessage,
  findExisting,
  formatWhatsapp,
  offerText,
  openDraws,
  sameShopRounds,
  type Offer,
} from "@/lib/enigma/partners";
import { updateSim, useSim } from "@/lib/enigma/partners-store";
import { repo } from "@/lib/enigma/repo";
import { roundIdOf, roundsOf } from "@/lib/enigma/rounds";
import type { AppState, Draw } from "@/lib/enigma/types";

export const ENSAIO_TAG = "Ensaio: nada é enviado de verdade.";

/** Opens an invite in the merchant's test view. */
export function useOpenInvite() {
  const navigate = useNavigate();
  return (kind: "geral" | "individual", merchantId?: string) => {
    const id = newId();
    const ok = updateSim(({ session: _s, ...s }) => ({
      ...s,
      invites: [...s.invites, { id, kind, ...(merchantId ? { merchantId } : {}), createdAt: Date.now() }],
    }));
    if (!ok) return void toast.error("Não foi possível salvar o ensaio. Libere espaço e tente de novo.");
    navigate({ to: "/parceiros/loja", search: { convite: id } });
  };
}

export function PartnerTools({ state }: { state: AppState }) {
  const sim = useSim();
  const openInvite = useOpenInvite();
  const hasBurguer = state.merchants.some((m) => m.name.toLowerCase() === "burguer 7");
  const pending = (sim?.offers ?? []).filter((o) => !o.confirmed);
  return (
    <>
      <SecondaryButton onClick={() => openInvite("geral")} className="mt-1">
        <UserPlus className="h-5 w-5" aria-hidden="true" /> Convidar comerciante
      </SecondaryButton>
      {!hasBurguer && (
        <button
          onClick={async () => {
            const ok = await repo.saveMerchant({
              id: newId(),
              name: "Burguer 7",
              whatsapp: "43999990007",
              createdAt: Date.now(),
            });
            if (report(ok)) toast.success("Burguer 7 de exemplo cadastrado.");
          }}
          className="mt-1 h-11 w-full text-sm font-bold text-muted-foreground underline"
        >
          Cadastrar o Burguer 7 de exemplo (ensaio)
        </button>
      )}
      <OffersPanel state={state} pending={pending} />
    </>
  );
}

const latest = (): AppState | null => {
  const sn = repo.getSnapshot();
  return sn && sn.kind === "ok" ? sn.state : null;
};

function OffersPanel({ state, pending }: { state: AppState; pending: Offer[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<"criar" | "adicionar" | null>(null);
  const [date, setDate] = useState(todayISO());
  const [drawId, setDrawId] = useState("");
  const [links, setLinks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const created = state.draws.find((d) => d.id === createdId);
  const navigate = useNavigate();
  const sel = picked.map((id) => pending.find((o) => o.id === id)).filter((o): o is Offer => !!o);
  const shopOf = (o: Offer) => state.merchants.find((m) => m.id === o.merchantId);
  const draws = openDraws(state.draws).sort((a, b) => b.date.localeCompare(a.date));
  const target = draws.find((d) => d.id === drawId);

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  /** Records each offer's link, but only for offers whose prize is really saved in a round. */
  const finish = (offers: Offer[]) => {
    const now = latest();
    if (!now) return false;
    const found = offers.map((o) => [o, placementOf(now.draws, o)] as const);
    if (found.some(([, placement]) => !placement)) {
      setError("A oferta ainda não foi salva na rodada. Confira o destino e tente novamente.");
      return false;
    }
    const ok = updateSim((s) => ({
      ...s,
      offers: s.offers.map((x) => {
        const f = found.find(([o]) => o.id === x.id)?.[1];
        return f && !x.confirmed
          ? { ...x, confirmed: { ...f, at: Date.now(), linked: !!now.draws.find((d) => d.id === f.drawId)?.offerLinks?.[x.id] } }
          : x;
      }),
    }));
    if (!ok) toast.error("A rodada foi salva, mas as ofertas não. Toque de novo: nada será duplicado.");
    return ok;
  };

  const run = async (fn: () => Promise<boolean>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      if (await fn()) {
        setPicked([]);
        setMode(null);
        setLinks({});
      }
    } catch {
      setError("Não foi possível concluir. Confira as ofertas e tente novamente.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  /** If any selected offer is already in a round, finish only those and keep the others pending. */
  const recover = (): boolean | null => {
    const now = latest();
    if (!now) return false;
    const plan = planOffers(now.draws, sel);
    if (plan.recovered.length === 0) return null;
    if (!finish(plan.recovered.map((r) => r.offer))) return false;
    toast.success(recoveryMessage(plan, now.draws, formatDateBR));
    setPicked(plan.fresh.map((o) => o.id));
    setMode(null);
    return false; // keep the fresh ones selected for the admin to decide again
  };

  const create = () =>
    run(async () => {
      const r = recover();
      if (r !== null) return r;
      if (!date) {
        toast.error("Escolha a data.");
        return false;
      }
      const now = latest();
      if (!now) return false;
      const d = draftFromOffers(sel, now.merchants, date, Date.now());
      if (!d) {
        setError("Confira o cadastro dos comércios das ofertas selecionadas antes de criar a rodada.");
        return false;
      }
      const saved = await repo.createDraw(d, { makeCurrent: false });
      if (!report(saved)) {
        if (!saved.ok) setError(saved.message);
        return false;
      }
      setCreatedId(d.id);
      if (!finish(sel)) return false;
      toast.success(`Rascunho criado com ${sel.length} ${sel.length === 1 ? "prêmio" : "prêmios"}.`);
      return true;
    });

  const add = () =>
    run(async () => {
      if (!target) return false;
      const r = recover();
      if (r !== null) return r;
      const ok = await repo.editDraw(target.id, (d) => appendOffers(d, sel, latest()?.merchants ?? state.merchants, links));
      if (!report(ok)) return false;
      if (!finish(sel)) return false;
      toast.success(`Ofertas adicionadas à rodada de ${formatDateBR(target.date)}.`);
      return true;
    });

  if (pending.length === 0 && !created) return null;

  return (
    <section className="mt-4 space-y-3" aria-label="Ofertas dos comércios">
      {created && (
        <div className="rounded-2xl border-2 border-gold bg-card p-4">
          <p role="status" className="font-display text-xl font-extrabold">Rascunho criado</p>
          <p className="mt-1 font-bold">{formatDateBR(created.date)}</p>
          <ul className="mt-2 space-y-1">
            {roundsOf(created, state.merchants).map((r) => (
              <li key={r.index} className="break-words text-sm">
                {r.merchantName} — {r.prize}
              </li>
            ))}
          </ul>
          <GoldButton
            className="mt-3"
            onClick={() => navigate({ to: "/sorteios/editar/$drawId", params: { drawId: created.id } })}
          >
            Abrir rascunho
          </GoldButton>
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-card p-3 font-bold text-destructive">{error}</p>}
      {pending.length > 0 && (
      <>
      <h2 id="ofertas" className="font-display text-xl font-extrabold">
        Ofertas recebidas ({pending.length})
      </h2>
      {pending.map((o) => (
        <OfferCard key={o.id} offer={o} state={state} picked={picked.indexOf(o.id)} onToggle={() => toggle(o.id)} />
      ))}

      {sel.length > 0 && (
        <div className="rounded-2xl border-2 border-gold p-4" data-testid="selection">
          <p className="font-extrabold">
            {sel.length} {sel.length === 1 ? "oferta selecionada" : "ofertas selecionadas"}
          </p>
          <p className="text-sm text-muted-foreground">Ordem em que serão sorteadas:</p>
          <ol className="mt-1 space-y-1" data-testid="order">
            {sel.map((o, i) => (
              <li key={o.id} className="text-sm">
                <b>Prêmio {i + 1}</b> · {shopOf(o)?.name} — {o.prize}
              </li>
            ))}
          </ol>
          <GoldButton onClick={() => setMode("criar")} className="mt-3">
            Escolher data da rodada
          </GoldButton>
          <SecondaryButton onClick={() => { setMode("adicionar"); setDrawId(draws[0]?.id ?? ""); }} className="mt-1">
            Adicionar a uma rodada existente
          </SecondaryButton>

          {mode === "criar" && (
            <div className="mt-3 space-y-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Data da rodada</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${fieldClass} [color-scheme:dark]`} />
              </label>
              <GoldButton onClick={create} disabled={busy}>
                Confirmar e criar rascunho
              </GoldButton>
            </div>
          )}

          {mode === "adicionar" &&
            (draws.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">Não há rodada aberta. Use “Escolher data da rodada”.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-bold">Rodada (ainda sem resultado)</span>
                  <select value={drawId} onChange={(e) => { setDrawId(e.target.value); setLinks({}); }} className={fieldClass} data-testid="draw-select">
                    {draws.map((d) => (
                      <option key={d.id} value={d.id}>
                        {formatDateBR(d.date)}
                        {d.draft ? " (rascunho)" : ""} · {roundsOf(d, state.merchants).map((r) => r.prize).join(", ")}
                      </option>
                    ))}
                  </select>
                </label>
                {target &&
                  sel.map((o) => {
                    const same = o.merchantId ? sameShopRounds(target, state.merchants, o.merchantId) : [];
                    if (same.length === 0) return null;
                    return (
                      <fieldset key={o.id} className="space-y-1">
                        <legend className="text-sm font-bold">“{o.prize}” já está cadastrado nesta rodada?</legend>
                        {[{ roundId: "", prize: "Não: acrescentar como novo prêmio" }, ...same.map((r) => ({ ...r, prize: `Sim, é “${r.prize}”` }))].map((r) => (
                          <label key={r.roundId || "nova"} className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary/60 px-3">
                            <input
                              type="radio"
                              name={`l-${o.id}`}
                              checked={(links[o.id] ?? "") === r.roundId}
                              onChange={() =>
                                setLinks(({ [o.id]: _x, ...rest }) => (r.roundId ? { ...rest, [o.id]: r.roundId } : rest))
                              }
                            />
                            <span className="text-sm">{r.prize}</span>
                          </label>
                        ))}
                      </fieldset>
                    );
                  })}
                <GoldButton onClick={add} disabled={busy || !target}>
                  Confirmar e adicionar
                </GoldButton>
              </div>
            ))}
        </div>
      )}
      </>
      )}
    </section>
  );
}

function OfferCard({
  offer,
  state,
  picked,
  onToggle,
}: {
  offer: Offer;
  state: AppState;
  picked: number;
  onToggle: () => void;
}) {
  const linked = offer.merchantId ? state.merchants.find((m) => m.id === offer.merchantId) : undefined;
  const match = linked ? undefined : findExisting(state.merchants, offer.name, offer.whatsapp);

  const attachShop = (merchantId: string) =>
    updateSim((s) => ({
      ...s,
      offers: s.offers.map((x) => (x.id === offer.id ? { ...x, merchantId } : x)),
      accounts: s.accounts.map((a) => (a.id === offer.accountId ? { ...a, merchantId } : a)),
    }));

  const createShop = async () => {
    const id = offerMerchantId(offer);
    if (!state.merchants.some((m) => m.id === id)) {
      const ok = await repo.saveMerchant({
        id,
        name: offer.name,
        ...(offer.logo ? { logo: offer.logo } : {}),
        ...(offer.whatsapp ? { whatsapp: offer.whatsapp } : {}),
        createdAt: Date.now(),
      });
      if (!report(ok)) return;
    }
    if (!attachShop(id)) return void toast.error("Não foi possível salvar o ensaio.");
    toast.success(`${offer.name} cadastrado.`);
  };

  return (
    <article className={`rounded-2xl bg-card p-4 ${picked >= 0 ? "ring-2 ring-gold" : ""}`} data-testid="offer">
      {linked ? (
        <label className="flex cursor-pointer items-center gap-3">
          <input type="checkbox" checked={picked >= 0} onChange={onToggle} className="h-6 w-6 shrink-0 accent-[var(--gold)]" aria-label={`Selecionar ${offerText(offer)}`} />
          <MerchantLogo src={linked.logo ?? offer.logo} className="h-12 w-12" />
          <span className="min-w-0 flex-1">
            <span className="block font-bold">{linked.name}</span>
            <span className="block text-sm">{offer.prize}</span>
          </span>
          {picked >= 0 && <span className="shrink-0 font-extrabold text-gold">{picked + 1}º</span>}
        </label>
      ) : (
        <div className="flex items-center gap-3">
          <MerchantLogo src={offer.logo} className="h-12 w-12" />
          <p className="min-w-0 flex-1 font-bold">{offerText(offer)}</p>
        </div>
      )}
      <p className="mt-1 text-sm text-muted-foreground">WhatsApp {formatWhatsapp(offer.whatsapp)}</p>
      {!linked &&
        (match ? (
          <div className="mt-3 rounded-xl border-2 border-gold/60 p-3">
            <p className="text-sm">
              Já existe <b>{match.name}</b> com o mesmo nome ou WhatsApp. Confira antes de criar outra ficha.
            </p>
            <GoldButton onClick={() => attachShop(match.id)} className="mt-2">
              Conferir cadastro: é o mesmo
            </GoldButton>
            <SecondaryButton onClick={createShop} className="mt-1">
              É outro comércio: cadastrar
            </SecondaryButton>
          </div>
        ) : (
          <GoldButton onClick={createShop} className="mt-3">
            Cadastrar {offer.name}
          </GoldButton>
        ))}
    </article>
  );
}

/** Per drawn courtesy of a shop: send winner (fictitious phone) to the shop view; shows "retirado". */
export function WinnerToShopCard({ draw, state }: { draw: Draw; state: AppState }) {
  const sim = useSim();
  const rounds = roundsOf(draw, state.merchants).filter((r) => r.result && r.merchantId);
  if (!sim || rounds.length === 0 || draw.isSample) return null;
  return (
    <section className="mt-4 rounded-2xl bg-card p-4" aria-labelledby="loja">
      <h2 id="loja" className="font-display text-xl font-extrabold">
        Avisar a loja
      </h2>
      <p className="text-sm text-muted-foreground">{ENSAIO_TAG}</p>
      <ul className="mt-2 space-y-2">
        {rounds.map((r) => {
          const roundId = roundIdOf(draw, r.index)!;
          const sent = sim.notices.find((n) => n.roundId === roundId);
          const delivered = draw.deliveries?.find((d) => d.roundId === roundId);
          return (
            <li key={roundId} className="rounded-xl bg-secondary/60 p-3" data-testid="notice-row">
              <p className="text-sm text-muted-foreground">
                {r.prize} · {r.merchantName}
              </p>
              <p className="font-bold">{r.result!.winner}</p>
              {delivered ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-gold">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> A loja marcou como retirado
                </p>
              ) : sent ? (
                <p className="mt-1 text-sm">Enviado à loja · tel. {sent.phone} · aguardando retirada</p>
              ) : (
                <button
                  onClick={() => {
                    const ok = updateSim((s) => ({
                      ...s,
                      notices: [
                        ...s.notices,
                        {
                          id: newId(),
                          merchantId: r.merchantId!,
                          drawId: draw.id,
                          roundId,
                          winner: r.result!.winner,
                          phone: fakePhone(r.result!.winner),
                          sentAt: Date.now(),
                        },
                      ],
                    }));
                    if (ok) toast.success(`Ganhador enviado para ${r.merchantName} (ensaio).`);
                    else toast.error("Não foi possível salvar o ensaio.");
                  }}
                  className="mt-1 flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground"
                >
                  <Send className="h-4 w-4" aria-hidden="true" /> Enviar ganhador à loja
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <Link to="/parceiros/loja" className="mt-2 flex h-11 items-center gap-1 text-sm font-bold text-gold">
        <Gift className="h-4 w-4" aria-hidden="true" /> Abrir a visão da loja (teste)
      </Link>
    </section>
  );
}

