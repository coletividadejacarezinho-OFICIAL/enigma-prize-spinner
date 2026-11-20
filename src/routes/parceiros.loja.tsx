import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, PackageCheck } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { LogoPicker } from "@/components/enigma/LogoPicker";
import { WhatsappInput } from "@/components/enigma/WhatsappInput";
import { ENSAIO_TAG } from "@/components/enigma/Partners";
import { areaClass, fieldClass } from "@/components/enigma/fields";
import { report, reportPartner } from "@/lib/enigma/feedback";
import { formatDateBR, newId } from "@/lib/enigma/logic";
import { formatDescription, formatShopName } from "@/lib/enigma/input-format";
import { cleanWhatsapp, maskWhatsapp, type Account } from "@/lib/enigma/partners";
import { PartnerRecovery } from "@/components/enigma/PartnerRecovery";
import { partnersRepo, usePartnerSnapshot } from "@/lib/enigma/partners-repo";
import { repo, useAppState } from "@/lib/enigma/repo";

export const Route = createFileRoute("/parceiros/loja")({
  validateSearch: (s: Record<string, unknown>): { convite?: string } =>
    typeof s["convite"] === "string" ? { convite: s["convite"] } : {},
  head: () => ({
    meta: [
      { title: "Visão do comerciante (ensaio) — Enigma Premiado" },
      { name: "description", content: "Ensaio da visão do comércio parceiro." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Loja,
});


function Loja() {
  const state = useAppState();
  const partnerSnapshot = usePartnerSnapshot();
  const sim = partnerSnapshot?.kind === "ok" ? partnerSnapshot.state : null;
  const { convite } = Route.useSearch();
  const [step, setStep] = useState<"perfil" | "pergunta" | "oferta" | "pronto">("perfil");
  const [prize, setPrize] = useState("");
  const [offerIdentity, setOfferIdentity] = useState(() => ({ id: newId(), createdAt: Date.now() }));
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  if (partnerSnapshot?.kind === "broken") return <div className="p-4"><PartnerRecovery /></div>;
  if (!state || !sim) return <div className="h-dvh" aria-busy="true" />;

  const invite = convite ? sim.invites.find((i) => i.id === convite) : undefined;
  const account = sim.accounts.find((a) => a.id === sim.session);
  const shop = account?.merchantId ? state.merchants.find((m) => m.id === account.merchantId) : undefined;
  const target = invite?.merchantId ? state.merchants.find((m) => m.id === invite.merchantId) : undefined;
  const notices = shop ? sim.notices.filter((n) => n.merchantId === shop.id) : [];

  const login = async () => {
    const a: Account = { id: newId(), email: "dono.teste@exemplo.com" };
    reportPartner(await partnersRepo.signIn(a));
  };

  return (
    <div className="px-4 pb-24 pt-3">
      <Link to="/sorteios" search={{ aba: "comercios" }} className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar para a administradora
      </Link>
      <p className="mb-3 rounded-xl bg-secondary px-3 py-2 text-sm font-bold text-gold">
        Visão de teste do comerciante. {ENSAIO_TAG}
      </p>

      {!account ? (
        <section className="rounded-2xl bg-card p-4">
          <h1 className="text-2xl font-extrabold">
            {target ? `Convite para o ${target.name}` : "Convite para comércios parceiros"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            A COLETIVIDADE JACAREZINHO PR convida o seu comércio para oferecer cortesias no Enigma Premiado.
          </p>
          <GoldButton onClick={login} className="mt-4">
            Entrar com Google (simulado)
          </GoldButton>
        </section>
      ) : target && !shop ? (
        <section className="rounded-2xl bg-card p-4">
          <h1 className="text-2xl font-extrabold">{target.name}</h1>
          <p className="mt-2 text-muted-foreground">
            Esta conta ({account.email}) vai cuidar da ficha que já existe. Nada se perde do histórico.
          </p>
          <GoldButton
            className="mt-4"
            onClick={async () => {
              const result = await partnersRepo.attachShop({ accountId: account.id, merchantId: target.id });
              if (reportPartner(result)) toast.success(`Conta vinculada ao ${target.name}.`);
            }}
          >
            Vincular minha conta ao {target.name}
          </GoldButton>
        </section>
      ) : step === "perfil" ? (
        <Profile account={account} shop={shop} onDone={() => setStep("pergunta")} />
      ) : step === "pergunta" ? (
        <section className="rounded-2xl bg-card p-4">
          <h1 className="text-2xl font-extrabold">Quer oferecer uma cortesia?</h1>
          <GoldButton onClick={() => setStep("oferta")} className="mt-4">
            Oferecer agora
          </GoldButton>
          <SecondaryButton onClick={() => setStep("pronto")} className="mt-1">
            Depois
          </SecondaryButton>
        </section>
      ) : step === "oferta" ? (
        <section className="rounded-2xl bg-card p-4">
          <label className="block">
            <span className="mb-1.5 block text-xl font-extrabold">Qual é o prêmio?</span>
            <textarea disabled={sending} value={prize} onChange={(e) => setPrize(e.target.value)} onBlur={(e) => setPrize(formatDescription(e.target.value))} autoCapitalize="sentences" rows={3} placeholder="Ex.: Um hambúrguer com batata" className={areaClass} />
          </label>
          <GoldButton
            className="mt-4"
            disabled={sending || !prize.trim()}
            onClick={async () => {
              if (sendingRef.current) return;
              sendingRef.current = true;
              setSending(true);
              try {
                const fresh = sim.accounts.find((a) => a.id === account.id) ?? account;
                const m = fresh.merchantId ? state.merchants.find((x) => x.id === fresh.merchantId) : undefined;
                const result = await partnersRepo.submitOffer({
                  id: offerIdentity.id, accountId: fresh.id,
                  ...(m ? { merchantId: m.id } : {}),
                  name: m?.name ?? fresh.name ?? "",
                  whatsapp: m?.whatsapp ?? fresh.whatsapp ?? "",
                  ...((m?.logo ?? fresh.logo) ? { logo: (m?.logo ?? fresh.logo)! } : {}),
                  prize: formatDescription(prize), createdAt: offerIdentity.createdAt,
                });
                if (!reportPartner(result)) return;
                setOfferIdentity({ id: newId(), createdAt: Date.now() });
                setPrize("");
                setStep("pronto");
                toast.success("Oferta guardada para a administradora (ensaio).");
              } finally {
                sendingRef.current = false;
                setSending(false);
              }
            }}
          >
            {sending ? "Enviando…" : "Enviar para a administradora"}
          </GoldButton>
        </section>
      ) : (
        <section className="rounded-2xl bg-card p-4">
          <h1 className="text-2xl font-extrabold">Tudo certo!</h1>
          <p className="mt-1 text-muted-foreground">Quando houver ganhador da sua cortesia, ele aparece aqui.</p>
          <SecondaryButton onClick={() => setStep("pergunta")} className="mt-3">
            Oferecer outra cortesia
          </SecondaryButton>
        </section>
      )}

      {shop && (
        <section className="mt-4 rounded-2xl bg-card p-4" aria-labelledby="ganhadores">
          <h2 id="ganhadores" className="font-display text-xl font-extrabold">Ganhadores para retirar</h2>
          {notices.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Nenhum ganhador enviado ainda.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {notices.map((n) => {
                const d = state.draws.find((x) => x.id === n.drawId);
                const done = d?.deliveries?.find((x) => x.roundId === n.roundId);
                return (
                  <li key={n.id} className="rounded-xl bg-secondary/60 p-3" data-testid="pickup">
                    <p className="font-bold">{n.winner}</p>
                    <p className="text-sm text-muted-foreground">
                      Tel. {n.phone} (fictício){d ? ` · sorteio de ${formatDateBR(d.date)}` : ""}
                    </p>
                    {done ? (
                      <p className="mt-1 text-sm font-bold text-gold">Retirado</p>
                    ) : (
                      <button
                        onClick={async () => {
                          if (report(await repo.markDelivered(n.drawId, n.roundId, Date.now())))
                            toast.success("Retirada registrada. A administradora já vê.");
                        }}
                        className="mt-1 flex h-11 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-extrabold text-primary-foreground"
                      >
                        <PackageCheck className="h-4 w-4" aria-hidden="true" /> Marcar como retirado
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Profile({
  account,
  shop,
  onDone,
}: {
  account: Account;
  shop: { id: string; name: string; logo?: string; whatsapp?: string; createdAt: number } | undefined;
  onDone: () => void;
}) {
  const [name, setName] = useState(shop?.name ?? account.name ?? "");
  const [wa, setWa] = useState(() => maskWhatsapp(shop?.whatsapp ?? account.whatsapp ?? ""));
  const [logo, setLogo] = useState<string | undefined>(shop?.logo ?? account.logo);
  const [tried, setTried] = useState(false);
  const w = cleanWhatsapp(wa);
  const formattedName = formatShopName(name);
  return (
    <form
      className="space-y-4 rounded-2xl bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (!formattedName || !w) return;
        if (shop) {
          const { logo: _l, ...rest } = shop;
          if (!report(await repo.saveMerchant({ ...rest, name: formattedName, whatsapp: w, ...(logo ? { logo } : {}) }))) return;
        } else {
          const result = await partnersRepo.saveProfile(account.id, {
            name: formattedName, whatsapp: w, ...(logo ? { logo } : {}),
          });
          if (!reportPartner(result)) return;
        }
        onDone();
      }}
    >
      <h1 className="text-2xl font-extrabold">Meu comércio</h1>
      <label className="block">
        <span className="mb-1.5 block font-bold">Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={(e) => setName(formatShopName(e.target.value))} autoCapitalize="words" autoComplete="organization" className={fieldClass} />
        {tried && !formattedName && <span className="text-sm font-semibold text-destructive">Escreva o nome.</span>}
      </label>
      <label className="block">
        <span className="mb-1.5 block font-bold">WhatsApp com DDD</span>
        <WhatsappInput value={wa} onValueChange={setWa} />
        {tried && !w && <span className="text-sm font-semibold text-destructive">Coloque o DDD e o número.</span>}
      </label>
      <div>
        <span className="mb-1.5 block font-bold">Logo (opcional)</span>
        <LogoPicker value={logo} onChange={setLogo} />
      </div>
      <GoldButton type="submit">Salvar e continuar</GoldButton>
    </form>
  );
}
