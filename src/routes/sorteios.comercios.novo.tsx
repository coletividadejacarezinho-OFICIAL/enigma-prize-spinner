import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { MerchantForm } from "@/components/enigma/MerchantForm";
import { createMerchant, normalizeForCompare } from "@/lib/enigma/logic";
import { report } from "@/lib/enigma/feedback";
import { repo, useAppState } from "@/lib/enigma/repo";

export const Route = createFileRoute("/sorteios/comercios/novo")({
  head: () => ({
    meta: [
      { title: "Cadastrar comércio — Enigma Premiado" },
      { name: "description", content: "Cadastre um comércio parceiro com nome e logo." },
      { property: "og:title", content: "Cadastrar comércio — Enigma Premiado" },
      { property: "og:description", content: "Cadastre um comércio parceiro com nome e logo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovoComercio,
});

function NovoComercio() {
  const state = useAppState();
  const navigate = useNavigate();
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  return (
    <div className="px-4 pb-24 pt-3">
      <Link
        to="/sorteios"
        search={{ aba: "comercios" }}
        className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold">Cadastrar comércio</h1>
      <MerchantForm
        onSave={async ({ name, logo }) => {
          const dup = state.merchants.find(
            (m) => normalizeForCompare(m.name) === normalizeForCompare(name),
          );
          if (dup) return void toast.error(`“${dup.name}” já está cadastrado.`);
          if (!report(await repo.saveMerchant(createMerchant({ name, logo })))) return;
          toast.success(`${name} cadastrado!`);
          navigate({ to: "/sorteios", search: { aba: "comercios" } });
        }}
      />
    </div>
  );
}
