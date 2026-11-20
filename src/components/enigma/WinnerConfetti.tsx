import { useEffect, useRef } from "react";

import { prefersReducedMotion } from "@/lib/enigma/sound";
import { paintWinnerConfetti, WINNER_CONFETTI_MS } from "@/lib/enigma/winner-effects";

const SIZE = 440;

export function WinnerConfetti({ startedAt }: { startedAt: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx || prefersReducedMotion()) return;
    let request = 0;
    const frame = (now: number) => {
      const elapsed = now - startedAt;
      ctx.clearRect(0, 0, SIZE, SIZE);
      if (elapsed >= WINNER_CONFETTI_MS) return;
      paintWinnerConfetti(ctx, 0, 0, SIZE, elapsed);
      request = requestAnimationFrame(frame);
    };
    request = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(request);
      ctx.clearRect(0, 0, SIZE, SIZE);
    };
  }, [startedAt]);

  return (
    <canvas
      ref={canvas}
      width={SIZE}
      height={SIZE}
      className="pointer-events-none absolute inset-0 z-[4] h-full w-full"
      aria-hidden="true"
    />
  );
}
