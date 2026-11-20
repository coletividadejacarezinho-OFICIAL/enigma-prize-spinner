export const WINNER_CONFETTI_MS = 3200;
const COLORS = ["#ffe18a", "#e4b0ff", "#fff4db", "#ffab65", "#8eebd6", "#ff93cb"];
const PARTICLES = Array.from({ length: 84 }, (_, i) => {
  const wave = i % 3;
  return {
    side: Math.floor(i / 3) % 2 === 0 ? 1 : -1,
    reach: 0.052 + ((i * 19) % 43) / 1000,
    lift: 1.8 + ((i * 13) % 33) / 40,
    delay: wave * 510 + (i * 17) % 140,
    duration: 1700 + (i * 41) % 320,
    size: 0.009 + ((i * 29) % 17) / 1800,
    turn: 2.2 + ((i * 11) % 29) / 7,
    color: COLORS[Math.floor(i / 2) % COLORS.length]!,
    ribbon: i % 7 === 0,
    dot: i % 5 === 0,
  };
});

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
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, size, size);
  ctx.clip();

  for (const p of PARTICLES) {
    const t = (elapsedMs - p.delay) / p.duration;
    if (t <= 0 || t >= 1) continue;
    const x = left + size * (0.5 - p.side * (0.467 - p.reach * t));
    const y = top + size * (0.84 - p.lift * t * (1 - t));
    const w = size * p.size;
    const flutter = 0.42 + 0.58 * Math.abs(Math.cos(t * p.turn * 2));
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = Math.min(1, t * 24, (1 - t) * 4.5);
    ctx.fillStyle = p.color;
    if (p.ribbon) {
      ctx.rotate(p.side * (0.55 - t));
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(2, w * 0.42);
      ctx.lineCap = "round";
      ctx.beginPath();
      const bend = w * (1.1 + 0.8 * flutter);
      ctx.moveTo(0, -w * 2.5);
      ctx.bezierCurveTo(bend, -w * 2.25, bend, -w * 1.15, 0, -w * 0.85);
      ctx.bezierCurveTo(-bend, -w * 0.5, -bend, w * 0.5, 0, w * 0.85);
      ctx.bezierCurveTo(bend, w * 1.15, bend, w * 2.25, 0, w * 2.5);
      ctx.stroke();
    } else {
      ctx.rotate(p.side * p.turn * t);
      if (p.dot) {
        ctx.beginPath();
        ctx.arc(0, 0, w * 0.52, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-w / 2, -w * flutter, w, w * flutter * 2);
      }
    }
    ctx.restore();
  }

  ctx.restore();
}
