import { Store } from "lucide-react";
import { cn } from "@/lib/utils";

export function GroupLogo({ src, className }: { src?: string | undefined; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-gold bg-secondary",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="Logo do grupo" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display font-extrabold leading-none text-gold">CJ</span>
      )}
    </div>
  );
}

export function MerchantLogo({ src, className }: { src?: string | undefined; className?: string }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary",
        className,
      )}
    >
      {src ? (
        <img src={src} alt="Logo do comércio" className="h-full w-full object-cover" />
      ) : (
        <Store className="h-1/2 w-1/2 text-gold" aria-hidden="true" />
      )}
    </div>
  );
}
