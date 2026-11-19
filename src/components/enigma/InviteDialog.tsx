import { Eye } from "lucide-react";

import { GoldButton } from "./GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateBR } from "@/lib/enigma/logic";
import { APP_NAME, GROUP_NAME } from "@/lib/enigma/types";

/**
 * Invite before the spin. There is no public address for the viewer page yet,
 * so it offers only the in-app preview: no link is made up.
 */
export function InviteDialog({
  open,
  onOpenChange,
  date,
  shopName,
  prize,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  shopName: string;
  prize: string;
  onPreview: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto rounded-2xl border-border bg-background p-4 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Convidar para assistir</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            É assim que o convite apresenta o sorteio.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-2xl border-2 border-gold/60 bg-card p-4">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold tracking-wide text-muted-foreground">{GROUP_NAME}</p>
            <span className="shrink-0 rounded-full border border-gold px-2 py-0.5 text-[10px] font-bold text-gold">
              Demonstração
            </span>
          </div>
          <p className="mt-1 font-display text-xl font-extrabold">{APP_NAME}</p>
          <p className="mt-2 text-base">📅 {formatDateBR(date)}</p>
          <p className="text-base">
            🤝 Oferecimento: <span className="font-bold">{shopName}</span>
          </p>
          <p className="break-words text-base">
            🎁 Cortesia: <span className="font-bold text-gold">{prize}</span>
          </p>
        </div>
        <GoldButton onClick={onPreview}>
          <Eye aria-hidden="true" /> Ver como o público vê
        </GoldButton>
        <p className="rounded-xl bg-secondary/60 p-3 text-center text-sm text-muted-foreground">
          O link para mandar ao grupo ainda não existe, porque o app não está publicado. Por
          enquanto, veja a prévia aqui.
        </p>
      </DialogContent>
    </Dialog>
  );
}
