import { Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { GoldButton } from "./GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { releaseCards, type CardImage } from "@/lib/enigma/cards-render";
import { cn } from "@/lib/utils";

type Status = "idle" | "shared" | "saved" | "fallback" | "error";

function canShareFiles(files: File[]): boolean {
  try {
    return typeof navigator.share === "function" && typeof navigator.canShare === "function" && navigator.canShare({ files });
  } catch {
    return false;
  }
}

/**
 * Preview of one or more PNG pictures with "Compartilhar imagem" (the phone's share
 * sheet, to pick WhatsApp and the group) and "Salvar imagem". The preview shows the
 * very files that are shared and saved.
 */
export function ImageShareDialog({
  open,
  onClose,
  title,
  description,
  renderKey,
  make,
  choices,
  choice,
  onChoice,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  /** Changes whenever the data in the pictures changes, so they are drawn again. */
  renderKey: string;
  make: () => Promise<CardImage[]>;
  choices?: { id: string; label: string }[];
  choice?: string;
  onChoice?: (id: string) => void;
}) {
  const [cards, setCards] = useState<CardImage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const makeRef = useRef(make);
  makeRef.current = make;

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let made: CardImage[] = [];
    setCards(null);
    setFailed(false);
    setStatus("idle");
    makeRef
      .current()
      .then((c) => {
        made = c;
        if (alive) setCards(c);
        else releaseCards(c);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      releaseCards(made);
    };
  }, [open, renderKey]);

  const files = cards?.map((c) => new File([c.blob], c.filename, { type: "image/png" })) ?? [];
  const shareable = files.length > 0 && canShareFiles(files);
  const many = (cards?.length ?? 0) > 1;

  const share = async () => {
    if (!shareable) return setStatus("fallback");
    try {
      await navigator.share({ files });
      setStatus("shared");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("fallback");
    }
  };

  const save = () => {
    if (!cards) return;
    for (const c of cards) {
      const a = document.createElement("a");
      a.href = c.url;
      a.download = c.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setStatus("saved");
  };

  const saveLabel = many ? `Salvar imagens (${cards?.length})` : "Salvar imagem";
  const shareLabel = many ? `Compartilhar imagens (${cards?.length})` : "Compartilhar imagem";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[94dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">{description}</DialogDescription>
        </DialogHeader>

        {choices && choices.length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Qual arte">
            {choices.map((c) => (
              <button
                key={c.id}
                role="tab"
                aria-selected={c.id === choice}
                onClick={() => onChoice?.(c.id)}
                className={cn(
                  "h-10 shrink-0 rounded-full px-4 text-sm font-bold",
                  c.id === choice ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-2xl bg-card p-2" data-testid="image-preview">
          {failed ? (
            <p className="flex h-[48dvh] items-center justify-center p-4 text-center text-muted-foreground">
              Não deu para preparar a imagem. Feche e tente de novo.
            </p>
          ) : !cards ? (
            <p className="flex h-[48dvh] items-center justify-center gap-2 text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> Preparando a imagem…
            </p>
          ) : (
            <>
              <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto">
                {cards.map((c, i) => (
                  <figure key={c.url} className="shrink-0 snap-center">
                    <img
                      src={c.url}
                      alt={many ? `Imagem ${i + 1} de ${cards.length}` : title}
                      className="h-[48dvh] w-auto rounded-xl"
                    />
                    {many && (
                      <figcaption className="pt-1 text-center text-xs font-bold text-muted-foreground">
                        Imagem {i + 1} de {cards.length}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
              {many && (
                <p className="pt-1 text-center text-xs text-muted-foreground">
                  São {cards.length} imagens. Arraste para o lado para ver todas.
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-2">
          {shareable || !cards ? (
            <>
              <GoldButton onClick={share} disabled={!cards} className={many ? "px-3 text-lg" : ""}>
                <Share2 aria-hidden="true" /> {shareLabel}
              </GoldButton>
              <button
                onClick={save}
                disabled={!cards}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent disabled:opacity-50"
              >
                <Download className="h-5 w-5" aria-hidden="true" /> {saveLabel}
              </button>
            </>
          ) : (
            <GoldButton onClick={save} className={many ? "px-3 text-lg" : ""}>
              <Download aria-hidden="true" /> {saveLabel}
            </GoldButton>
          )}
          <p className="min-h-5 text-center text-sm text-muted-foreground" role="status">
            {status === "saved"
              ? many
                ? "Imagens salvas. No WhatsApp, abra o grupo, toque no clipe e escolha as imagens."
                : "Imagem salva. No WhatsApp, abra o grupo, toque no clipe e escolha a imagem."
              : status === "fallback" || (cards && !shareable)
                ? "Este aparelho não envia a imagem direto. Toque em Salvar e anexe no grupo do WhatsApp."
                : "Toque em Compartilhar e escolha o WhatsApp e o grupo."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** "Enviar como imagem" in the text share windows. */
export function ImageButton({ label = "Enviar como imagem", onClick }: { label?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-gold/60 bg-card font-bold active:bg-accent"
    >
      <ImageIcon className="h-5 w-5 text-gold" aria-hidden="true" /> {label}
    </button>
  );
}
