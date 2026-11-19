import type { ReactNode } from "react";

import { GroupLogo } from "./Logos";
import { GROUP_NAME } from "@/lib/enigma/types";

export function AppHeader({
  logo,
  subtitle,
  action,
}: {
  logo?: string | undefined;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-3">
      <GroupLogo src={logo} className="h-10 w-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-bold leading-tight">{GROUP_NAME}</p>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
