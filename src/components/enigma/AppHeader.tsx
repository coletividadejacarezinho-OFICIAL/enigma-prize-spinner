import type { ReactNode } from "react";
import { UsersRound } from "lucide-react";

import { GroupLogo } from "./Logos";
import { GROUP_NAME } from "@/lib/enigma/types";

export function AppHeader({
  logo,
  subtitle,
  action,
  premium = false,
}: {
  logo?: string | undefined;
  subtitle?: string;
  action?: ReactNode;
  /** The roleta uses a premium header; other screens keep their original layout. */
  premium?: boolean;
}) {
  return (
    <header
      className={
        premium
          ? "enigma-brand-header flex min-w-0 items-center gap-3 px-4 pb-3 pt-3"
          : "flex items-center gap-3 px-4 pb-2 pt-3"
      }
    >
      <GroupLogo
        src={logo}
        className={premium ? "enigma-brand-logo h-12 w-12 text-base" : "h-10 w-10 text-sm"}
      />
      <div className="min-w-0 flex-1">
        <p
          className={
            premium
              ? "font-sans text-[clamp(0.85rem,3.4vw,1rem)] font-extrabold leading-tight tracking-[0.01em] [overflow-wrap:anywhere]"
              : "truncate font-display text-[15px] font-bold leading-tight"
          }
        >
          {GROUP_NAME}
        </p>
        {subtitle &&
          (premium ? (
            <span className="enigma-brand-count mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              <UsersRound className="h-3 w-3 shrink-0 text-gold" aria-hidden="true" />
              <span>{subtitle}</span>
            </span>
          ) : (
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          ))}
      </div>
      {action}
    </header>
  );
}
