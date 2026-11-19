import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Camera, ChevronLeft, Mic, MicOff, Trophy, UserRound } from "lucide-react";

import { GoldButton } from "@/components/enigma/GoldButton";
import { MerchantLogo } from "@/components/enigma/Logos";
import { RecordingSummary } from "@/components/enigma/RecordingDone";
import { Wheel } from "@/components/enigma/Wheel";
import { formatDuration, merchantOf } from "@/lib/enigma/logic";
import { setCurrent, useAppState } from "@/lib/enigma/store";
import { RECORDING_MODES } from "@/lib/enigma/types";

export const Route = createFileRoute("/sorteios/gravacoes/$drawId/$recordingId")({
  head: () => ({
    meta: [
      { title: "Prévia da gravação — Enigma Premiado" },
      { name: "description", content: "Prévia de uma gravação de teste (simulação)." },
      { property: "og:title", content: "Prévia da gravação — Enigma Premiado" },
      { property: "og:description", content: "Prévia de uma gravação de teste (simulação)." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Previa,
});

function Previa() {
  const { drawId, recordingId } = Route.useParams();
  const state = useAppState();
  const navigate = useNavigate();
  if (!state) return <div className="h-dvh" aria-busy="true" />;

  const draw = state.draws.find((d) => d.id === drawId);
  const rec = draw?.recordings?.find((r) => r.id === recordingId);
  const back = (
    <Link to="/sorteios" className="flex h-11 w-fit items-center gap-1 font-bold text-muted-foreground">
      <ChevronLeft className="h-5 w-5" aria-hidden="true" /> Voltar
    </Link>
  );
  if (!draw || !rec) {
    return (
      <div className="px-4 pb-24 pt-3">
        {back}
        <p className="text-muted-foreground">Essa gravação não foi encontrada neste aparelho.</p>
      </div>
    );
  }

  const shop = merchantOf(state.merchants, draw);
  const mode = RECORDING_MODES.find((m) => m.id === rec.mode);
  const showWheel = rec.mode !== "voz";
  const spunHere = !!rec.winner && !!draw.result;

  return (
    <div className="px-4 pb-24 pt-3">
      {back}
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-extrabold">Prévia</h1>
        <span className="rounded-full border border-gold px-2 py-0.5 text-xs font-bold text-gold">
          Simulação
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        {mode?.label} · {rec.mic ? "microfone ligado" : "microfone desligado"}
      </p>

      {/* A drawn mock frame, not a video: nothing was recorded. */}
      <div className="relative mt-3 overflow-hidden rounded-3xl border-2 border-border bg-nav p-3">
        <div className="flex items-center gap-2">
          <MerchantLogo src={shop.logo} className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-xs text-muted-foreground">{shop.name}</p>
            <p className="truncate text-sm font-bold text-gold">{draw.prize}</p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-card px-2 py-0.5 text-xs font-bold tabular-nums">
            {formatDuration(rec.durationMs)}
          </span>
        </div>

        {showWheel ? (
          <div className="wheel-box relative mt-3 flex h-56 items-center justify-center pt-3">
            <Wheel names={draw.names} rotation={spunHere ? (draw.result?.rotation ?? 0) : 0} />
            {rec.mode === "roleta-camera" && (
              <div className="absolute bottom-1 right-1 flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 border-gold bg-card text-[10px] font-bold text-muted-foreground">
                <UserRound className="h-6 w-6 text-gold" aria-hidden="true" />
                Câmera
              </div>
            )}
          </div>
        ) : (
          <div className="mt-3 flex h-40 flex-col items-center justify-center gap-2 rounded-2xl bg-card">
            {rec.mic ? (
              <Mic className="h-10 w-10 text-gold" aria-hidden="true" />
            ) : (
              <MicOff className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            )}
            <div className="flex h-8 items-end gap-1" aria-hidden="true">
              {[3, 6, 4, 8, 5, 7, 3, 6, 4].map((h, i) => (
                <span key={i} className="w-1.5 rounded-full bg-gold/70" style={{ height: `${h * 4}px` }} />
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-center gap-2 rounded-2xl bg-card px-3 py-2 text-center">
          {rec.winner ? (
            <>
              <Trophy className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
              <span className="font-display text-xl font-extrabold">{rec.winner}</span>
            </>
          ) : (
            <span className="font-bold text-muted-foreground">Sem sorteio realizado</span>
          )}
        </div>
        <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Simulação — nenhum vídeo foi gravado
        </p>
      </div>

      <div className="mt-4">
        <RecordingSummary recording={rec} date={draw.date} merchant={shop.name} prize={draw.prize} />
      </div>

      <GoldButton
        className="mt-4"
        onClick={() => {
          setCurrent(draw.id);
          navigate({ to: "/" });
        }}
      >
        Voltar à roleta
      </GoldButton>
    </div>
  );
}
