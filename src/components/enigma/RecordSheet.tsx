import { Camera, Check, Disc3, Mic, MicOff } from "lucide-react";
import { useState } from "react";

import { GoldButton } from "./GoldButton";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { RECORDING_MODES, type RecordingMode } from "@/lib/enigma/types";
import { cn } from "@/lib/utils";

const ICONS: Record<RecordingMode, typeof Mic> = {
  "roleta-voz": Disc3,
  "roleta-camera": Camera,
  voz: Mic,
};

export function RecordSheet({
  open,
  onOpenChange,
  onStart,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart: (mode: RecordingMode, mic: boolean) => void;
}) {
  const [mode, setMode] = useState<RecordingMode>("roleta-voz");
  const [mic, setMic] = useState(true);
  const video = RECORDING_MODES.find((m) => m.id === mode)?.video ?? false;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-w-md rounded-t-3xl border-border bg-background px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-2xl font-extrabold text-foreground">
            Como quer gravar?
          </SheetTitle>
          <SheetDescription className="sr-only">Escolha o jeito de gravar o teste.</SheetDescription>
        </SheetHeader>

        <div className="mt-3 space-y-2" role="radiogroup" aria-label="Como quer gravar?">
          {RECORDING_MODES.map((m) => {
            const Icon = ICONS[m.id];
            const selected = m.id === mode;
            return (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(m.id)}
                className={cn(
                  "flex h-14 w-full items-center gap-3 rounded-2xl border-2 px-4 text-left text-lg font-bold",
                  selected ? "border-gold bg-secondary" : "border-transparent bg-card",
                )}
              >
                <Icon className={cn("h-6 w-6 shrink-0", selected ? "text-gold" : "text-muted-foreground")} aria-hidden="true" />
                <span className="min-w-0 flex-1">{m.label}</span>
                {selected && <Check className="h-5 w-5 shrink-0 text-gold" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {video && (
          <label className="mt-3 flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
            <span className="flex items-center gap-3 text-base font-bold">
              {mic ? (
                <Mic className="h-5 w-5 text-gold" aria-hidden="true" />
              ) : (
                <MicOff className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              )}
              Microfone {mic ? "ligado" : "desligado"}
            </span>
            <Switch checked={mic} onCheckedChange={setMic} aria-label="Microfone" />
          </label>
        )}

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Gravação de teste. A câmera e o microfone ficam desligados.
        </p>
        <GoldButton className="mt-2" onClick={() => onStart(mode, mic)}>
          Começar teste
        </GoldButton>
      </SheetContent>
    </Sheet>
  );
}
