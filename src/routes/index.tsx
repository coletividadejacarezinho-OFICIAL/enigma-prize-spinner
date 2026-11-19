import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Pencil, Plus, Share2, Trophy, UserPlus } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/enigma/AppHeader";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { MerchantLogo } from "@/components/enigma/Logos";
import { Wheel } from "@/components/enigma/Wheel";
import {
  formatDateBR,
  pickWinnerIndex,
  secureRandom,
  shareText,
  targetRotation,
} from "@/lib/enigma/logic";
import { playTick, playWin, unlockSound } from "@/lib/enigma/sound";
import { currentDraw, updateDraw, useAppState } from "@/lib/enigma/store";
import { APP_NAME, GROUP_NAME, MIN_NAMES_TO_SPIN } from "@/lib/enigma/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roleta — Enigma Premiado" },
      {
        name: "description",
        content: "Gire a roleta do Enigma Premiado da Coletividade Jacarezinho PR e veja o ganhador.",
      },
      { property: "og:title", content: "Roleta — Enigma Premiado" },
      {
        property: "og:description",
        content: "Gire a roleta do Enigma Premiado da Coletividade Jacarezinho PR e veja o ganhador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Roleta,
});

const SPIN_MS = 5500;

function Roleta() {
  const state = useAppState();
  const navigate = useNavigate();
  const [spin, setSpin] = useState<{ from: number; durationMs: number; key: number } | null>(null);
  const spinningRef = useRef(false);

  if (!state) return <RoletaSkeleton />;

  const draw = currentDraw(state);
  const count = draw.names.length;
  const result = draw.result;
  const spinning = spin !== null;
  const showResult = !!result && !spinning;
  const canSpin = count >= MIN_NAMES_TO_SPIN;

  const handleSpin = () => {
    if (spinningRef.current || draw.result || !canSpin) return;
    spinningRef.current = true;
    if (state.sound) unlockSound();
    const index = pickWinnerIndex(count);
    const rotation = targetRotation(0, index, count, secureRandom());
    const winner = draw.names[index] ?? "";
    // Save the result before animating so leaving or reloading keeps the same winner.
    updateDraw(draw.id, (d) => ({ ...d, result: { winner, index, rotation, at: Date.now() } }));
    setSpin({ from: 0, durationMs: SPIN_MS, key: Date.now() });
  };

  const handleSpinEnd = () => {
    spinningRef.current = false;
    setSpin(null);
    if (state.sound) playWin();
  };

  const handleShare = async () => {
    const text = shareText(draw, GROUP_NAME);
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: APP_NAME, text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Resultado copiado! Agora é só colar no WhatsApp.");
    } catch {
      toast.error("Não deu para compartilhar neste aparelho.");
    }
  };

  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <AppHeader
        logo={state.groupLogo}
        subtitle={`${count} ${count === 1 ? "participante" : "participantes"}`}
      />

      <section className="mx-4 flex items-center gap-3 rounded-2xl bg-card p-3">
        <MerchantLogo src={draw.merchantLogo} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Oferecimento: <span className="font-bold text-foreground">{draw.merchant}</span>
          </p>
          <p className="font-display text-lg font-bold leading-snug text-gold">{draw.prize}</p>
        </div>
      </section>

      <p className="mt-2 flex items-center justify-center gap-2 truncate px-4 text-xs text-muted-foreground">
        <span className="truncate">
          {APP_NAME} · {formatDateBR(draw.date)}
        </span>
        {draw.isSample && (
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-semibold">
            Sorteio de teste
          </span>
        )}
      </p>

      <div className="wheel-box relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2 pt-5">
        <Wheel
          names={draw.names}
          rotation={result?.rotation ?? 0}
          spin={spin}
          {...(state.sound ? { onTick: playTick } : {})}
          onSpinEnd={handleSpinEnd}
        />
        {showResult && result && (
          <div className="absolute inset-0 flex items-center justify-center px-6">
            <div
              className="w-full max-w-xs rounded-3xl border-2 border-gold bg-background/90 p-5 text-center shadow-2xl backdrop-blur-sm animate-in fade-in zoom-in-90 duration-500"
              role="status"
            >
              <p className="flex items-center justify-center gap-1.5 text-sm font-bold uppercase tracking-wide text-gold">
                <Trophy className="h-4 w-4" aria-hidden="true" /> Ganhador(a)
              </p>
              <p className="mt-1 break-words font-display text-4xl font-extrabold leading-tight">
                {result.winner}
              </p>
              <p className="mt-3 text-base font-bold text-gold">{draw.prize}</p>
              <p className="text-sm text-muted-foreground">Oferecimento: {draw.merchant}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1 px-4 pb-2">
        {!canSpin && !result ? (
          <GoldButton onClick={() => navigate({ to: "/nomes" })}>
            <UserPlus aria-hidden="true" /> Adicionar nomes
          </GoldButton>
        ) : showResult ? (
          <GoldButton onClick={handleShare}>
            <Share2 aria-hidden="true" /> Compartilhar resultado
          </GoldButton>
        ) : (
          <GoldButton onClick={handleSpin} disabled={spinning}>
            {spinning ? "Girando…" : "Girar roleta"}
          </GoldButton>
        )}
        {result ? (
          <SecondaryButton
            onClick={() => navigate({ to: "/sorteios/novo" })}
            disabled={spinning}
            className={spinning ? "invisible" : ""}
          >
            <Plus aria-hidden="true" /> Novo sorteio
          </SecondaryButton>
        ) : canSpin ? (
          <SecondaryButton onClick={() => navigate({ to: "/nomes" })} disabled={spinning}>
            <Pencil aria-hidden="true" /> Editar nomes
          </SecondaryButton>
        ) : (
          <div className="h-11" />
        )}
      </div>
    </div>
  );
}

function RoletaSkeleton() {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col" aria-busy="true">
      <div className="h-16" />
      <div className="mx-4 h-[4.5rem] rounded-2xl bg-card" />
      <div className="wheel-box flex min-h-0 flex-1 items-center justify-center px-4 pb-2 pt-5">
        <div className="wheel-size rounded-full bg-card" />
      </div>
      <div className="px-4 pb-2">
        <div className="h-14 rounded-2xl bg-card" />
        <div className="h-12" />
      </div>
    </div>
  );
}
