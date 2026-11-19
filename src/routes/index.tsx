import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ClipboardCheck,
  ListChecks,
  Maximize2,
  MessageCircle,
  Minimize2,
  Plus,
  Send,
  SkipForward,
  Square,
  Trophy,
  UserPlus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/enigma/AppHeader";
import { CameraDialog } from "@/components/enigma/CameraDialog";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";
import { InviteDialog } from "@/components/enigma/InviteDialog";
import { MerchantLogo } from "@/components/enigma/Logos";
import { RecIndicator } from "@/components/enigma/RecIndicator";
import { ResultShareDialog } from "@/components/enigma/ResultShare";
import { VideoDoneDialog } from "@/components/enigma/VideoActions";
import { Wheel } from "@/components/enigma/Wheel";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { entriesOf, needsConfirmation, readyEntries } from "@/lib/enigma/entries";
import { formatDateBR, newId, pickWinnerIndex, secureRandom, targetRotation } from "@/lib/enigma/logic";
import {
  exitDeviceFullscreen,
  requestDeviceFullscreen,
  setPresentation,
  usePresentation,
} from "@/lib/enigma/presentation";
import {
  setRecFrame,
  startRecording,
  stopRecording,
  stopStream,
  useRecorder,
  type RecFrame,
} from "@/lib/enigma/recorder";
import {
  allRoundsDone,
  drawResultMessage,
  needsRepeatAnswer,
  nextRound,
  poolFor,
  roundLabel,
  roundsOf,
  shownRound,
  withRoundResult,
} from "@/lib/enigma/rounds";
import { playTick, playWin, unlockSound } from "@/lib/enigma/sound";
import { addRecording, currentDraw, endRecording, updateDraw, useAppState } from "@/lib/enigma/store";
import { APP_NAME, GROUP_NAME, MIN_NAMES_TO_SPIN, type Recording } from "@/lib/enigma/types";
import { saveVideo, videoFileName } from "@/lib/enigma/videos";

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
  const spinFrameRef = useRef<RecFrame["spin"]>(null);
  const frameRef = useRef<RecFrame | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [videoDone, setVideoDone] = useState<Parameters<typeof VideoDoneDialog>[0]["video"]>(null);
  const [stopping, setStopping] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [repeatAsk, setRepeatAsk] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const rec = useRecorder();
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

  // A simulated test left running by an older version is filed under its draw.
  const staleTest = !!state?.recording;
  useEffect(() => {
    if (staleTest) endRecording(Date.now());
  }, [staleTest]);

  // While recording, the video always shows what is on screen now.
  useEffect(() => {
    if (rec && frameRef.current) setRecFrame(frameRef.current);
  });

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
  const rounds = roundsOf(draw, state.merchants);
  const total = rounds.length;
  const multi = total > 1;
  const ri = shownRound(draw);
  const round = rounds[ri] ?? rounds[0]!;
  const isLast = ri === total - 1;
  const pool = poolFor(draw, ri);
  const count = pool.length;
  const result = round.result;
  const done = allRoundsDone(draw);
  const spinning = spin !== null;
  const showResult = !!result && !spinning;
  // The wheel only uses the confirmed list; a list changed in Nomes must be confirmed again.
  const dirty = needsConfirmation(draw);
  const readyCount = readyEntries(entriesOf(draw)).length;
  const canSpin = count >= MIN_NAMES_TO_SPIN && !dirty && !result;
  const recording = !!rec;
  const showRecordButton = recording || (!full && !done && !dirty && count >= MIN_NAMES_TO_SPIN);

  frameRef.current = {
    group: GROUP_NAME,
    date: formatDateBR(draw.date),
    roundLabel: multi ? `Prêmio ${ri + 1} de ${total}` : "",
    prize: round.prize,
    merchant: round.merchantName,
    names: pool,
    rotation: result?.rotation ?? 0,
    spin: spinning ? spinFrameRef.current : null,
    winner: showResult && result ? result.winner : null,
    summary:
      summaryOpen && done
        ? rounds.map((r) => ({ prize: r.prize, merchant: r.merchantName, winner: r.result?.winner ?? "" }))
        : null,
  };

  const doSpin = () => {
    if (spinningRef.current || result || !canSpin) return;
    spinningRef.current = true;
    if (state.sound) unlockSound();
    const index = pickWinnerIndex(count);
    const rotation = targetRotation(0, index, count, secureRandom());
    const winner = pool[index] ?? "";
    // Save the result before animating so leaving or reloading keeps the same winner.
    updateDraw(draw.id, (d) => withRoundResult(d, ri, { winner, index, rotation, at: Date.now() }));
    spinFrameRef.current = { from: 0, to: rotation, startedAt: performance.now(), durationMs: SPIN_MS };
    setSpin({ from: 0, durationMs: SPIN_MS, key: Date.now() });
  };

  const handleSpin = () => {
    if (needsRepeatAnswer(draw)) {
      setRepeatAsk(true);
      return;
    }
    doSpin();
  };

  const answerRepeat = (yes: boolean) => {
    updateDraw(draw.id, (d) => ({ ...d, repeatWinners: yes }));
    setRepeatAsk(false);
    doSpin();
  };

  const handleSpinEnd = () => {
    spinningRef.current = false;
    spinFrameRef.current = null;
    setSpin(null);
    if (state.sound) playWin();
    if (multi && isLast) setSummaryOpen(true);
  };

  const handleStartRecording = (stream: MediaStream) => {
    setCameraOpen(false);
    if (!frameRef.current || !startRecording(stream, draw.id, frameRef.current)) {
      stopStream(stream);
      toast.error("Este celular não conseguiu começar a gravação.");
    }
  };

  const handleEndRecording = async () => {
    if (stopping) return;
    setStopping(true);
    const out = await stopRecording();
    setStopping(false);
    if (!out) return;
    const decided = rounds
      .filter((r) => r.result && r.result.at >= out.startedAt)
      .map((r) => ({ prize: r.prize, merchant: r.merchantName, winner: r.result?.winner ?? "" }));
    const recording: Recording = {
      id: newId(),
      mode: "roleta-camera",
      mic: true,
      startedAt: out.startedAt,
      durationMs: out.durationMs,
      real: true,
      mimeType: out.mimeType,
      size: out.blob.size,
      rounds: decided,
      ...(decided[0] ? { winner: decided[0].winner } : {}),
    };
    const saved = (await saveVideo(recording.id, out.blob)) && addRecording(draw.id, recording);
    setVideoDone({
      blob: out.blob,
      filename: videoFileName(draw.date, out.mimeType, draw.recordings?.length ?? 0),
      recording,
      saved,
    });
  };

  // Built from the saved results of the round on the wheel, never from a new spin.
  const message = drawResultMessage(draw, state.merchants, GROUP_NAME);

  const goldButton = (() => {
    if (!result && (dirty || count < MIN_NAMES_TO_SPIN)) {
      if (dirty && readyCount >= MIN_NAMES_TO_SPIN) {
        return (
          <GoldButton onClick={() => { exitFull(); navigate({ to: "/nomes" }); }}>
            <ClipboardCheck aria-hidden="true" /> Confirmar lista nova
          </GoldButton>
        );
      }
      if (ri > 0 && !dirty) {
        return (
          <GoldButton disabled className="text-lg">
            Faltam nomes para esta cortesia
          </GoldButton>
        );
      }
      return (
        <GoldButton onClick={() => { exitFull(); navigate({ to: "/nomes" }); }}>
          <UserPlus aria-hidden="true" /> Adicionar nomes
        </GoldButton>
      );
    }
    if (showResult && !isLast) {
      return (
        <GoldButton
          onClick={() => updateDraw(draw.id, nextRound)}
          className={showRecordButton ? "px-2 text-lg leading-tight" : ""}
        >
          <SkipForward className="shrink-0" aria-hidden="true" /> Sortear próxima cortesia
        </GoldButton>
      );
    }
    if (showResult && multi) {
      return (
        <GoldButton onClick={() => setSummaryOpen(true)} className={recording ? "px-2 text-lg" : ""}>
          <ListChecks className="shrink-0" aria-hidden="true" /> Ver resumo
        </GoldButton>
      );
    }
    if (showResult) {
      return (
        <GoldButton onClick={() => setShareOpen(true)} className={recording ? "px-2 text-lg leading-tight" : ""}>
          <MessageCircle className="shrink-0" aria-hidden="true" /> Mandar no WhatsApp
        </GoldButton>
      );
    }
    return (
      <GoldButton onClick={handleSpin} disabled={spinning}>
        {spinning ? "Girando…" : "Girar roleta"}
      </GoldButton>
    );
  })();

  const hint = (text: string) => (
    <p className="flex h-11 items-center justify-center text-center text-sm font-semibold leading-tight text-muted-foreground">
      {text}
    </p>
  );

  return (
    <div
      className={
        full
          ? "flex h-dvh flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
          : "flex h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom)_-_env(safe-area-inset-top))] flex-col"
      }
    >
      <AppHeader
        logo={state.groupLogo}
        subtitle={`${count} ${count === 1 ? "participante" : "participantes"}`}
      />

      <section className="mx-4 flex items-center gap-3 rounded-2xl bg-card p-3">
        <MerchantLogo src={round.merchantLogo} className="h-12 w-12" />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">
            Oferecimento: <span className="font-bold text-foreground">{round.merchantName}</span>
          </p>
          <p className="font-display text-lg font-bold leading-snug text-gold" data-testid="prize-label">
            {multi ? roundLabel(ri, total, round.prize) : round.prize}
          </p>
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
        {rec && (
          <div className="absolute left-4 top-1 z-20">
            <RecIndicator startedAt={rec.startedAt} />
          </div>
        )}
        <Wheel
          key={`${draw.id}-${ri}`}
          names={pool}
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
                {multi ? ` · Prêmio ${ri + 1} de ${total}` : ""}
              </p>
              <p className="mt-1 break-words font-display text-4xl font-extrabold leading-tight" data-testid="winner">
                {result.winner}
              </p>
              <p className="mt-3 text-base font-bold text-gold">{round.prize}</p>
              <p className="text-sm text-muted-foreground">Oferecimento: {round.merchantName}</p>
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
                onClick={() => void handleEndRecording()}
                disabled={spinning || stopping}
                className="flex h-14 items-center justify-center gap-1.5 rounded-2xl border-2 border-rec bg-card px-2 text-base font-extrabold leading-tight disabled:opacity-50"
              >
                <Square className="h-4 w-4 shrink-0 fill-rec text-rec" aria-hidden="true" />
                <span>{stopping ? "Encerrando…" : "Encerrar gravação"}</span>
              </button>
            ) : (
              <button
                onClick={() => setCameraOpen(true)}
                disabled={spinning}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-secondary px-3 text-base font-extrabold leading-tight active:bg-accent disabled:opacity-50"
              >
                <Camera className="h-6 w-6 shrink-0 text-gold" aria-hidden="true" /> Gravar comigo
              </button>
            ))}
          {goldButton}
        </div>
        {full ? (
          <SecondaryButton onClick={exitFull} className="border border-gold/60">
            <Minimize2 className="text-gold" aria-hidden="true" /> Sair da tela cheia
          </SecondaryButton>
        ) : recording ? (
          hint(
            result
              ? isLast
                ? "Ao terminar de falar, toque em Encerrar gravação."
                : "Quando quiser, toque em Sortear próxima cortesia."
              : "Fale com o público e toque em Girar roleta.",
          )
        ) : done ? (
          <SecondaryButton
            onClick={() => navigate({ to: "/sorteios/novo" })}
            disabled={spinning}
            className={spinning ? "invisible" : ""}
          >
            <Plus aria-hidden="true" /> Novo sorteio
          </SecondaryButton>
        ) : result ? (
          hint(spinning ? "" : `Ganhador(a) guardado. Falta ${total - ri - 1 === 1 ? "1 cortesia" : `${total - ri - 1} cortesias`}.`)
        ) : dirty && count > 0 ? (
          hint("A lista mudou em Nomes. Confirme antes de girar.")
        ) : canSpin && ri > 0 ? (
          hint(
            draw.repeatWinners === false
              ? `${count} nomes nesta rodada: quem já ganhou saiu da roleta.`
              : `${count} nomes nesta rodada.`,
          )
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
        shopName={round.merchantName}
        prize={round.prize}
        onPreview={() => {
          setInviteOpen(false);
          navigate({ to: "/convite/previa", search: { estado: "aguardando" } });
        }}
      />

      <AlertDialog open={repeatAsk} onOpenChange={setRepeatAsk}>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-2xl border-border bg-card sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display text-2xl leading-tight">
              Quem ganhar pode ganhar de novo neste sorteio?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground">
              Este sorteio tem {total} cortesias. Se for “Não”, quem ganhar sai da roleta nas próximas rodadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => answerRepeat(true)} className="h-14 rounded-2xl bg-secondary text-lg font-bold active:bg-accent">
              Sim
            </button>
            <button onClick={() => answerRepeat(false)} className="h-14 rounded-2xl bg-secondary text-lg font-bold active:bg-accent">
              Não
            </button>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={summaryOpen && done && !spinning} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Resumo do sorteio</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {formatDateBR(draw.date)} · {total} cortesias
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-2" data-testid="summary">
            {rounds.map((r) => (
              <li key={r.index} className="rounded-2xl bg-card p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Prêmio {r.index + 1} · {r.merchantName}
                </p>
                <p className="font-bold text-gold">{r.prize}</p>
                <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-extrabold">
                  <Trophy className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" /> {r.result?.winner}
                </p>
              </li>
            ))}
          </ol>
          <GoldButton
            className="px-3 text-lg"
            onClick={() => {
              setSummaryOpen(false);
              setShareOpen(true);
            }}
          >
            <MessageCircle aria-hidden="true" /> Compartilhar no WhatsApp
          </GoldButton>
        </DialogContent>
      </Dialog>

      <ResultShareDialog
        text={shareOpen ? message : null}
        onClose={() => setShareOpen(false)}
        {...(multi ? { title: "Compartilhar no WhatsApp" } : {})}
      />
      <CameraDialog open={cameraOpen} onClose={() => setCameraOpen(false)} onStart={handleStartRecording} />
      <VideoDoneDialog video={videoDone} onClose={() => setVideoDone(null)} />
    </div>
  );
}

function RoletaSkeleton() {
  return (
    <div className="flex h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom)_-_env(safe-area-inset-top))] flex-col" aria-busy="true">
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
