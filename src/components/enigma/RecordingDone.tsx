import { CheckCircle2 } from "lucide-react";

import { GoldButton, SecondaryButton } from "./GoldButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

export function RecordingDoneDialog({
  recording,
  date,
  merchant,
  prize,
  onPreview,
  onClose,
}: {
  recording: Recording | null;
  date: string;
  merchant: string;
  prize: string;
  onPreview: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={recording !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border-border bg-background sm:max-w-md">
        <DialogHeader className="items-center text-center">
          <CheckCircle2 className="h-10 w-10 text-gold" aria-hidden="true" />
          <DialogTitle className="font-display text-2xl">Teste de gravação concluído</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Guardado em Sorteios, como simulação.
          </DialogDescription>
        </DialogHeader>
        {recording && (
          <RecordingSummary recording={recording} date={date} merchant={merchant} prize={prize} />
        )}
        <div className="space-y-1">
          <GoldButton onClick={onPreview}>Ver prévia</GoldButton>
          <SecondaryButton onClick={onClose}>Voltar à roleta</SecondaryButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
