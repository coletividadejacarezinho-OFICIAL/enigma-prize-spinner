import { Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { GoldButton } from "./GoldButton";
import { ImageButton, ImageShareDialog } from "./ImageShare";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listaoCardItems } from "@/lib/enigma/cards";
import { renderListaoCards } from "@/lib/enigma/cards-render";
import { formatDateBR, listaoText, type ListaoEntry, type ScheduledEntry } from "@/lib/enigma/logic";
import { GROUP_NAME } from "@/lib/enigma/types";

export function ListaoShareDialog({
  open,
  onOpenChange,
  today,
  entries,
  scheduled,
  groupLogo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  today: string;
  entries: ListaoEntry[];
  scheduled: ScheduledEntry[];
  groupLogo: string | undefined;
}) {
  const [imageOpen, setImageOpen] = useState(false);
  const items = listaoCardItems(entries, scheduled);
  const text = listaoText(GROUP_NAME, today, entries);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Texto copiado! Agora é só colar no grupo.");
    } catch {
      toast.error("Não deu para copiar neste aparelho.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }
    await copy();
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-border bg-background sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Divulgar no grupo</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Veja como a mensagem vai ficar.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border-2 border-gold/60 bg-card p-4">
          <p className="text-xs font-bold tracking-wide text-muted-foreground">{GROUP_NAME}</p>
          <p className="mt-1 font-display text-2xl font-extrabold">🎉 Listão da Alegria</p>
          <p className="text-sm font-semibold text-gold">{formatDateBR(today)}</p>
          {entries.length === 0 ? (
            <p className="mt-3 text-base">Nenhum comércio em divulgação hoje</p>
          ) : (
            <>
              <p className="mt-3 text-sm font-bold text-muted-foreground">Parceiros em divulgação:</p>
              <ul className="mt-1 space-y-0.5">
                {entries.map((e) => (
                  <li key={e.merchant.id} className="text-base font-semibold">
                    • {e.merchant.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="space-y-2">
          <GoldButton onClick={share}>
            <Share2 aria-hidden="true" /> Compartilhar
          </GoldButton>
          <button
            onClick={copy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent"
          >
            <Copy className="h-5 w-5" aria-hidden="true" /> Copiar texto
          </button>
          <ImageButton
            onClick={() => {
              onOpenChange(false);
              setImageOpen(true);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
    <ImageShareDialog
      open={imageOpen}
      onClose={() => setImageOpen(false)}
      title="Listão como imagem"
      description="Os comércios na mesma ordem do Listão, com as logos cadastradas."
      renderKey={JSON.stringify([today, items.map((i) => (i.kind === "shop" ? [i.id, i.name, i.note, i.logo?.length ?? 0] : i.title)), groupLogo?.length ?? 0])}
      make={() => renderListaoCards(today, items, groupLogo)}
    />
    </>
  );
}
