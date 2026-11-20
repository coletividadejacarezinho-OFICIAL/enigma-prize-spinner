import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { watchForUpdates } from "@/lib/enigma/app-version";
import { usePresentation } from "@/lib/enigma/presentation";
import { useRecorder } from "@/lib/enigma/recorder";

/**
 * "Tem uma versão nova": shown when the site was published again while this phone
 * kept the old code open. Never reloads by itself, and stays hidden during a
 * recording or the Roleta full screen, so nothing in progress is lost.
 */
export function UpdateNotice() {
  const [available, setAvailable] = useState(false);
  const [later, setLater] = useState(false);
  const rec = useRecorder();
  const presenting = usePresentation();
  useEffect(() => watchForUpdates(() => setAvailable(true)), []);
  if (!available || later || rec || presenting) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 mx-auto flex max-w-md items-center gap-2 border-b border-gold/40 bg-secondary px-3 py-2 text-sm font-semibold"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-tight">Versão nova do aplicativo</span>
      <button
        onClick={() => window.location.reload()}
        className="h-9 shrink-0 rounded-lg bg-primary px-3 font-extrabold text-primary-foreground"
      >
        Atualizar
      </button>
      <button onClick={() => setLater(true)} className="h-9 shrink-0 px-2 text-muted-foreground">
        Depois
      </button>
    </div>
  );
}
