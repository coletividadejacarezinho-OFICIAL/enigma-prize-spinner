import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, PackageCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { LogoPicker } from "@/components/enigma/LogoPicker";
import { ENSAIO_TAG } from "@/components/enigma/Partners";
import { areaClass, fieldClass } from "@/components/enigma/fields";
import { report } from "@/lib/enigma/feedback";
import { cleanName, formatDateBR, newId } from "@/lib/enigma/logic";
import { cleanWhatsapp, formatWhatsapp, type Account } from "@/lib/enigma/partners";
import { updateSim, useSim } from "@/lib/enigma/partners-store";
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

const saveFail = () => toast.error("Não foi possível salvar. Libere espaço e tente de novo.");

function Loja() {
  const state = useAppState();
  const sim = useSim();
  const { convite } = Route.useSearch();
  const [step, setStep] = useState<"perfil" | "pergunta" | "oferta" | "pronto">("perfil");
  const [prize, setPrize] = useState("");
  if (!state || !sim) return <div className="h-dvh" aria-busy="true" />;

  const invite = convite ? sim.invites.find((i) => i.id === convite) : undefined;
  const account = sim.accounts.find((a) => a.id === sim.session);
  const shop = account?.merchantId ? state.merchants.find((m) => m.id === account.merchantId) : undefined;
  const target = invite?.merchantId ? state.merchants.find((m) => m.id === invite.merchantId) : undefined;
  const notices = shop ? sim.notices.filter((n) => n.merchantId === shop.id) : [];

  const login = () => {
    const a: Account = { id: newId(), email: "dono.teste@exemplo.com" };
    if (!updateSim((s) => ({ ...s, accounts: [...s.accounts, a], session: a.id }))) saveFail();
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
            onClick={() => {
              const ok = updateSim((s) => ({
                ...s,
                accounts: s.accounts.map((a) => (a.id === account.id ? { ...a, merchantId: target.id } : a)),
              }));
              if (ok) toast.success(`Conta vinculada ao ${target.name}.`);
              else saveFail();
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
            <textarea value={prize} onChange={(e) => setPrize(e.target.value)} rows={3} placeholder="Ex.: Um hambúrguer com batata" className={areaClass} />
          </label>
          <GoldButton
            className="mt-4"
            disabled={!prize.trim()}
            onClick={() => {
              const fresh = sim.accounts.find((a) => a.id === account.id) ?? account;
              const m = fresh.merchantId ? state.merchants.find((x) => x.id === fresh.merchantId) : undefined;
              const name = m?.name ?? fresh.name ?? "";
              const ok = updateSim((s) => ({
                ...s,
                offers: [
                  ...s.offers,
                  {
                    id: newId(),
                    accountId: fresh.id,
                    ...(m ? { merchantId: m.id } : {}),
                    name,
                    whatsapp: m?.whatsapp ?? fresh.whatsapp ?? "",
                    ...((m?.logo ?? fresh.logo) ? { logo: (m?.logo ?? fresh.logo)! } : {}),
                    prize: prize.trim(),
                    createdAt: Date.now(),
                  },
                ],
              }));
              if (!ok) {
                saveFail();
                return;
              }
              setPrize("");
              setStep("pronto");
              toast.success("Oferta guardada para a administradora (ensaio).");
            }}
          >
            Enviar para a administradora
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
  const [wa, setWa] = useState(shop?.whatsapp ? formatWhatsapp(shop.whatsapp) : account.whatsapp ?? "");
  const [logo, setLogo] = useState<string | undefined>(shop?.logo ?? account.logo);
  const [tried, setTried] = useState(false);
  const w = cleanWhatsapp(wa);
  return (
    <form
      className="space-y-4 rounded-2xl bg-card p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setTried(true);
        if (!cleanName(name) || !w) return;
        if (shop) {
          const { logo: _l, ...rest } = shop;
          if (!report(await repo.saveMerchant({ ...rest, name: cleanName(name), whatsapp: w, ...(logo ? { logo } : {}) }))) return;
        } else {
          const ok = updateSim((s) => ({
            ...s,
            accounts: s.accounts.map((a) =>
              a.id === account.id ? { ...a, name: cleanName(name), whatsapp: w, ...(logo ? { logo } : {}) } : a,
            ),
          }));
          if (!ok) return void toast.error("Não foi possível salvar.");
        }
        onDone();
      }}
    >
      <h1 className="text-2xl font-extrabold">Meu comércio</h1>
      <label className="block">
        <span className="mb-1.5 block font-bold">Nome</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
        {tried && !cleanName(name) && <span className="text-sm font-semibold text-destructive">Escreva o nome.</span>}
      </label>
      <label className="block">
        <span className="mb-1.5 block font-bold">WhatsApp com DDD</span>
        <input value={wa} onChange={(e) => setWa(e.target.value)} inputMode="tel" placeholder="(43) 99999-0000" className={fieldClass} />
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
