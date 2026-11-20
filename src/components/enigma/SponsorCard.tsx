import { MerchantLogo } from "./Logos";

type Props = {
  logo?: string | undefined;
  merchantName: string;
  prize: string;
  roundIndex: number;
  roundTotal: number;
};

/** Visual-only composition: the merchant, prize and round all come from the saved draw. */
export function SponsorCard({ logo, merchantName, prize, roundIndex, roundTotal }: Props) {
  return (
    <section
      className="enigma-sponsor-card mx-4 flex min-w-0 items-center gap-2.5 rounded-[1.35rem] px-3 py-2.5 sm:gap-3 sm:px-4"
      aria-label="Cortesia do Enigma Premiado"
    >
      <MerchantLogo
        src={logo}
        contain
        className="enigma-sponsor-logo h-16 w-16 rounded-2xl sm:h-[4.5rem] sm:w-[4.5rem]"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-muted-foreground">
          Oferecimento
        </p>
        <p className="mt-0.5 break-words text-[0.95rem] font-extrabold leading-snug text-foreground sm:text-base">
          {merchantName}
        </p>
        {roundTotal > 1 && (
          <span className="enigma-round-pill mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold text-gold">
            Prêmio {roundIndex + 1} de {roundTotal}
          </span>
        )}
        <p
          className="mt-0.5 break-words font-display text-[1.05rem] font-extrabold leading-tight text-gold sm:text-lg"
          data-testid="prize-label"
        >
          {prize}
        </p>
      </div>
    </section>
  );
}
