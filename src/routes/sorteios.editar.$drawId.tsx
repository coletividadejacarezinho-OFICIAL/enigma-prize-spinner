import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";

import { cleanRiddle } from "@/components/enigma/RiddleFields";
import { DrawForm } from "@/components/enigma/DrawForm";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { newId } from "@/lib/enigma/logic";
import { applyPrizes, roundsOf } from "@/lib/enigma/rounds";
import { report } from "@/lib/enigma/feedback";
import { repo, useAppState } from "@/lib/enigma/repo";

export const Route = createFileRoute("/sorteios/editar/$drawId")({
  head: () => ({
    meta: [
      { title: "Editar sorteio — Enigma Premiado" },
      { name: "description", content: "Corrija o comércio, a data, a cortesia ou a confirmação." },
      { property: "og:title", content: "Editar sorteio — Enigma Premiado" },
      {
        property: "og:description",
        content: "Corrija o comércio, a data, a cortesia ou a confirmação.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EditarSorteio,
});

function EditarSorteio() {
  const { drawId } = Route.useParams();
  const state = useAppState();
  const navigate = useNavigate();
  if (!state) return <div className="h-dvh" aria-busy="true" />;
  const draw = state.draws.find((d) => d.id === drawId);

  return (
    <div className="px-4 pb-24 pt-3">
      <Link
        to="/sorteios"
        className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground"
      >
        <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
      </Link>
      <h1 className="mb-4 text-3xl font-extrabold">{draw?.draft ? "Rascunho da rodada" : "Editar sorteio"}</h1>
      {!draw ? (
        <p className="text-muted-foreground">Esse sorteio não foi encontrado neste aparelho.</p>
      ) : (
        <DrawForm
          merchants={state.merchants}
          initial={{
            date: draw.date,
            prizes: roundsOf(draw, state.merchants).map((r) => ({
              key: `r${r.index}`,
              ...(r.index > 0 ? { id: draw.extraPrizes?.[r.index - 1]?.id ?? "" } : {}),
              merchantId: r.merchantId ?? "",
              prize: r.prize,
              ...(r.result ? { locked: true } : {}),
            })),
            confirmed: draw.confirmed ?? null,
            repeatWinners: draw.repeatWinners ?? null,
            riddle: draw.riddle ?? {},
          }}
          onSubmit={async (v, intent) => {
            const prizes = v.prizes.map((p) => ({
              ...(p.id ? { id: p.id } : {}),
              merchant: state.merchants.find((m) => m.id === p.merchantId),
              prize: p.prize,
            }));
            if (prizes.some((p) => !p.merchant)) return;
            const ok = await repo.editDraw(draw.id, (d) => {
              const next = applyPrizes(
                d,
                prizes.flatMap((p) => (p.merchant ? [{ ...p, merchant: p.merchant }] : [])),
                newId,
              );
              const { repeatWinners: _r, riddle: _q, ...rest } = next;
              const riddle = cleanRiddle(v.riddle);
              return {
                ...rest,
                ...(riddle ? { riddle } : {}),
                date: v.date,
                confirmed: v.confirmed,
                // The repeat answer can't change once a round was drawn.
                ...(d.result
                  ? d.repeatWinners !== undefined
                    ? { repeatWinners: d.repeatWinners }
                    : {}
                  : v.prizes.length > 1 && v.repeatWinners !== null
                    ? { repeatWinners: v.repeatWinners }
                    : {}),
              };
            });
            if (!report(ok)) return;
            if (draw.draft && intent === "primary") {
              if (!report(await repo.launchDraft(draw.id))) return;
              toast.success("Rodada lançada. Agora é só lançar os nomes.");
              navigate({ to: "/nomes" });
              return;
            }
            toast.success(draw.draft ? "Rascunho salvo." : "Sorteio atualizado.");
            navigate({ to: "/sorteios" });
          }}
          actions={(submit) =>
            draw.draft ? (
              <>
                <GoldButton type="submit">Lançar rodada</GoldButton>
                <SecondaryButton type="button" onClick={() => submit("draft")}>
                  Salvar rascunho
                </SecondaryButton>
              </>
            ) : (
              <GoldButton type="submit">Salvar alterações</GoldButton>
            )
          }
        />
      )}
    </div>
  );
}
