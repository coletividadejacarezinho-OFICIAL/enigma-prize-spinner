import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Disc3, Hourglass, MessageCircle, Pencil, Trophy } from "lucide-react";
import { useState } from "react";

import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { MerchantLogo } from "@/components/enigma/Logos";
import { ResultShareDialog } from "@/components/enigma/ResultShare";
import { formatDateBR, merchantOf, resultMessage } from "@/lib/enigma/logic";
import { setCurrent, useAppState } from "@/lib/enigma/store";
import { GROUP_NAME } from "@/lib/enigma/types";

export const Route = createFileRoute("/sorteios/ver/$drawId")({
  head: () => ({
    meta: [
      { title: "Sorteio — Enigma Premiado" },
      { name: "description", content: "Resultado de um sorteio do Enigma Premiado." },
      { property: "og:title", content: "Sorteio — Enigma Premiado" },
      { property: "og:description", content: "Resultado de um sorteio do Enigma Premiado." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VerSorteio,
});

function VerSorteio() {
  const { drawId } = Route.useParams();
  const state = useAppState();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const back = (
    <Link to="/sorteios" className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
      <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
    </Link>
  );
  const draw = state.draws.find((d) => d.id === drawId);
  if (!draw) {
    return (
      <div className="px-4 pb-24 pt-3">
        {back}
        <p className="text-muted-foreground">Esse sorteio não foi encontrado neste aparelho.</p>
      </div>
    );
  }

  const shop = merchantOf(state.merchants, draw);
  const isCurrent = draw.id === state.currentId;
  // This draw's own saved result, whatever round is on the wheel right now.
  const message = resultMessage(draw, shop.name, GROUP_NAME);

  return (
    <div className="px-4 pb-24 pt-3">
      {back}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-extrabold">{formatDateBR(draw.date)}</h1>
        {draw.isSample && (
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
            Sorteio de teste
          </span>
        )}
        {isCurrent && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
            Na roleta agora
          </span>
        )}
      </div>

      <section className="mt-3 flex items-center gap-3 rounded-2xl bg-card p-3">
        <MerchantLogo src={shop.logo} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Oferecimento: <span className="font-bold text-foreground">{shop.name}</span>
          </p>
          <p className="break-words font-display text-lg font-bold leading-snug text-gold">
            {draw.prize}
          </p>
        </div>
      </section>

      {draw.result ? (
        <section className="mt-3 rounded-3xl border-2 border-gold bg-card p-4 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-bold uppercase tracking-wide text-gold">
            <Trophy className="h-4 w-4" aria-hidden="true" /> Ganhador(a)
          </p>
          <p className="mt-1 break-words font-display text-3xl font-extrabold leading-tight">
            {draw.result.winner}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {draw.names.length} {draw.names.length === 1 ? "participante" : "participantes"}
          </p>
        </section>
      ) : (
        <section className="mt-3 rounded-2xl border-2 border-dashed border-border p-4 text-center">
          <p className="text-sm text-muted-foreground">
            Ainda não girou · {draw.names.length} {draw.names.length === 1 ? "nome" : "nomes"}
          </p>
        </section>
      )}

      <div className="mt-4 space-y-1">
        {message ? (
          <GoldButton onClick={() => setShareOpen(true)}>
            <MessageCircle aria-hidden="true" /> Mandar no WhatsApp
          </GoldButton>
        ) : (
          <p className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 text-center text-lg font-bold text-muted-foreground">
            <Hourglass className="h-5 w-5 shrink-0" aria-hidden="true" /> Resultado ainda não disponível
          </p>
        )}
        <SecondaryButton
          onClick={() => {
            setCurrent(draw.id);
            navigate({ to: "/" });
          }}
        >
          <Disc3 aria-hidden="true" /> {isCurrent ? "Ver na roleta" : "Abrir na roleta"}
        </SecondaryButton>
        {!draw.isSample && (
          <SecondaryButton onClick={() => navigate({ to: "/sorteios/editar/$drawId", params: { drawId: draw.id } })}>
            <Pencil aria-hidden="true" /> Editar sorteio
          </SecondaryButton>
        )}
      </div>

      <ResultShareDialog text={shareOpen ? message : null} onClose={() => setShareOpen(false)} />
    </div>
  );
}
