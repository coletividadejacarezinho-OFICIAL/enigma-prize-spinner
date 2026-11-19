import { Play, Square, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { report } from "@/lib/enigma/feedback";
import { clampVolume } from "@/lib/enigma/jingle";
import { repo } from "@/lib/enigma/repo";
import { previewTrack, unlockSound } from "@/lib/enigma/sound";
import type { AppState } from "@/lib/enigma/types";

/** Spin music: on/off ("Sem som"), volume and "Ouvir prévia". Saved on this phone. */
export function SoundCard({ state }: { state: AppState }) {
  const saved = clampVolume(state.volume);
  const [vol, setVol] = useState(saved);
  const [playing, setPlaying] = useState(false);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => setVol(saved), [saved]);
  useEffect(() => () => stopRef.current?.(), []);

  const stop = () => {
    stopRef.current?.();
    stopRef.current = null;
    setPlaying(false);
  };
  const preview = () => {
    if (playing) return stop();
    unlockSound();
    stopRef.current = previewTrack(vol);
    setPlaying(true);
    setTimeout(() => setPlaying(false), 4300);
  };

  return (
    <section className="rounded-2xl bg-card p-4">
      <label className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-3">
          {state.sound ? (
            <Volume2 className="h-6 w-6 text-gold" aria-hidden="true" />
          ) : (
            <VolumeX className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          )}
          <span>
            <span className="block text-xl font-bold">Música da roleta</span>
            <span className="block text-sm text-muted-foreground" data-testid="sound-state">
              {state.sound ? "Ligada" : "Sem som"}
            </span>
          </span>
        </span>
        <Switch
          checked={state.sound}
          onCheckedChange={async (on) => {
            if (!on) stop();
            report(await repo.setPreferences({ sound: on }));
          }}
          className="scale-125"
          aria-label="Música da roleta"
        />
      </label>
      {state.sound && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <span className="w-16 text-sm font-bold">Volume</span>
            <Slider
              value={[Math.round(vol * 100)]}
              min={0}
              max={100}
              step={5}
              onValueChange={([v]) => setVol((v ?? 70) / 100)}
              onValueCommit={async ([v]) => {
                report(await repo.setPreferences({ volume: (v ?? 70) / 100 }));
              }}
              aria-label="Volume"
              className="flex-1"
            />
            <span className="w-10 text-right text-sm tabular-nums" data-testid="volume-value">
              {Math.round(vol * 100)}%
            </span>
          </div>
          <button
            onClick={preview}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-secondary font-bold active:bg-accent"
          >
            {playing ? (
              <Square className="h-5 w-5 text-gold" aria-hidden="true" />
            ) : (
              <Play className="h-5 w-5 text-gold" aria-hidden="true" />
            )}
            {playing ? "Parar prévia" : "Ouvir prévia"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            Música original do app, tocada no próprio aparelho. Se o celular bloquear o som, o
            sorteio continua normalmente.
          </p>
        </>
      )}
    </section>
  );
}
