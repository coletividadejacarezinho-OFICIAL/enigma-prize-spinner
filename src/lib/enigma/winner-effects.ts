export const WINNER_CONFETTI_MS = 1400;
const COLORS = ["#ffe18a", "#e4b0ff", "#f9f0e4", "#f8a85c", "#85dbca"];
const PARTICLES = Array.from({ length: 44 }, (_, i) => ({
  side: i % 2 === 0 ? 1 : -1,
  speed: 0.13 + ((i * 19) % 43) / 130,
  lift: 0.47 + ((i * 13) % 33) / 80,
  delay: ((i * 17) % 37) / 250,
  size: 0.006 + ((i * 29) % 17) / 2000,
  turn: 2.2 + ((i * 11) % 29) / 7,
  color: COLORS[i % COLORS.length]!,
  dot: i % 5 === 0,
}));

export function winnerEntryProgress(elapsedMs: number): number {
  const t = Math.min(1, Math.max(0, elapsedMs / 420));
  return 1 - (1 - t) ** 3;
}

/** Draw the burst around the wheel's sides, leaving the header and the lower cards clear. */
export function paintWinnerConfetti(
  ctx: CanvasRenderingContext2D,
  left: number,
  top: number,
  size: number,
  elapsedMs: number,
) {
  if (elapsedMs < 0 || elapsedMs >= WINNER_CONFETTI_MS) return;
  const progress = elapsedMs / WINNER_CONFETTI_MS;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, size, size);
  ctx.clip();

  for (const p of PARTICLES) {
    const t = (progress - p.delay) / (1 - p.delay);
    if (t <= 0) continue;
    const x = left + size * (0.5 - p.side * (0.37 - p.speed * t));
    const y = top + size * (0.74 - p.lift * 2 * t + 0.96 * t * t);
    const w = size * p.size;
    const flutter = 0.42 + 0.58 * Math.abs(Math.cos(t * p.turn * 2));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.side * p.turn * t);
    ctx.globalAlpha = Math.min(1, t * 18, (1 - t) * 4);
    ctx.fillStyle = p.color;
    if (p.dot) {
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.52, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-w / 2, -w * flutter, w, w * flutter * 2);
    }
    ctx.restore();
  }

  ctx.restore();
}
