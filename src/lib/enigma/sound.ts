let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from the tap that starts the spin so phones allow sound. */
export function unlockSound() {
  audio();
}

function beep(freq: number, start: number, duration: number, volume: number, type: OscillatorType) {
  const a = audio();
  if (!a) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = a.currentTime + start;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

export function playTick() {
  beep(1400, 0, 0.035, 0.12, "square");
}

export function playWin() {
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => beep(f, i * 0.12, 0.35, 0.2, "triangle"));
}
