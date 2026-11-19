import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  Camera,
  ClipboardCheck,
  ListChecks,
  ListOrdered,
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
import { ImageButton } from "@/components/enigma/ImageShare";
import { ResultShareDialog } from "@/components/enigma/ResultShare";
import { WinnerArtDialog } from "@/components/enigma/WinnerArt";
import type { WinnerChoice } from "@/lib/enigma/cards";
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
import {
  formatDateBR,
  newId,
  pickWinnerIndex,
  secureRandom,
  targetRotation,
} from "@/lib/enigma/logic";
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
  isRecording,
  cancelRecording,
  useRecorder,
  type RecFrame,
} from "@/lib/enigma/recorder";
import {
  allRoundsDone,
  drawResultMessage,
  needsRepeatAnswer,
  poolFor,
  roundIdOf,
  roundLabel,
  roundsOf,
  shownRound,
  withRoundResult,
} from "@/lib/enigma/rounds";
import { playReveal, prefersReducedMotion, startSpinTrack, stopAllSound, unlockSound } from "@/lib/enigma/sound";
import { clampVolume } from "@/lib/enigma/jingle";
import { numberedList, numberedPool, wheelLabels, winnerNumber } from "@/lib/enigma/numbers";
import { NumberedListDialog } from "@/components/enigma/NumberedListDialog";
import { report } from "@/lib/enigma/feedback";
import { currentDraw, repo, useAppState } from "@/lib/enigma/repo";
import { APP_NAME, GROUP_NAME, MIN_NAMES_TO_SPIN, type Recording, type RecordingMode } from "@/lib/enigma/types";
import { keepRecording } from "@/lib/enigma/recording-save";
import { videoFileName } from "@/lib/enigma/videos";

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
/** With reduced motion the wheel only eases the last few degrees into the saved result. */
const CALM_MS = 700;

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
  // "Compartilhar arte do ganhador": which picture opens first (null = closed).
  const [art, setArt] = useState<WinnerChoice | null>(null);
  const [repeatAsk, setRepeatAsk] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const rec = useRecorder();
  const endRef = useRef<((leaving?: boolean) => Promise<void>) | null>(null);
  // Leaving the Roleta ends the recording, keeps the file and frees camera and microphone.
  useEffect(
    () => () => {
      if (isRecording()) void endRef.current?.(true);
    },
    [],
  );
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
      stopAllSound();
    };
  }, []);

  // A simulated test left running by an older version is filed under its draw.
  const staleTest = !!state?.recording;
  useEffect(() => {
    if (staleTest) void repo.closeLegacyTest(Date.now());
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
    stopAllSound();
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
  // Public numbers come from the confirmed list and stay the same on every courtesy.
  const numbered = numberedPool(draw, ri);
  const labels = wheelLabels(numbered);
  const result = round.result;
  const resultNumber = winnerNumber(draw, result);
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
    labels,
    rotation: result?.rotation ?? 0,
    spin: spinning ? spinFrameRef.current : null,
    winner: showResult && result ? result.winner : null,
    winnerNumber: showResult ? resultNumber : null,
    summary:
      summaryOpen && done
        ? rounds.map((r) => ({
            prize: r.prize,
            merchant: r.merchantName,
            winner: r.result?.winner ?? "",
          }))
        : null,
  };

  const doSpin = (repeat?: boolean) => {
    if (spinningRef.current || result || !canSpin) return;
    spinningRef.current = true;
    if (state.sound) unlockSound();
    const wheelNames =
      repeat === undefined ? pool : poolFor({ ...draw, repeatWinners: repeat }, ri);
    const index = pickWinnerIndex(wheelNames.length);
    const rotation = targetRotation(0, index, wheelNames.length, secureRandom());
    const winner = wheelNames[index] ?? "";
    // Save the result first; the wheel only turns after the save is confirmed.
    const roundId = roundIdOf(draw, ri) ?? "";
    void repo
      .spin({
        drawId: draw.id,
        roundId,
        pool: wheelNames,
        repeatWinners: repeat,
        result: { winner, index, rotation, at: Date.now() },
      })
      .then((r) => {
        if (!report(r, () => doSpin(repeat)) || r.value.status !== "saved") {
          // A result already saved for this courtesy is shown as it is; nothing turns.
          spinningRef.current = false;
          return;
        }
        const calm = prefersReducedMotion();
        const to = r.value.result.rotation;
        const from = calm ? to - 20 : 0;
        const durationMs = calm ? CALM_MS : SPIN_MS;
        spinFrameRef.current = { from, to, startedAt: performance.now(), durationMs };
        // The music starts with the animation of the saved result, never before.
        if (state.sound && !calm) startSpinTrack(durationMs, clampVolume(state.volume));
        setSpin({ from, durationMs, key: Date.now() });
      });
  };

  const handleSpin = () => {
    if (needsRepeatAnswer(draw)) {
      setRepeatAsk(true);
      return;
    }
    doSpin();
  };

  const answerRepeat = (yes: boolean) => {
    // The answer is saved together with the first result, so a refused save can be tried again.
    setRepeatAsk(false);
    doSpin(yes);
  };

  const handleSpinEnd = () => {
    spinningRef.current = false;
    spinFrameRef.current = null;
    setSpin(null);
    stopAllSound();
    if (state.sound) playReveal(clampVolume(state.volume));
    if (multi && isLast) setSummaryOpen(true);
  };

  const handleStartRecording = (choice: { mode: RecordingMode; mic: boolean }, stream: MediaStream | null) => {
    setCameraOpen(false);
    const started =
      !!frameRef.current &&
      startRecording({
        mode: choice.mode,
        mic: choice.mic,
        stream,
        drawId: draw.id,
        frame: frameRef.current,
        sound: state.sound,
        volume: clampVolume(state.volume),
      });
    if (!started) {
      stopStream(stream);
      toast.error("Este celular não conseguiu começar a gravação. Você pode girar sem gravar.");
    }
  };

  const handleEndRecording = async (leaving = false) => {
    if (stopping && !leaving) return;
    setStopping(true);
    const out = await stopRecording();
    setStopping(false);
    if (!out) return;
    // Winners come from the saved results, never from the recording.
    const decided = rounds
      .filter((r) => r.result && r.result.at >= out.startedAt)
      .map((r) => ({ prize: r.prize, merchant: r.merchantName, winner: r.result?.winner ?? "" }));
    const recording: Recording = {
      id: newId(),
      mode: out.mode,
      mic: out.mode === "voz" ? true : out.mic,
      startedAt: out.startedAt,
      durationMs: out.durationMs,
      real: true,
      mimeType: out.mimeType,
      size: out.blob.size,
      rounds: decided,
      ...(decided[0] ? { winner: decided[0].winner } : {}),
    };
    const saved = await keepRecording(draw.id, recording, out.blob);
    if (leaving) {
      if (saved) toast.success("Gravação guardada em Sorteios.");
      else toast.error("A gravação não foi guardada. Abra a Roleta de novo antes de gravar outra.");
      return;
    }
    setVideoDone({
      blob: out.blob,
      filename: videoFileName(draw.date, out.mimeType, draw.recordings?.length ?? 0),
      recording,
      saved,
      drawId: draw.id,
    });
  };
  endRef.current = handleEndRecording;

  // Built from the saved results of the round on the wheel, never from a new spin.
  const message = drawResultMessage(draw, state.merchants, GROUP_NAME);

  const goldButton = (() => {
    if (!result && (dirty || count < MIN_NAMES_TO_SPIN)) {
      if (dirty && readyCount >= MIN_NAMES_TO_SPIN) {
        return (
          <GoldButton
            onClick={() => {
              exitFull();
              navigate({ to: "/nomes" });
            }}
          >
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
        <GoldButton
          onClick={() => {
            exitFull();
            navigate({ to: "/nomes" });
          }}
        >
          <UserPlus aria-hidden="true" /> Adicionar nomes
        </GoldButton>
      );
    }
    if (showResult && !isLast) {
      return (
        <GoldButton
          onClick={() => {
            const id = roundIdOf(draw, ri) ?? "";
            void repo.nextRound(draw.id, id).then((r) => report(r));
          }}
          className={showRecordButton ? "px-2 text-lg leading-tight" : ""}
        >
          <SkipForward className="shrink-0" aria-hidden="true" /> Sortear próxima cortesia
        </GoldButton>
      );
    }
    if (showResult && multi) {
      return (
        <GoldButton
          onClick={() => setSummaryOpen(true)}
          className={recording ? "px-2 text-lg" : ""}
        >
          <ListChecks className="shrink-0" aria-hidden="true" /> Ver resumo
        </GoldButton>
      );
    }
    if (showResult) {
      return (
        <GoldButton
          onClick={() => setShareOpen(true)}
          className={recording ? "px-2 text-lg leading-tight" : ""}
        >
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
          <p
            className="font-display text-lg font-bold leading-snug text-gold"
            data-testid="prize-label"
          >
            {multi ? roundLabel(ri, total, round.prize) : round.prize}
          </p>
        </div>
      </section>

      <div className="mt-1 flex h-9 items-center gap-2 px-4 text-xs text-muted-foreground">
        <p
          className={
            full
              ? "flex min-w-0 flex-1 items-center justify-center gap-2"
              : "flex min-w-0 flex-1 items-center gap-2"
          }
        >
          {(full || !draw.isSample) && <span className="truncate">{APP_NAME} ·</span>}
          <span className="shrink-0 font-semibold">{formatDateBR(draw.date)}</span>
          {draw.isSample && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-semibold">
              Sorteio de teste
            </span>
          )}
        </p>
        {count > 0 && (
          <button
            onClick={() => setListOpen(true)}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-secondary px-3 text-sm font-bold text-foreground active:bg-accent"
          >
            <ListOrdered className="h-4 w-4 text-gold" aria-hidden="true" /> Lista
          </button>
        )}
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
            <div className="flex items-center gap-1.5">
              <RecIndicator startedAt={rec.startedAt} />
              <span className="rounded-full bg-nav/90 px-2 py-1 text-xs font-bold">
                {rec.mode === "voz" ? "Só voz" : rec.mode === "roleta-camera" ? "Com rosto" : "Só roleta"}
                {rec.mode !== "voz" && !rec.mic ? " · sem micro" : ""}
              </span>
              <button
                onClick={() => {
                  if (window.confirm("Cancelar a gravação? O vídeo será descartado. O resultado do sorteio continua salvo.")) {
                    cancelRecording();
                    toast("Gravação cancelada.");
                  }
                }}
                disabled={spinning || stopping}
                className="rounded-full bg-nav/90 px-2 py-1 text-xs font-bold text-muted-foreground underline disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        <Wheel
          key={`${draw.id}-${ri}`}
          names={pool}
          rotation={result?.rotation ?? 0}
          spin={spin}
          labels={labels}
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
              <p
                className="mt-1 break-words font-display text-4xl font-extrabold leading-tight"
                data-testid="winner"
              >
                {resultNumber !== null && (
                  <span className="block text-2xl text-gold" data-testid="winner-number">
                    Nº {resultNumber}
                  </span>
                )}
                {result.winner}
              </p>
              <p className="mt-3 font-display text-lg font-bold text-gold">{round.prize}</p>
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
          spinning ? (
            hint("")
          ) : (
            <SecondaryButton onClick={() => setArt(ri)}>
              <Trophy className="text-gold" aria-hidden="true" /> Compartilhar arte do ganhador
            </SecondaryButton>
          )
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
            <SecondaryButton
              onClick={() => navigate({ to: "/nomes" })}
              disabled={spinning}
              className="px-2 text-[15px]"
            >
              Editar nomes
            </SecondaryButton>
            <SecondaryButton
              onClick={() => setInviteOpen(true)}
              disabled={spinning}
              className="whitespace-nowrap px-2 text-[15px]"
            >
              <Send aria-hidden="true" /> Convidar para assistir
            </SecondaryButton>
          </div>
        ) : (
          <div className="h-11" />
        )}
      </div>

      <NumberedListDialog
        open={listOpen}
        onClose={() => setListOpen(false)}
        list={numberedList(draw)}
        onWheel={new Set(numbered.map((n) => n.number))}
        highlight={showResult ? resultNumber : null}
      />

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
              Este sorteio tem {total} cortesias. Se for “Não”, quem ganhar sai da roleta nas
              próximas rodadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => answerRepeat(true)}
              className="h-14 rounded-2xl bg-secondary text-lg font-bold active:bg-accent"
            >
              Sim
            </button>
            <button
              onClick={() => answerRepeat(false)}
              className="h-14 rounded-2xl bg-secondary text-lg font-bold active:bg-accent"
            >
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
                <p className="font-display font-bold text-gold">{r.prize}</p>
                <p className="mt-1 flex items-center gap-1.5 font-display text-xl font-extrabold">
                  <Trophy className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />{" "}
                  {winnerNumber(draw, r.result) !== null && (
                    <span className="text-gold">Nº {winnerNumber(draw, r.result)}</span>
                  )}
                  {r.result?.winner}
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
          <ImageButton
            label="Compartilhar arte do ganhador"
            onClick={() => {
              setSummaryOpen(false);
              setArt("resumo");
            }}
          />
        </DialogContent>
      </Dialog>

      <ResultShareDialog
        text={shareOpen ? message : null}
        onClose={() => setShareOpen(false)}
        {...(multi ? { title: "Compartilhar no WhatsApp" } : {})}
        extra={
          <ImageButton
            label="Compartilhar arte do ganhador"
            onClick={() => {
              setShareOpen(false);
              setArt(multi ? "resumo" : 0);
            }}
          />
        }
      />
      <WinnerArtDialog
        open={art !== null}
        onClose={() => setArt(null)}
        draw={draw}
        merchants={state.merchants}
        groupLogo={state.groupLogo}
        initial={art ?? 0}
      />
      <CameraDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onStart={handleStartRecording}
      />
      <VideoDoneDialog video={videoDone} onClose={() => setVideoDone(null)} />
    </div>
  );
}

function RoletaSkeleton() {
  return (
    <div
      className="flex h-[calc(100dvh_-_4rem_-_env(safe-area-inset-bottom)_-_env(safe-area-inset-top))] flex-col"
      aria-busy="true"
    >
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
