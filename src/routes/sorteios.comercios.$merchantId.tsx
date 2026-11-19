import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { SecondaryButton } from "@/components/enigma/GoldButton";
import { useOpenInvite } from "@/components/enigma/Partners";
import { MerchantForm } from "@/components/enigma/MerchantForm";
import { buildListao, formatDateBR, normalizeForCompare, todayISO } from "@/lib/enigma/logic";
import { report } from "@/lib/enigma/feedback";
import { repo, useAppState } from "@/lib/enigma/repo";

export const Route = createFileRoute("/sorteios/comercios/$merchantId")({
  head: () => ({
    meta: [
      { title: "Comércio parceiro — Enigma Premiado" },
      { name: "description", content: "Veja e corrija os dados do comércio parceiro." },
      { property: "og:title", content: "Comércio parceiro — Enigma Premiado" },
      { property: "og:description", content: "Veja e corrija os dados do comércio parceiro." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Comercio,
});

function Comercio() {
  const { merchantId } = Route.useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const openInvite = useOpenInvite();
  if (!state) return <div className="h-dvh" aria-busy="true" />;
  const merchant = state.merchants.find((m) => m.id === merchantId);
  const today = todayISO();
  const listao = buildListao(state, today);
  const active = listao.active.find((e) => e.merchant.id === merchantId);
  const scheduled = listao.scheduled.find((e) => e.merchant.id === merchantId);
  const draws = state.draws.filter((d) => d.merchantId === merchantId);

  return (
    <div className="px-4 pb-24 pt-3">
      <Link
        to="/sorteios"
        search={{ aba: "comercios" }}
        className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      {!merchant ? (
        <p className="text-muted-foreground">Esse comércio não foi encontrado neste aparelho.</p>
      ) : (
        <>
          <h1 className="text-3xl font-extrabold">{merchant.name}</h1>
          <p className="mb-4 text-sm text-muted-foreground">
            {active
              ? `No Listão até ${formatDateBR(active.until)}`
              : scheduled
                ? `Entra no Listão em ${formatDateBR(scheduled.starts)}`
                : "Fora do Listão no momento"}
            {" · "}
            {draws.length} {draws.length === 1 ? "sorteio" : "sorteios"}
          </p>
          <SecondaryButton onClick={() => openInvite("individual", merchant.id)} className="mb-4">
            <UserPlus className="h-5 w-5" aria-hidden="true" /> Convidar responsável
          </SecondaryButton>
          <MerchantForm
            key={merchant.id}
            initial={{ name: merchant.name, logo: merchant.logo }}
            onSave={async ({ name, logo }) => {
              const dup = state.merchants.find(
                (m) =>
                  m.id !== merchant.id && normalizeForCompare(m.name) === normalizeForCompare(name),
              );
              if (dup) return void toast.error(`“${dup.name}” já está cadastrado.`);
              const { logo: _old, ...rest } = merchant; // keeps whatsapp
              const next = logo ? { ...rest, name, logo } : { ...rest, name };
              if (!report(await repo.saveMerchant(next))) return;
              toast.success("Comércio atualizado.");
              navigate({ to: "/sorteios", search: { aba: "comercios" } });
            }}
          />
        </>
      )}
    </div>
  );
}
