import { AlertTriangle, Camera, Disc3, Loader2, Mic, MicOff, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GoldButton, SecondaryButton } from "./GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { availableModes, needsFor } from "@/lib/enigma/capture";
import {
  CAMERA_PROBLEM_TEXT,
  canRecord,
  openMedia,
  stopStream,
  type CameraProblem,
} from "@/lib/enigma/recorder";
import { RECORDING_MODES, type RecordingMode } from "@/lib/enigma/types";

type Choice = { mode: RecordingMode; mic: boolean };
type View =
  | { kind: "choose" }
  | { kind: "asking" }
  | { kind: "ready"; stream: MediaStream | null }
  | { kind: "problem"; problem: CameraProblem; offers: Choice[] };

const MODE_ORDER: RecordingMode[] = ["roleta-camera", "roleta-voz", "voz"];
const HELP: Record<RecordingMode, string> = {
  "roleta-camera": "Roleta, rosto em círculo e voz.",
  "roleta-voz": "Vídeo só com a roleta e o resultado.",
  voz: "Arquivo de áudio com a sua voz.",
};
const label = (m: RecordingMode) => RECORDING_MODES.find((x) => x.id === m)?.label ?? m;

/**
 * "Gravar comigo" (E07): pick a mode, then only the devices that mode needs are asked
 * for. The face and the microphone level can be checked before "Começar gravação".
 */
export function CameraDialog({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (choice: Choice, stream: MediaStream | null) => void;
}) {
  const [choice, setChoice] = useState<Choice>({ mode: "roleta-camera", mic: true });
  const [view, setView] = useState<View>({ kind: "choose" });
  const streamRef = useRef<MediaStream | null>(null);
  const handedOver = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const release = () => {
    if (!handedOver.current) stopStream(streamRef.current);
    streamRef.current = null;
  };

  useEffect(() => {
    if (open) {
      handedOver.current = false;
      setView({ kind: "choose" });
    } else release();
    return release;
  }, [open]);

  useEffect(() => {
    const el = videoRef.current;
    if (el && view.kind === "ready" && view.stream?.getVideoTracks().length) {
      el.srcObject = view.stream;
      void el.play().catch(() => undefined);
    }
  }, [view]);

  const ask = async (c: Choice) => {
    release();
    handedOver.current = false;
    setChoice(c);
    if (!canRecord()) {
      setView({ kind: "problem", problem: "unsupported", offers: [] });
      return;
    }
    const needs = needsFor(c.mode, c.mic);
    setView({ kind: "asking" });
    const r = await openMedia(needs);
    if (r.ok) {
      streamRef.current = r.stream;
      setView({ kind: "ready", stream: r.stream });
      return;
    }
    // What is still worth offering: without the camera first, then without the microphone.
    const allowed = { camera: false, mic: needs.camera && needs.mic };
    const offers = availableModes(allowed).filter((o) => !(o.mode === c.mode && o.mic === c.mic));
    if (!offers.some((o) => o.mode === "roleta-voz" && !o.mic))
      offers.push({ mode: "roleta-voz", mic: false });
    setView({ kind: "problem", problem: r.problem, offers });
  };

  const isVideo = choice.mode !== "voz";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="enigma-camera-dialog max-h-[92dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Gravar comigo</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {view.kind === "choose"
              ? "Escolha o que vai ficar na gravação."
              : view.kind === "problem"
                ? "Não deu para gravar desse jeito."
                : label(choice.mode)}
          </DialogDescription>
        </DialogHeader>

        {view.kind === "choose" && (
          <>
            <div role="radiogroup" aria-label="Modo de gravação" className="enigma-capture-modes space-y-2">
              {MODE_ORDER.map((m) => (
                <button
                  key={m}
                  role="radio"
                  aria-checked={choice.mode === m}
                  onClick={() => setChoice((c) => ({ mode: m, mic: m === "voz" ? true : c.mic }))}
                  className={`enigma-capture-option w-full rounded-2xl border-2 p-3 text-left ${
                    choice.mode === m ? "border-gold bg-card" : "border-border bg-secondary"
                  }`}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <span className="enigma-capture-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
                      {m === "roleta-camera" ? (
                        <Camera className="h-5 w-5 text-gold" />
                      ) : m === "roleta-voz" ? (
                        <Disc3 className="h-5 w-5 text-gold" />
                      ) : (
                        <Mic className="h-5 w-5 text-gold" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-lg font-extrabold leading-tight">{label(m)}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{HELP[m]}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {isVideo && (
              <button
                role="switch"
                aria-checked={choice.mic}
                onClick={() => setChoice((c) => ({ ...c, mic: !c.mic }))}
                className="enigma-capture-mic flex h-12 w-full items-center justify-between rounded-xl bg-secondary px-3 font-bold"
              >
                <span className="flex items-center gap-2">
                  {choice.mic ? (
                    <Mic className="h-5 w-5 text-gold" aria-hidden="true" />
                  ) : (
                    <MicOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  )}
                  Microfone
                </span>
                <span className={choice.mic ? "text-gold" : "text-muted-foreground"}>
                  {choice.mic ? "Ligado" : "Desligado"}
                </span>
              </button>
            )}
            <GoldButton onClick={() => void ask(choice)}>Continuar</GoldButton>
            <SecondaryButton onClick={onClose} className="enigma-capture-cancel">Cancelar</SecondaryButton>
          </>
        )}

        {view.kind === "problem" && (
          <>
            <p
              className="flex gap-2 rounded-2xl border-2 border-gold/60 bg-card p-3 text-base"
              role="alert"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
              {CAMERA_PROBLEM_TEXT[view.problem]}
            </p>
            {view.offers.length > 0 && (
              <p className="text-sm font-bold text-muted-foreground">
                Você ainda pode gravar assim:
              </p>
            )}
            {view.offers.map((o) => (
              <SecondaryButton key={`${o.mode}-${o.mic}`} onClick={() => void ask(o)}>
                {label(o.mode)}
                {o.mode !== "voz" ? (o.mic ? " com microfone" : " sem microfone") : ""}
              </SecondaryButton>
            ))}
            {view.problem !== "unsupported" && (
              <SecondaryButton onClick={() => void ask(choice)}>
                <RotateCcw aria-hidden="true" /> Tentar de novo
              </SecondaryButton>
            )}
            <GoldButton onClick={onClose}>Continuar sem gravar</GoldButton>
          </>
        )}

        {(view.kind === "asking" || view.kind === "ready") && (
          <>
            {choice.mode === "roleta-camera" && (
              <div className="mx-auto flex aspect-square w-48 items-center justify-center overflow-hidden rounded-full border-4 border-gold bg-card">
                {view.kind === "ready" ? (
                  <video
                    ref={videoRef}
                    muted
                    playsInline
                    autoPlay
                    className="h-full w-full -scale-x-100 object-cover"
                    aria-label="Prévia da câmera"
                  />
                ) : (
                  <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden="true" />
                )}
              </div>
            )}
            {view.kind === "asking" && choice.mode !== "roleta-camera" && (
              <p className="flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-gold" aria-hidden="true" /> Abrindo…
              </p>
            )}
            {view.kind === "ready" && view.stream?.getAudioTracks().length ? (
              <MicMeter stream={view.stream} />
            ) : view.kind === "ready" ? (
              <p className="text-center text-sm text-muted-foreground">
                Microfone desligado: só a música entra.
              </p>
            ) : null}
            <GoldButton
              disabled={view.kind !== "ready"}
              onClick={() => {
                if (view.kind !== "ready") return;
                handedOver.current = true;
                onStart(choice, view.stream);
              }}
            >
              <Camera aria-hidden="true" /> Começar gravação
            </GoldButton>
            <SecondaryButton
              onClick={() => {
                release();
                setView({ kind: "choose" });
              }}
            >
              Trocar modo
            </SecondaryButton>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Teste o microfone": a bar that moves with the voice. Uses its own audio context. */
function MicMeter({ stream }: { stream: MediaStream }) {
  const barRef = useRef<HTMLSpanElement>(null);
  const [heard, setHeard] = useState(false);
  useEffect(() => {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    let a: AudioContext;
    try {
      a = new Ctor();
    } catch {
      return;
    }
    const src = a.createMediaStreamSource(new MediaStream(stream.getAudioTracks()));
    const an = a.createAnalyser();
    an.fftSize = 512;
    src.connect(an);
    const buf = new Uint8Array(an.fftSize);
    let raf = 0;
    const tick = () => {
      an.getByteTimeDomainData(buf);
      let peak = 0;
      for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      const level = Math.min(1, peak / 64);
      if (barRef.current) barRef.current.style.width = `${Math.round(level * 100)}%`;
      if (level > 0.15) setHeard(true);
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      void a.close().catch(() => undefined);
    };
  }, [stream]);
  return (
    <div className="space-y-1">
      <p className="flex items-center gap-2 text-sm font-bold">
        <Mic className="h-4 w-4 text-gold" aria-hidden="true" />
        {heard ? "Microfone funcionando" : "Fale algo para testar o microfone"}
      </p>
      <div className="h-3 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
        <span
          ref={barRef}
          className="block h-full w-0 rounded-full bg-gold transition-[width] duration-75"
        />
      </div>
    </div>
  );
}
