import { AlertTriangle, Camera, Loader2, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GoldButton, SecondaryButton } from "./GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CAMERA_PROBLEM_TEXT, openCamera, stopStream, type CameraProblem } from "@/lib/enigma/recorder";

type View = { kind: "asking" } | { kind: "ready"; stream: MediaStream } | { kind: "problem"; problem: CameraProblem };

/**
 * "Gravar comigo": asks for the front camera and microphone, shows the face so the
 * person can get in position, then hands the stream over with "Começar gravação".
 */
export function CameraDialog({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (stream: MediaStream) => void;
}) {
  const [view, setView] = useState<View>({ kind: "asking" });
  const [attempt, setAttempt] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const handedOver = useRef(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let opened: MediaStream | null = null;
    handedOver.current = false;
    setView({ kind: "asking" });
    void openCamera().then((r) => {
      if (!alive) {
        if (r.ok) stopStream(r.stream);
        return;
      }
      if (r.ok) {
        opened = r.stream;
        setView({ kind: "ready", stream: r.stream });
      } else setView({ kind: "problem", problem: r.problem });
    });
    return () => {
      alive = false;
      if (opened && !handedOver.current) stopStream(opened);
    };
  }, [open, attempt]);

  useEffect(() => {
    const el = videoRef.current;
    if (el && view.kind === "ready") {
      el.srcObject = view.stream;
      void el.play().catch(() => undefined);
    }
  }, [view]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Gravar comigo</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {view.kind === "problem"
              ? "Não deu para abrir a câmera ou o microfone."
              : "Ajeite o rosto no círculo. Você pode falar antes de girar e durante o sorteio."}
          </DialogDescription>
        </DialogHeader>

        {view.kind === "problem" ? (
          <>
            <p className="flex gap-2 rounded-2xl border-2 border-gold/60 bg-card p-3 text-base" role="alert">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-gold" aria-hidden="true" />
              {CAMERA_PROBLEM_TEXT[view.problem]}
            </p>
            <GoldButton onClick={() => setAttempt((a) => a + 1)}>
              <RotateCcw aria-hidden="true" /> Tentar novamente
            </GoldButton>
            <SecondaryButton onClick={onClose}>Continuar sem gravar</SecondaryButton>
          </>
        ) : (
          <>
            <div className="mx-auto flex aspect-square w-56 items-center justify-center overflow-hidden rounded-full border-4 border-gold bg-card">
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
                <span className="flex flex-col items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <Loader2 className="h-8 w-8 animate-spin text-gold" aria-hidden="true" />
                  Abrindo a câmera…
                </span>
              )}
            </div>
            <p className="text-center text-sm text-muted-foreground">
              O vídeo mostra a roleta, seu rosto neste círculo, sua voz e o resultado.
            </p>
            <GoldButton
              disabled={view.kind !== "ready"}
              onClick={() => {
                if (view.kind !== "ready") return;
                handedOver.current = true;
                onStart(view.stream);
              }}
            >
              <Camera aria-hidden="true" /> Começar gravação
            </GoldButton>
            <SecondaryButton onClick={onClose}>Cancelar</SecondaryButton>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
