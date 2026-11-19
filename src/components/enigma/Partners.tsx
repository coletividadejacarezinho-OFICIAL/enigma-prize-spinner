/** P1 (ensaio): admin side of partner shops — invites, received offers, winner sent to the shop. */
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Gift, Send, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GoldButton, SecondaryButton } from "./GoldButton";
import { MerchantLogo } from "./Logos";
import { fieldClass } from "./fields";
import { report } from "@/lib/enigma/feedback";
import { formatDateBR, newId } from "@/lib/enigma/logic";
import {
  addOfferCourtesy,
  fakePhone,
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
      {pending.length > 0 && (
        <section className="mt-4 space-y-3" aria-labelledby="ofertas">
          <h2 id="ofertas" className="font-display text-xl font-extrabold">
            Ofertas recebidas ({pending.length})
          </h2>
          {pending.map((o) => (
            <OfferCard key={o.id} offer={o} state={state} />
          ))}
        </section>
      )}
    </>
  );
}

function OfferCard({ offer, state }: { offer: Offer; state: AppState }) {
  const linked = offer.merchantId ? state.merchants.find((m) => m.id === offer.merchantId) : undefined;
  const match = linked ? undefined : findExisting(state.merchants, offer.name, offer.whatsapp);
  const draws = openDraws(state.draws).sort((a, b) => b.date.localeCompare(a.date));
  const [drawId, setDrawId] = useState(draws[0]?.id ?? "");
  const [target, setTarget] = useState("nova");
  const draw = draws.find((d) => d.id === drawId);
  const existing = linked && draw ? sameShopRounds(draw, state.merchants, linked.id) : [];

  const attachShop = async (merchantId: string) =>
    updateSim((s) => ({
      ...s,
      offers: s.offers.map((x) => (x.id === offer.id ? { ...x, merchantId } : x)),
      accounts: s.accounts.map((a) => (a.id === offer.accountId ? { ...a, merchantId } : a)),
    }));

  const createShop = async () => {
    const id = newId();
    const ok = await repo.saveMerchant({
      id,
      name: offer.name,
      ...(offer.logo ? { logo: offer.logo } : {}),
      ...(offer.whatsapp ? { whatsapp: offer.whatsapp } : {}),
      createdAt: Date.now(),
    });
    if (!report(ok)) return;
    if (!(await attachShop(id))) return void toast.error("Não foi possível salvar o ensaio.");
    toast.success(`${offer.name} cadastrado.`);
  };

  const confirm = async () => {
    if (!linked || !draw) return;
    const roundId = target === "nova" ? newId() : target;
    if (target === "nova") {
      const ok = await repo.editDraw(draw.id, (d) => addOfferCourtesy(d, linked, offer.prize, roundId));
      if (!report(ok)) return;
    }
    const saved = updateSim((s) => ({
      ...s,
      offers: s.offers.map((x) =>
        x.id === offer.id
          ? { ...x, confirmed: { drawId: draw.id, roundId, at: Date.now(), linked: target !== "nova" } }
          : x,
      ),
    }));
    if (!saved) return void toast.error("Não foi possível salvar o ensaio.");
    toast.success(
      target === "nova" ? `Cortesia confirmada na rodada de ${formatDateBR(draw.date)}.` : "Oferta ligada à cortesia que já existia.",
    );
  };

  return (
    <article className="rounded-2xl bg-card p-4" data-testid="offer">
      <div className="flex items-center gap-3">
        <MerchantLogo src={linked?.logo ?? offer.logo} className="h-12 w-12" />
        <p className="min-w-0 flex-1 font-bold">{offerText(offer)}</p>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">WhatsApp {formatWhatsapp(offer.whatsapp)}</p>

      {!linked ? (
        match ? (
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
        )
      ) : draws.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Crie uma rodada em “Nova rodada” para receber esta cortesia.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold">Rodada</span>
            <select
              value={drawId}
              onChange={(e) => {
                setDrawId(e.target.value);
                setTarget("nova");
              }}
              className={fieldClass}
            >
              {draws.map((d) => (
                <option key={d.id} value={d.id}>
                  {formatDateBR(d.date)}
                  {d.draft ? " (rascunho)" : ""} · {roundsOf(d, state.merchants).length} cortesia(s)
                </option>
              ))}
            </select>
          </label>
          {existing.length > 0 && (
            <fieldset className="space-y-1">
              <legend className="mb-1 text-sm font-bold">Já cadastrou este prêmio?</legend>
              {[{ roundId: "nova", prize: "Não: acrescentar como nova cortesia" }, ...existing.map((r) => ({ ...r, prize: `Sim, é “${r.prize}”` }))].map((r) => (
                <label key={r.roundId} className="flex min-h-11 items-center gap-2 rounded-xl bg-secondary/60 px-3">
                  <input type="radio" name={`t-${offer.id}`} checked={target === r.roundId} onChange={() => setTarget(r.roundId)} />
                  <span className="text-sm">{r.prize}</span>
                </label>
              ))}
            </fieldset>
          )}
          <GoldButton onClick={confirm}>Confirmar cortesia</GoldButton>
        </div>
      )}
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
