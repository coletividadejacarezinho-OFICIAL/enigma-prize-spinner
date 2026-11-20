import { CheckCircle2, MessageCircle, Trophy } from "lucide-react";

import { GoldButton } from "./GoldButton";
import { ImageButton } from "./ImageShare";
import { MerchantLogo } from "./Logos";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { winnerNumber } from "@/lib/enigma/numbers";
import type { Round } from "@/lib/enigma/rounds";
import type { Draw } from "@/lib/enigma/types";

type Props = {
  open: boolean;
  onClose: () => void;
  date: string;
  draw: Draw;
  rounds: Round[];
  onShareText: () => void;
  onShareArt: () => void;
};

/**
 * Read-only final result. All winners are read from the saved rounds; this
 * component cannot change the draw, choose winners or modify any prizes.
 */
export function SummaryResultsDialog({
  open,
  onClose,
  date,
  draw,
  rounds,
  onShareText,
  onShareArt,
}: Props) {
  const completed = rounds.filter((r) => !!r.result).length;
  const allDone = rounds.length > 0 && completed === rounds.length;
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="enigma-summary-dialog flex max-h-[90dvh] min-h-0 max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-hidden rounded-2xl border-gold/35 bg-background p-4 sm:max-w-md">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-center gap-2 font-display text-2xl">
            <Trophy className="h-6 w-6 text-gold" aria-hidden="true" />
            Resumo do sorteio
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            {date} · {rounds.length} {rounds.length === 1 ? "cortesia" : "cortesias"}
          </DialogDescription>
        </DialogHeader>
        <div className="enigma-summary-progress flex shrink-0 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-extrabold text-gold">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {allDone
            ? `Todas as ${completed} cortesias sorteadas`
            : `${completed} de ${rounds.length} cortesias sorteadas`}
        </div>
        <ol
          className="enigma-summary-list min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain pr-1"
          aria-label="Resultados por cortesia"
          data-testid="summary"
        >
          {rounds.map((r) => {
            const number = winnerNumber(draw, r.result);
            return (
              <li key={r.index} className="enigma-summary-item rounded-2xl border border-gold/20 bg-card p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <MerchantLogo src={r.merchantLogo} contain className="h-12 w-12 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <span className="enigma-summary-round inline-flex rounded-full px-2 py-0.5 text-[10px] font-extrabold text-gold">
                      Prêmio {r.index + 1} de {rounds.length}
                    </span>
                    <p className="mt-1 break-words text-xs font-bold text-muted-foreground">{r.merchantName}</p>
                    <p className="break-words font-display text-base font-extrabold leading-snug text-gold">{r.prize}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-start gap-2 border-t border-gold/15 pt-2">
                  {r.result ? (
                    <>
                      <Trophy className="mt-0.5 h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                      <p className="min-w-0 break-words font-display text-lg font-extrabold leading-snug">
                        {number !== null && (
                          <span className="mr-1.5 whitespace-nowrap text-sm text-gold">Nº {number}</span>
                        )}
                        {r.result.winner}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ainda não sorteado</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {allDone && (
          <div className="shrink-0 space-y-2 border-t border-gold/20 pt-3">
            <GoldButton className="px-2 text-lg" onClick={onShareText}>
              <MessageCircle aria-hidden="true" /> Compartilhar no WhatsApp
            </GoldButton>
            <ImageButton label="Compartilhar arte do ganhador" onClick={onShareArt} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
