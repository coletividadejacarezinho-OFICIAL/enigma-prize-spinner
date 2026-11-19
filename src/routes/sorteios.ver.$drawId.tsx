import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Disc3, Eye, ThumbsUp, Hourglass, MessageCircle, Pencil, Play, Trophy, UserRound } from "lucide-react";
import { useState } from "react";

import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { MerchantLogo } from "@/components/enigma/Logos";
import { ResultShareDialog } from "@/components/enigma/ResultShare";
import { formatDateBR, merchantOf } from "@/lib/enigma/logic";
import { drawResultMessage, roundsOf } from "@/lib/enigma/rounds";
import { setCurrent, useAppState } from "@/lib/enigma/store";
import { GROUP_NAME } from "@/lib/enigma/types";
import { DEMO_AUDIENCE, audienceTotals } from "@/lib/enigma/watch";

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
  const message = drawResultMessage(draw, state.merchants, GROUP_NAME);
  const rounds = roundsOf(draw, state.merchants);

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

      {rounds.length > 1 ? (
        <ol className="mt-3 space-y-2" data-testid="rounds">
          {rounds.map((r) => (
            <li key={r.index} className="rounded-2xl bg-card p-3">
              <div className="flex items-center gap-3">
                <MerchantLogo src={r.merchantLogo} className="h-11 w-11" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Prêmio {r.index + 1} de {rounds.length} · <span className="font-bold text-foreground">{r.merchantName}</span>
                  </p>
                  <p className="break-words font-display text-lg font-bold leading-snug text-gold">{r.prize}</p>
                </div>
              </div>
              <p className="mt-2 flex items-center gap-1.5 border-t border-border pt-2 font-bold">
                {r.result ? (
                  <>
                    <Trophy className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                    <span className="min-w-0 break-words font-display text-xl font-extrabold">{r.result.winner}</span>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">Ainda não sorteado</span>
                )}
              </p>
            </li>
          ))}
          <li className="px-1 text-sm text-muted-foreground">
            {draw.names.length} {draw.names.length === 1 ? "participante" : "participantes"} ·{" "}
            {draw.repeatWinners === false ? "quem ganhou não concorre de novo" : "quem ganhou pode ganhar de novo"}
          </li>
        </ol>
      ) : (
      <>
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

      </>
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

      {draw.names.length > 0 && (
        <details className="mt-6 rounded-2xl bg-card p-4">
          <summary className="cursor-pointer font-display text-xl font-extrabold">
            {draw.result ? "Lista usada no giro" : "Lista confirmada"} ({draw.names.length})
          </summary>
          <ol className="mt-2 space-y-1">
            {draw.names.map((name, i) => (
              <li key={`${i}-${name}`} className="flex gap-2 rounded-lg bg-secondary/40 px-3 py-1.5 text-sm">
                <span className="w-6 shrink-0 text-right font-bold text-muted-foreground">{i + 1}</span>
                <span className="min-w-0 break-words font-semibold">{name}</span>
              </li>
            ))}
          </ol>
        </details>
      )}

      <WhoWatched />

      <ResultShareDialog text={shareOpen ? message : null} onClose={() => setShareOpen(false)} />
    </div>
  );
}

/** Audience view for the presenter, made only of clearly marked fictitious examples. */
function WhoWatched() {
  const totals = audienceTotals(DEMO_AUDIENCE);
  const stats = [
    { label: "Abriu a página", value: totals.opened, icon: Eye },
    { label: "Iniciou a reprodução", value: totals.played, icon: Play },
    { label: "Curtiu", value: totals.liked, icon: ThumbsUp },
  ];
  return (
    <section className="mt-6 rounded-2xl bg-card p-4" aria-labelledby="quem-acompanhou">
      <div className="flex items-center justify-between gap-2">
        <h2 id="quem-acompanhou" className="font-display text-xl font-extrabold">
          Quem acompanhou
        </h2>
        <span className="shrink-0 rounded-full border border-gold px-2 py-0.5 text-[10px] font-bold text-gold">
          Exemplo fictício
        </span>
      </div>
      <ul className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(({ label, value, icon: Icon }) => (
          <li key={label} className="rounded-xl bg-secondary/60 p-2 text-center">
            <Icon className="mx-auto h-4 w-4 text-gold" aria-hidden="true" />
            <p className="font-display text-2xl font-extrabold tabular-nums">{value}</p>
            <p className="text-xs font-semibold leading-tight text-muted-foreground">{label}</p>
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-1">
        {DEMO_AUDIENCE.map((e, i) => (
          <li key={i} className="flex items-center gap-2 rounded-xl bg-secondary/40 px-3 py-2">
            <UserRound className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
              {e.name}
              {e.example && <span className="font-normal text-muted-foreground"> (exemplo)</span>}
            </span>
            <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground">
              <Eye className="h-4 w-4" aria-label="Abriu a página" />
              {e.played && <Play className="h-4 w-4 text-gold" aria-label="Iniciou a reprodução" />}
              {e.liked && <ThumbsUp className="h-4 w-4 fill-gold text-gold" aria-label="Curtiu" />}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">
        Abrir a página não quer dizer que a pessoa assistiu ao vídeo. Os nomes do sorteio não são a
        lista de quem assistiu.
      </p>
    </section>
  );
}
