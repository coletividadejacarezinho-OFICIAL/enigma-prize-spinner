import { useEffect, useState } from "react";

import { formatDuration } from "@/lib/enigma/logic";

export function RecIndicator({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(t);
  }, []);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-extrabold tabular-nums"
      role="timer"
      aria-label="Tempo de gravação"
    >
      <span className="h-2 w-2 rounded-full bg-rec" aria-hidden="true" />
      Gravando
      {formatDuration(now - startedAt)}
    </span>
  );
}
