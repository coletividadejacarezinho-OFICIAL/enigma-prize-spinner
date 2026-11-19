import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { DrawForm } from "@/components/enigma/DrawForm";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { cleanRiddle } from "@/components/enigma/RiddleFields";
import { fromTemplate } from "@/lib/enigma/agenda";
import { createDraw, formatDateBR } from "@/lib/enigma/logic";
import { roundsOf } from "@/lib/enigma/rounds";
import { report } from "@/lib/enigma/feedback";
import { repo, useAppState } from "@/lib/enigma/repo";

export const Route = createFileRoute("/sorteios/novo")({
  validateSearch: (s: Record<string, unknown>): { modelo?: string } =>
    typeof s["modelo"] === "string" ? { modelo: s["modelo"] } : {},
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
  const { modelo } = Route.useSearch();
  if (!state) return <div className="h-dvh" aria-busy="true" />;
  // "Usar como modelo": only the courtesies come over; a new id, no names, results or deliveries.
  const src = modelo ? state.draws.find((d) => d.id === modelo) : undefined;
  const tpl = src ? fromTemplate(src, "", Date.now()) : undefined;

  return (
    <div className="px-4 pb-24 pt-3">
      <Link
        to="/sorteios"
        className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="mb-1 text-3xl font-extrabold">{tpl ? "Nova rodada pelo modelo" : "Nova rodada"}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {tpl
          ? `Cortesias copiadas de ${formatDateBR(src!.date)}. Nomes, ganhadores, gravações e entregas não vêm junto.`
          : "Prepare com calma: dá para salvar como rascunho e lançar depois."}
      </p>
      <DrawForm
        key={modelo ?? "novo"}
        merchants={state.merchants}
        {...(tpl
          ? {
              initial: {
                date: "",
                prizes: roundsOf(tpl, state.merchants).map((r) => ({
                  key: `t${r.index}`,
                  merchantId: r.merchantId ?? "",
                  prize: r.prize,
                })),
                confirmed: null,
                repeatWinners: tpl.repeatWinners ?? null,
                riddle: {},
              },
            }
          : {})}
        onSubmit={async (v, intent) => {
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
            more: more.flatMap((p) =>
              p.merchant ? [{ merchant: p.merchant, prize: p.prize }] : [],
            ),
            ...(v.repeatWinners !== null ? { repeatWinners: v.repeatWinners } : {}),
          });
          const riddle = cleanRiddle(v.riddle);
          if (riddle) draw.riddle = riddle;
          if (src) draw.templateOf = src.id;
          if (intent === "draft") {
            if (!report(await repo.createDraw({ ...draw, draft: true }, { makeCurrent: false }))) return;
            toast.success("Rascunho salvo. Retome em Sorteios quando quiser.");
            navigate({ to: "/sorteios" });
            return;
          }
          if (!report(await repo.createDraw(draw, { makeCurrent: true }))) return;
          navigate({ to: "/nomes" });
        }}
        actions={(submit) => (
          <>
            <GoldButton type="submit">Lançar rodada e ir para os nomes</GoldButton>
            <SecondaryButton type="button" onClick={() => submit("draft")}>
              Salvar rascunho
            </SecondaryButton>
          </>
        )}
      />
    </div>
  );
}
