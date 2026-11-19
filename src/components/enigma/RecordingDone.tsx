import { formatDateBR, formatDuration } from "@/lib/enigma/logic";
import type { Recording } from "@/lib/enigma/types";

export function RecordingSummary({
  recording,
  date,
  merchant,
  prize,
}: {
  recording: Recording;
  date: string;
  merchant: string;
  prize: string;
}) {
  const rows: [string, string][] = [
    ["Duração", formatDuration(recording.durationMs)],
    ["Data", formatDateBR(date)],
    ["Comércio", merchant],
    ["Cortesia", prize],
    ["Ganhador(a)", recording.winner ?? "Sem sorteio realizado"],
  ];
  return (
    <dl className="divide-y divide-border rounded-2xl bg-card px-4">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-2 py-2.5">
          <dt className="text-sm text-muted-foreground">{k}</dt>
          <dd
            className={
              k === "Ganhador(a)" && recording.winner ? "font-bold text-gold" : "font-semibold"
            }
          >
            {v}
          </dd>
        </div>
      ))}
    </dl>
  );
}
