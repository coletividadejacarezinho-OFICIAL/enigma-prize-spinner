import { CheckCircle2, Download, Play, Share2 } from "lucide-react";
import { useEffect, useState } from "react";

import { GoldButton, SecondaryButton } from "./GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDuration } from "@/lib/enigma/logic";
import type { Recording } from "@/lib/enigma/types";
import { downloadVideo, shareVideo } from "@/lib/enigma/videos";

/** "Assistir", "Salvar vídeo" and "Compartilhar" for one recorded video. */
export function VideoActions({ blob, filename, autoPlay = false }: { blob: Blob; filename: string; autoPlay?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [watching, setWatching] = useState(autoPlay);
  const [note, setNote] = useState("");

  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);

  const share = async () => {
    const r = await shareVideo(blob, filename);
    setNote(
      r === "unsupported"
        ? "Este celular não deixa compartilhar daqui. Toque em Salvar vídeo e mande pelo WhatsApp."
        : "",
    );
  };

  return (
    <div className="space-y-2">
      {watching && url && (
        <video
          src={url}
          controls
          playsInline
          autoPlay
          className="mx-auto max-h-[38dvh] w-auto rounded-2xl border-2 border-gold bg-black"
          data-testid="recorded-video"
        />
      )}
      <GoldButton onClick={() => setWatching(true)} disabled={watching}>
        <Play aria-hidden="true" /> Assistir
      </GoldButton>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => {
            downloadVideo(blob, filename);
            setNote("Vídeo salvo. Procure em Downloads ou na galeria do celular.");
          }}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent"
        >
          <Download className="h-5 w-5 text-gold" aria-hidden="true" /> Salvar vídeo
        </button>
        <button
          onClick={() => void share()}
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent"
        >
          <Share2 className="h-5 w-5 text-gold" aria-hidden="true" /> Compartilhar
        </button>
      </div>
      <p className="min-h-5 text-center text-sm text-muted-foreground" role="status">
        {note}
      </p>
    </div>
  );
}

export function VideoDoneDialog({
  video,
  onClose,
}: {
  video: { blob: Blob; filename: string; recording: Recording; saved: boolean } | null;
  onClose: () => void;
}) {
  const rounds = video?.recording.rounds ?? [];
  return (
    <Dialog open={video !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-gold" aria-hidden="true" />
          <DialogTitle className="font-display text-2xl">Gravação encerrada</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {video ? formatDuration(video.recording.durationMs) : ""} ·{" "}
            {video?.saved ? "guardada em Sorteios, neste aparelho" : "salve o vídeo antes de sair"}
          </DialogDescription>
        </DialogHeader>
        {rounds.length > 0 && (
          <ul className="space-y-1">
            {rounds.map((r, i) => (
              <li key={i} className="rounded-xl bg-card px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {r.prize} · {r.merchant}
                </span>
                <span className="block font-bold text-gold">{r.winner}</span>
              </li>
            ))}
          </ul>
        )}
        {video && <VideoActions blob={video.blob} filename={video.filename} />}
        <SecondaryButton onClick={onClose}>Voltar à roleta</SecondaryButton>
      </DialogContent>
    </Dialog>
  );
}
