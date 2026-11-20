import { useEffect, useEffectEvent } from "react";

import type { CountdownStep } from "@/lib/enigma/jingle";
import { playCountdownCue } from "@/lib/enigma/sound";

export function SpinCountdown({
  step,
  volume,
  onAdvance,
  onCancel,
}: {
  step: CountdownStep;
  volume: number;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const advance = useEffectEvent(onAdvance);
  const cancel = useEffectEvent(onCancel);
  const cue = useEffectEvent(() => playCountdownCue(step, volume));

  useEffect(() => {
    if (document.hidden) {
      cancel();
      return;
    }
    const stopSound = cue();
    const timer = window.setTimeout(
      () => {
        if (document.hidden) cancel();
        else advance();
      },
      step === "VALENDO!" ? 500 : 1000,
    );
    const onVisibilityChange = () => {
      if (document.hidden) cancel();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      stopSound();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [step]);

  return (
    <span className="sr-only" role="status">
      {step}
    </span>
  );
}
