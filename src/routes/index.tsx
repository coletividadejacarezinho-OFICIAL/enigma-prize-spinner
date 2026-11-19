import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ClipboardCheck,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  Send,
  Square,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { AppHeader } from "@/components/enigma/AppHeader";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { InviteDialog } from "@/components/enigma/InviteDialog";
import { MerchantLogo } from "@/components/enigma/Logos";
import { RecIndicator } from "@/components/enigma/RecIndicator";
import { RecordSheet } from "@/components/enigma/RecordSheet";
import { RecordingDoneDialog } from "@/components/enigma/RecordingDone";
import { ResultShareDialog } from "@/components/enigma/ResultShare";
import { Wheel } from "@/components/enigma/Wheel";
import { entriesOf, needsConfirmation, readyEntries } from "@/lib/enigma/entries";
import {
  formatDateBR,
  merchantOf,
  micFor,
  pickWinnerIndex,
  secureRandom,
  resultMessage,
  targetRotation,
} from "@/lib/enigma/logic";
import {
  exitDeviceFullscreen,
  requestDeviceFullscreen,
  setPresentation,
  usePresentation,
} from "@/lib/enigma/presentation";
import { playTick, playWin, unlockSound } from "@/lib/enigma/sound";
import {
  currentDraw,
  endRecording,
  startRecording,
  updateDraw,
  useAppState,
} from "@/lib/enigma/store";
import { APP_NAME, GROUP_NAME, MIN_NAMES_TO_SPIN, type Recording } from "@/lib/enigma/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Roleta — Enigma Premiado" },
      {
        name: "description",
        content:
          "Gire a roleta do Enigma Premiado da Coletividade Jacarezinho PR e veja o ganhador.",
      },
      { property: "og:title", content: "Roleta — Enigma Premiado" },
      {
        property: "og:description",
        content:
          "Gire a roleta do Enigma Premiado da Coletividade Jacarezinho PR e veja o ganhador.",
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
  const [recordOpen, setRecordOpen] = useState(false);
  const [done, setDone] = useState<{ recording: Recording; drawId: string } | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  // Full screen only changes what is shown around the same wheel, so a spin in progress,
  // the names and the saved result are untouched when entering or leaving it.
  const full = usePresentation();
  const deviceFsRef = useRef(false);

  useEffect(() => {
    const onChange = () => {
      // Leaving the device's full screen (back gesture, Esc) also leaves the Roleta's.
      if (!document.fullscreenElement && deviceFsRef.current) {
        deviceFsRef.current = false;
        setPresentation(false);
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      setPresentation(false);
      deviceFsRef.current = false;
      void exitDeviceFullscreen();
    };
  }, []);

  const enterFull = () => {
    setPresentation(true);
    void requestDeviceFullscreen().then((ok) => {
      deviceFsRef.current = ok;
    });
  };

  const exitFull = () => {
    deviceFsRef.current = false;
    setPresentation(false);
    void exitDeviceFullscreen();
  };

  if (!state) return <RoletaSkeleton />;

  const draw = currentDraw(state);
  const shop = merchantOf(state.merchants, draw);
  const count = draw.names.length;
  const result = draw.result;
  const spinning = spin !== null;
  const showResult = !!result && !spinning;
  // The wheel only uses the confirmed list; a list changed in Nomes must be confirmed again.
  const dirty = needsConfirmation(draw);
  const readyCount = readyEntries(entriesOf(draw)).length;
  const canSpin = count >= MIN_NAMES_TO_SPIN && !dirty;
  const session = state.recording?.drawId === draw.id ? state.recording : undefined;
  const recording = !!session;
  const showRecordButton = recording || (!full && canSpin && !result);

  const handleStartRecording = (mode: Parameters<typeof micFor>[0], mic: boolean) => {
    startRecording({ drawId: draw.id, mode, mic: micFor(mode, mic), startedAt: Date.now() });
    setRecordOpen(false);
  };

  const handleEndRecording = () => {
    const rec = endRecording(Date.now());
    if (rec) setDone({ recording: rec, drawId: draw.id });
  };

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

  // Built from the saved result of the round on the wheel, never from a new spin.
  const message = showResult ? resultMessage(draw, shop.name, GROUP_NAME) : null;

  return (
    <div
      className={
        full
          ? "flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "flex h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] flex-col"
      }
    >
      <AppHeader
        logo={state.groupLogo}
        subtitle={`${count} ${count === 1 ? "participante" : "participantes"}`}
      />

      <section className="mx-4 flex items-center gap-3 rounded-2xl bg-card p-3">
        <MerchantLogo src={shop.logo} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Oferecimento: <span className="font-bold text-foreground">{shop.name}</span>
          </p>
          <p className="font-display text-lg font-bold leading-snug text-gold">{draw.prize}</p>
        </div>
      </section>

      <div className="mt-1 flex h-9 items-center gap-2 px-4 text-xs text-muted-foreground">
        <p className={full ? "flex min-w-0 flex-1 items-center justify-center gap-2" : "flex min-w-0 flex-1 items-center gap-2"}>
          {(full || !draw.isSample) && <span className="truncate">{APP_NAME} ·</span>}
          <span className="shrink-0 font-semibold">{formatDateBR(draw.date)}</span>
          {draw.isSample && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-semibold">
              Sorteio de teste
            </span>
          )}
        </p>
        {!full && (
          <button
            onClick={enterFull}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-bold text-foreground active:bg-accent"
          >
            <Maximize2 className="h-4 w-4 text-gold" aria-hidden="true" /> Tela cheia
          </button>
        )}
      </div>

      <div className="wheel-box relative flex min-h-0 flex-1 items-center justify-center px-4 pb-2 pt-4">
        {session && (
          <div className="absolute left-4 top-1 z-20">
            <RecIndicator startedAt={session.startedAt} />
          </div>
        )}
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
              <p className="text-sm text-muted-foreground">Oferecimento: {shop.name}</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1 px-4 pb-2">
        <div
          className={
            showRecordButton
              ? recording
                ? "grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2"
                : "grid grid-cols-[auto_minmax(0,1fr)] gap-2"
              : ""
          }
        >
          {showRecordButton &&
            (recording ? (
              <button
                onClick={handleEndRecording}
                disabled={spinning}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border-2 border-rec bg-card px-2 text-base font-extrabold leading-tight disabled:opacity-50"
              >
                <Square className="h-4 w-4 shrink-0 fill-rec text-rec" aria-hidden="true" />
                <span>Encerrar gravação</span>
              </button>
            ) : (
              <button
                onClick={() => setRecordOpen(true)}
                disabled={spinning}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-secondary px-4 text-lg font-extrabold active:bg-accent disabled:opacity-50"
              >
                <Camera className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" /> Gravar
              </button>
            ))}
          {!canSpin && !result ? (
            <GoldButton
              onClick={() => {
                exitFull();
                navigate({ to: "/nomes" });
              }}
            >
              {dirty && readyCount >= MIN_NAMES_TO_SPIN ? (
                <>
                  <ClipboardCheck aria-hidden="true" /> Confirmar lista nova
                </>
              ) : (
                <>
                  <UserPlus aria-hidden="true" /> Adicionar nomes
                </>
              )}
            </GoldButton>
          ) : showResult ? (
            <GoldButton
              onClick={() => setShareOpen(true)}
              className={recording ? "px-2 text-lg leading-tight" : ""}
            >
              <MessageCircle className="shrink-0" aria-hidden="true" /> Mandar no WhatsApp
            </GoldButton>
          ) : (
            <GoldButton onClick={handleSpin} disabled={spinning}>
              {spinning ? "Girando…" : "Girar roleta"}
            </GoldButton>
          )}
        </div>
        {full ? (
          <SecondaryButton onClick={exitFull} className="border border-gold/60">
            <Minimize2 className="text-gold" aria-hidden="true" /> Sair da tela cheia
          </SecondaryButton>
        ) : recording ? (
          <p className="flex h-11 items-center justify-center text-center text-sm font-semibold text-muted-foreground">
            {result
              ? "Ao terminar de falar, toque em Encerrar gravação."
              : "Apresente a cortesia e toque em Girar roleta."}
          </p>
        ) : result ? (
          <SecondaryButton
            onClick={() => navigate({ to: "/sorteios/novo" })}
            disabled={spinning}
            className={spinning ? "invisible" : ""}
          >
            <Plus aria-hidden="true" /> Novo sorteio
          </SecondaryButton>
        ) : dirty && count > 0 ? (
          <p className="flex h-11 items-center justify-center text-center text-sm font-semibold text-muted-foreground">
            A lista mudou em Nomes. Confirme antes de girar.
          </p>
        ) : canSpin ? (
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-1">
            <SecondaryButton onClick={() => navigate({ to: "/nomes" })} disabled={spinning} className="px-2 text-[15px]">
              Editar nomes
            </SecondaryButton>
            <SecondaryButton onClick={() => setInviteOpen(true)} disabled={spinning} className="whitespace-nowrap px-2 text-[15px]">
              <Send aria-hidden="true" /> Convidar para assistir
            </SecondaryButton>
          </div>
        ) : (
          <div className="h-11" />
        )}
      </div>

      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        date={draw.date}
        shopName={shop.name}
        prize={draw.prize}
        onPreview={() => {
          setInviteOpen(false);
          navigate({ to: "/convite/previa", search: { estado: "aguardando" } });
        }}
      />
      <ResultShareDialog text={shareOpen ? message : null} onClose={() => setShareOpen(false)} />
      <RecordSheet open={recordOpen} onOpenChange={setRecordOpen} onStart={handleStartRecording} />
      <RecordingDoneDialog
        recording={done?.recording ?? null}
        date={draw.date}
        merchant={shop.name}
        prize={draw.prize}
        onClose={() => setDone(null)}
        onPreview={() => {
          if (!done) return;
          const params = { drawId: done.drawId, recordingId: done.recording.id };
          setDone(null);
          navigate({ to: "/sorteios/gravacoes/$drawId/$recordingId", params });
        }}
      />
    </div>
  );
}

function RoletaSkeleton() {
  return (
    <div className="flex h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom))] flex-col" aria-busy="true">
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
