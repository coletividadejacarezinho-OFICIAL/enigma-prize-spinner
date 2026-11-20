import { ChevronRight, MapPin, Phone } from "lucide-react";
import { useState, type CSSProperties } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cleanWhatsapp, formatWhatsapp } from "@/lib/enigma/partners";
import { MerchantLogo } from "./Logos";

function SponsorLogo({ src }: { src?: string | undefined }) {
  const [ratio, setRatio] = useState(1);
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <MerchantLogo className="enigma-sponsor-logo h-14 w-14 rounded-xl" />;
  }
  return (
    <div
      className="enigma-sponsor-logo enigma-sponsor-logo--adaptive shrink-0"
      style={{ "--sponsor-logo-ratio": ratio } as CSSProperties}
    >
      <img
        src={src}
        alt="Logo do comércio"
        className="object-contain"
        onLoad={({ currentTarget: img }) => {
          if (img.naturalWidth && img.naturalHeight) {
            setRatio(img.naturalWidth / img.naturalHeight);
          }
        }}
        onError={() => setFailed(true)}
      />
    </div>
  );
}

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

  return (
    <Dialog>
      <section
        className={`enigma-sponsor-card enigma-sponsor-card--polished relative mx-4 flex min-w-0 items-center gap-2.5 rounded-[1.35rem] px-3 py-2 sm:gap-3 sm:px-4${hasContact ? " enigma-sponsor-card--contact" : ""}`}
        aria-label="Cortesia do Enigma Premiado"
      >
        <SponsorLogo key={logo ?? "no-logo"} src={logo} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-[10px] font-extrabold uppercase tracking-[0.12em] text-muted-foreground">
              Oferecimento
            </p>
            {roundLabel && (
              <span className="enigma-round-pill ml-auto shrink-0 rounded-full px-1.5 text-[10px] font-extrabold leading-3 text-gold">
                {roundLabel}
              </span>
            )}
            <ChevronRight
              className={`h-3.5 w-3.5 shrink-0 text-gold${roundLabel ? "" : " ml-auto"}`}
              aria-hidden="true"
            />
          </div>
          <p className="truncate text-sm font-extrabold leading-4 text-foreground">
            {merchantName}
          </p>
          <p
            className="line-clamp-2 font-display text-[0.95rem] font-extrabold leading-4 text-gold [overflow-wrap:anywhere]"
            data-testid="prize-label"
          >
            {prize}
          </p>
          {hasContact && (
            <div className="mt-0.5 grid gap-px text-xs font-semibold leading-[0.875rem] text-muted-foreground">
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
          )}
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
        {hasContact && (
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
        )}
      </DialogContent>
    </Dialog>
  );
}
