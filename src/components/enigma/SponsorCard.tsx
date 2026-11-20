import { ChevronRight, MapPin, Phone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cleanWhatsapp, formatWhatsapp } from "@/lib/enigma/partners";
import { MerchantLogo } from "./Logos";

type Props = {
  logo?: string | undefined;
  merchantName: string;
  prize: string;
  roundIndex: number;
  roundTotal: number;
  whatsapp?: string | undefined;
  address?: string | undefined;
};

/** Visual-only composition: the merchant, prize and round all come from the saved draw. */
export function SponsorCard({
  logo,
  merchantName,
  prize,
  roundIndex,
  roundTotal,
  whatsapp,
  address,
}: Props) {
  const digits = whatsapp ? cleanWhatsapp(whatsapp) : null;
  const phone = digits ? formatWhatsapp(digits) : "";
  const location = typeof address === "string" ? address.trim() : "";
  const hasContact = !!(phone || location);
  const roundLabel = roundTotal > 1 ? `Prêmio ${roundIndex + 1} de ${roundTotal}` : "";

  if (hasContact) {
    return (
      <Dialog>
        <section
          className="enigma-sponsor-card enigma-sponsor-card--contact relative mx-4 flex min-w-0 items-center gap-2.5 rounded-[1.35rem] px-3 sm:gap-3 sm:px-4"
          aria-label="Cortesia do Enigma Premiado"
        >
          <MerchantLogo
            src={logo}
            contain
            className="enigma-sponsor-logo h-16 w-16 shrink-0 rounded-2xl sm:h-[4.5rem] sm:w-[4.5rem]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
                Oferecimento
              </p>
              {roundLabel && (
                <span className="enigma-round-pill ml-auto shrink-0 rounded-full px-1.5 text-[10px] font-extrabold leading-4 text-gold">
                  {roundLabel}
                </span>
              )}
              <ChevronRight
                className={`h-3.5 w-3.5 shrink-0 text-gold${roundLabel ? "" : " ml-auto"}`}
                aria-hidden="true"
              />
            </div>
            <p className="truncate text-sm font-extrabold leading-[1.15rem] text-foreground">
              {merchantName}
            </p>
            <p
              className="truncate font-display text-base font-extrabold leading-5 text-gold"
              data-testid="prize-label"
            >
              {prize}
            </p>
            <div className="mt-0.5 grid gap-px text-xs font-semibold leading-4 text-muted-foreground">
              {phone && (
                <p className="flex min-w-0 items-center gap-1.5">
                  <Phone className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
                  <span className="truncate tabular-nums">{phone}</span>
                </p>
              )}
              {location && (
                <p className="flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
                  <span className="truncate">{location}</span>
                </p>
              )}
            </div>
          </div>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Ver detalhes do oferecimento"
              className="absolute inset-0 rounded-[inherit] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-gold"
            />
          </DialogTrigger>
        </section>
        <DialogContent className="max-h-[80dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-2xl [overflow-wrap:anywhere]">
          <DialogTitle className="break-words pr-5 leading-tight">{merchantName}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap break-words">
            {roundLabel && <span className="mb-1 block font-bold text-gold">{roundLabel}</span>}
            {prize}
          </DialogDescription>
          <dl className="grid gap-3 break-words text-sm">
            {phone && (
              <div>
                <dt className="font-bold text-gold">Telefone ou WhatsApp</dt>
                <dd>{phone}</dd>
              </div>
            )}
            {location && (
              <div>
                <dt className="font-bold text-gold">Endereço comercial</dt>
                <dd>{location}</dd>
              </div>
            )}
          </dl>
        </DialogContent>
      </Dialog>
    );
  }

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
        {roundLabel && (
          <span className="enigma-round-pill mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold text-gold">
            {roundLabel}
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
