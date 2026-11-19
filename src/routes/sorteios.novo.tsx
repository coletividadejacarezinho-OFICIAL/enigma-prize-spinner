import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { DrawForm } from "@/components/enigma/DrawForm";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { createDraw } from "@/lib/enigma/logic";
import { addDraw, saveDraw, useAppState } from "@/lib/enigma/store";

export const Route = createFileRoute("/sorteios/novo")({
  head: () => ({
    meta: [
      { title: "Novo sorteio — Enigma Premiado" },
      { name: "description", content: "Escolha a data, as empresas e os prêmios do novo sorteio." },
      { property: "og:title", content: "Novo sorteio — Enigma Premiado" },
      {
        property: "og:description",
        content: "Escolha a data, as empresas e os prêmios do novo sorteio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NovoSorteio,
});

function NovoSorteio() {
  const state = useAppState();
  const navigate = useNavigate();
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  return (
    <div className="px-4 pb-24 pt-3">
      <Link to="/sorteios" className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold">Novo sorteio</h1>
      <DrawForm
        merchants={state.merchants}
        onSubmit={(v, intent) => {
          const picked = v.prizes.map((p) => ({
            merchant: state.merchants.find((m) => m.id === p.merchantId),
            prize: p.prize,
          }));
          const [first, ...more] = picked;
          if (!first?.merchant || more.some((p) => !p.merchant)) return;
          const draw = createDraw({
            date: v.date,
            merchant: first.merchant,
            prize: first.prize,
            confirmed: v.confirmed,
            more: more.flatMap((p) => (p.merchant ? [{ merchant: p.merchant, prize: p.prize }] : [])),
            ...(v.repeatWinners !== null ? { repeatWinners: v.repeatWinners } : {}),
          });
          if (intent === "draft") {
            if (!saveDraw(draw)) return void toast.error("O celular está sem espaço para guardar.");
            toast.success("Rascunho salvo. Confirme a cortesia quando a empresa responder.");
            navigate({ to: "/sorteios" });
            return;
          }
          if (!addDraw(draw)) return void toast.error("O celular está sem espaço para guardar.");
          navigate({ to: "/nomes" });
        }}
        actions={(submit, values) => (
          <>
            <GoldButton type="submit">Continuar para os nomes</GoldButton>
            {values.confirmed === false && (
              <SecondaryButton type="button" onClick={() => submit("draft")}>
                Salvar rascunho
              </SecondaryButton>
            )}
          </>
        )}
      />
    </div>
  );
}
