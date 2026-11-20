import { Trophy } from "lucide-react";

type Props = {
  winner: string;
  winnerNumber: number | null;
  prize: string;
  merchantName: string;
  roundIndex: number;
  roundTotal: number;
};

/**
 * Presentation only. Every value comes from the saved round/result;
 * this component never selects or changes a winner.
 */
export function WinnerAnnouncement({
  winner,
  winnerNumber,
  prize,
  merchantName,
  roundIndex,
  roundTotal,
}: Props) {
  return (
    <div className="enigma-winner-overlay pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-5 py-3">
      <div
        className="enigma-winner-card pointer-events-auto relative max-h-full w-full max-w-[20.5rem] overflow-y-auto rounded-[1.6rem] px-5 py-5 text-center animate-in fade-in zoom-in-95 duration-500"
        role="status"
      >
        <div className="enigma-winner-trophy mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full" aria-hidden="true">
          <Trophy className="h-6 w-6 text-gold" />
        </div>
        <p className="text-[0.72rem] font-extrabold uppercase tracking-[0.16em] text-gold">
          Ganhador(a)
        </p>
        {roundTotal > 1 && (
          <p className="enigma-winner-round mx-auto mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[0.7rem] font-extrabold text-gold">
            Prêmio {roundIndex + 1} de {roundTotal}
          </p>
        )}
        <p
          className="enigma-winner-name mt-2 font-display font-extrabold leading-[1.08] text-foreground"
          data-testid="winner"
        >
          {winnerNumber !== null && (
            <span className="enigma-winner-number mx-auto mb-2 block w-fit rounded-full px-3 py-1 font-sans text-[0.85rem] font-extrabold leading-none text-gold" data-testid="winner-number">
              Nº {winnerNumber}
            </span>
          )}
          {winner}
        </p>
        <div className="enigma-winner-divider mx-auto my-3 h-px w-4/5" aria-hidden="true" />
        <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.13em] text-muted-foreground">
          Cortesia
        </p>
        <p className="enigma-winner-prize mt-1 break-words font-display text-[clamp(0.95rem,4vw,1.1rem)] font-bold leading-snug text-gold">
          {prize}
        </p>
        <p className="mt-2 text-[0.7rem] font-bold text-muted-foreground">
          Oferecimento
        </p>
        <p className="enigma-winner-merchant break-words text-[0.85rem] font-extrabold leading-snug text-foreground">
          {merchantName}
        </p>
      </div>
    </div>
  );
}
