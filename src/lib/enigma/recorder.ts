/**
 * The canvas is the live presentation during video recording and feeds the file
 * directly. The wheel supplies the current angle and zoom; audio is mixed separately.
 */
import { useSyncExternalStore } from "react";

import { pickType, recordedMusicLevel, type Needs } from "./capture";
import { fitText, initials } from "./cards";
import type { CountdownStep } from "./jingle";
import { segmentAtPointer } from "./logic";
import { audioContext, prefersReducedMotion, setRecordTap } from "./sound";
import type { RecordingMode } from "./types";
import {
  rimLampIsLit,
  rimLightIndex,
  RIM_LAMP_COUNT,
  wheelFocusOpacity,
  wheelFontSize,
  wheelLabel,
  type WheelMotion,
} from "./wheel-visual";
import { paintWinnerConfetti, winnerEntryProgress } from "./winner-effects";

export type CameraProblem = "denied" | "missing" | "busy" | "unsupported" | "other";

export const CAMERA_PROBLEM_TEXT: Record<CameraProblem, string> = {
  denied:
    "O celular não deixou usar a câmera ou o microfone. Toque no cadeado ao lado do endereço, permita câmera e microfone e tente de novo.",
  missing: "Não encontramos câmera frontal ou microfone neste aparelho.",
  busy: "A câmera ou o microfone está sendo usado por outro aplicativo. Feche o outro aplicativo e tente de novo.",
  unsupported:
    "Este navegador não consegue gravar aqui. Abra o Enigma Premiado direto no Chrome (Android) ou no Safari (iPhone).",
  other: "A câmera não abriu desta vez. Tente de novo.",
};

export type MediaResult =
  { ok: true; stream: MediaStream | null } | { ok: false; problem: CameraProblem };

export function canRecord(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function"
  );
}

/** E07: asks only for what the mode needs (`needsFor`); nothing when neither is needed. */
export async function openMedia(needs: Needs): Promise<MediaResult> {
  if (!canRecord()) return { ok: false, problem: "unsupported" };
  if (!needs.camera && !needs.mic) return { ok: true, stream: null };
  if (!navigator.mediaDevices?.getUserMedia) return { ok: false, problem: "unsupported" };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: needs.camera
        ? { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } }
        : false,
      audio: needs.mic ? { echoCancellation: true, noiseSuppression: true } : false,
    });
    return { ok: true, stream };
  } catch (e) {
    const name = e instanceof DOMException ? e.name : "";
    if (name === "NotAllowedError" || name === "SecurityError")
      return { ok: false, problem: "denied" };
    if (name === "NotFoundError" || name === "OverconstrainedError")
      return { ok: false, problem: "missing" };
    if (name === "NotReadableError" || name === "AbortError") return { ok: false, problem: "busy" };
    return { ok: false, problem: "other" };
  }
}

/** Kept for older callers: front camera and microphone. */
export async function openCamera(): Promise<
  { ok: true; stream: MediaStream } | { ok: false; problem: CameraProblem }
> {
  const r = await openMedia({ camera: true, mic: true });
  return r.ok ? { ok: true, stream: r.stream! } : r;
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((t) => t.stop());
}

export type RecFrame = {
  group: string;
  /** DD/MM/AAAA */
  date: string;
  /** "Prêmio 1 de 2" or "" for a single courtesy. */
  roundLabel: string;
  prize: string;
  merchant: string;
  merchantLogo?: string | undefined;
  address?: string | undefined;
  phone?: string | undefined;
  names: string[];
  rotation: number;
  spinning: boolean;
  countdown?: { step: CountdownStep; startedAt: number } | null;
  winner: string | null;
  winnerIndex?: number | undefined;
  celebrationAt?: number | undefined;
  /** Public number of the winner in the confirmed list (E06). */
  winnerNumber?: number | null;
  summary: { prize: string; merchant: string; winner: string; number?: number }[] | null;
};

const W = 720;
const H = 1280;
const WHEEL_Y = 660;
const WHEEL_RADIUS = 300;
const WHEEL_BEZEL = 16;
const COURTESY_INTRO_MS = 1250;
const SUMMARY_ROWS_PER_PAGE = 6;
const SUMMARY_PAGE_MS = 5500;

type Session = {
  mode: RecordingMode;
  mic: boolean;
  canvas: HTMLCanvasElement | null;
  canvasTracks: MediaStreamTrack[];
  ctx: CanvasRenderingContext2D | null;
  video: HTMLVideoElement | null;
  stream: MediaStream | null;
  recorder: MediaRecorder;
  chunks: Blob[];
  mimeType: string;
  startedAt: number;
  drawId: string;
  timer: ReturnType<typeof setInterval> | null;
  frame: RecFrame;
  motion: WheelMotion | null;
  logo: HTMLImageElement | null;
  sponsorPresentedAt: number;
  nextCourtesyAt: number | null;
  summaryPresentedAt: number;
  colors: Palette;
  /** Mix of microphone + spin music; disconnected at the end. */
  mixEnd: () => void;
};

export type RecSnapshot = { drawId: string; startedAt: number; mode: RecordingMode; mic: boolean };

let session: Session | null = null;
let snapshot: RecSnapshot | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function useRecorder(): RecSnapshot | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => null,
  );
}

type Palette = {
  bg: string;
  card: string;
  gold: string;
  goldDeep: string;
  ink: string;
  inkDark: string;
  muted: string;
  wheel: string[];
};

const FALLBACK: Palette = {
  bg: "#1f0b33",
  card: "#36125a",
  gold: "#f2bf2c",
  goldDeep: "#b8860b",
  ink: "#fbf8ff",
  inkDark: "#1f0b33",
  muted: "#bfaed6",
  wheel: ["#e0334f", "#f0c030", "#2fa364", "#3f6fe0", "#f07a2a", "#d0368f", "#2aa8b8", "#6a3ac8"],
};

/** The app's colors, when the canvas understands them; otherwise close hex values. */
function readPalette(ctx: CanvasRenderingContext2D): Palette {
  const css = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => {
    const v = css.getPropertyValue(name).trim();
    if (!v) return fallback;
    ctx.fillStyle = "#010203";
    ctx.fillStyle = v;
    return ctx.fillStyle === "#010203" ? fallback : v;
  };
  return {
    bg: pick("--background", FALLBACK.bg),
    card: pick("--card", FALLBACK.card),
    gold: pick("--gold", FALLBACK.gold),
    goldDeep: pick("--gold-deep", FALLBACK.goldDeep),
    ink: pick("--wheel-ink", FALLBACK.ink),
    inkDark: pick("--wheel-ink-dark", FALLBACK.inkDark),
    muted: pick("--muted-foreground", FALLBACK.muted),
    wheel: FALLBACK.wheel.map((f, i) => pick(`--wheel-${i + 1}`, f)),
  };
}

/**
 * One audio track for the file: the microphone (when on) plus the spin music sent
 * straight in at `recordedMusicLevel`. Falls back to the raw microphone track.
 */
function buildAudio(
  stream: MediaStream | null,
  musicLevel: number,
): { tracks: MediaStreamTrack[]; end: () => void } {
  const micTracks = stream?.getAudioTracks() ?? [];
  const a = audioContext();
  if (!a || typeof a.createMediaStreamDestination !== "function")
    return { tracks: micTracks, end: () => undefined };
  try {
    const dest = a.createMediaStreamDestination();
    const src =
      micTracks.length && stream ? a.createMediaStreamSource(new MediaStream(micTracks)) : null;
    src?.connect(dest);
    setRecordTap(dest, musicLevel);
    return {
      tracks: dest.stream.getAudioTracks(),
      end: () => {
        setRecordTap(null);
        src?.disconnect();
        dest.stream.getTracks().forEach((t) => t.stop());
      },
    };
  } catch {
    return { tracks: micTracks, end: () => undefined };
  }
}

export type StartOptions = {
  mode: RecordingMode;
  mic: boolean;
  stream: MediaStream | null;
  drawId: string;
  /** The on-screen host displays the exact canvas passed to captureStream. */
  previewHost: HTMLElement | null;
  frame: RecFrame;
  sound: boolean;
  volume: number;
};

export function startRecording(o: StartOptions): boolean {
  if (session || (o.mode !== "voz" && !o.previewHost)) return false;
  const audioOnly = o.mode === "voz";
  const mimeType = pickType(audioOnly, (t) => MediaRecorder.isTypeSupported(t));
  const mix = buildAudio(
    o.mic ? o.stream : null,
    audioOnly ? 0 : recordedMusicLevel(o.sound, o.volume, o.mic),
  );

  let canvas: HTMLCanvasElement | null = null;
  let ctx: CanvasRenderingContext2D | null = null;
  let video: HTMLVideoElement | null = null;
  let out: MediaStream;
  if (audioOnly) {
    out = new MediaStream(mix.tracks);
  } else {
    canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    canvas.setAttribute("aria-hidden", "true");
    ctx = canvas.getContext("2d");
    if (!ctx) {
      mix.end();
      return false;
    }
    try {
      out = canvas.captureStream(30);
      mix.tracks.forEach((t) => out.addTrack(t));
    } catch {
      mix.end();
      return false;
    }
  }
  let recorder: MediaRecorder;
  try {
    const opts: MediaRecorderOptions = mimeType ? { mimeType } : {};
    if (!audioOnly) opts.videoBitsPerSecond = 2_500_000;
    recorder = new MediaRecorder(out, opts);
  } catch {
    if (canvas) out.getVideoTracks().forEach((track) => track.stop());
    mix.end();
    return false;
  }
  if (o.mode === "roleta-camera" && o.stream?.getVideoTracks().length) {
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = o.stream;
    // Keep the decoder active on mobile. The shared canvas shows its cropped frames.
    video.className = "enigma-recording-camera-source";
    video.setAttribute("aria-hidden", "true");
    o.previewHost?.appendChild(video);
    void video.play().catch(() => undefined);
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  const s: Session = {
    mode: o.mode,
    mic: o.mic,
    canvas,
    canvasTracks: canvas ? out.getVideoTracks() : [],
    ctx,
    video,
    stream: o.stream,
    recorder,
    chunks,
    mimeType: recorder.mimeType || mimeType || (audioOnly ? "audio/webm" : "video/webm"),
    startedAt: Date.now(),
    drawId: o.drawId,
    frame: o.frame,
    motion: null,
    logo: loadLogo(o.frame.merchantLogo),
    sponsorPresentedAt: performance.now(),
    nextCourtesyAt: null,
    summaryPresentedAt: performance.now(),
    colors: ctx ? readPalette(ctx) : FALLBACK,
    timer: null,
    mixEnd: mix.end,
  };
  try {
    if (canvas) o.previewHost?.appendChild(canvas);
    paint(s);
    recorder.start(1000);
  } catch {
    release(s);
    return false;
  }
  if (ctx) s.timer = setInterval(() => paint(s), 1000 / 30);
  session = s;
  snapshot = { drawId: o.drawId, startedAt: s.startedAt, mode: o.mode, mic: o.mic };
  emit();
  return true;
}

export function setRecFrame(frame: RecFrame) {
  if (!session) return;
  const previous = session.frame;
  if (previous.merchantLogo !== frame.merchantLogo) session.logo = loadLogo(frame.merchantLogo);
  if (previous.merchant !== frame.merchant || previous.prize !== frame.prize || previous.roundLabel !== frame.roundLabel)
    session.sponsorPresentedAt = performance.now();
  if (frame.roundLabel && frame.roundLabel !== previous.roundLabel && !frame.winner)
    session.nextCourtesyAt = performance.now();
  if (frame.summary && !previous.summary) session.summaryPresentedAt = performance.now();
  if (!frame.spinning) session.motion = null;
  session.frame = frame;
}

export function setRecMotion(motion: WheelMotion) {
  if (session?.frame.spinning) session.motion = motion;
}

export function setRecIdleRotation(rotation: number) {
  if (session && !session.frame.spinning && !session.frame.winner) session.frame.rotation = rotation;
}

function loadLogo(src: string | undefined) {
  if (!src) return null;
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.src = src;
  return image;
}

export function isRecording(): boolean {
  return session !== null;
}

/** Frees the camera and microphone, the live preview and the audio mix. */
function release(s: Session) {
  if (s.timer) clearInterval(s.timer);
  stopStream(s.stream);
  s.canvasTracks.forEach((track) => track.stop());
  s.canvas?.remove();
  if (s.video) {
    s.video.srcObject = null;
    s.video.remove();
  }
  s.mixEnd();
}

export type Finished = {
  blob: Blob;
  mimeType: string;
  startedAt: number;
  durationMs: number;
  mode: RecordingMode;
  mic: boolean;
};

export function stopRecording(): Promise<Finished | null> {
  const s = session;
  if (!s) return Promise.resolve(null);
  session = null;
  snapshot = null;
  emit();
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      release(s);
      const type = s.mimeType.split(";")[0] ?? "video/webm";
      resolve({
        blob: new Blob(s.chunks, { type }),
        mimeType: type,
        startedAt: s.startedAt,
        durationMs: Date.now() - s.startedAt,
        mode: s.mode,
        mic: s.mic,
      });
    };
    s.recorder.onstop = finish;
    try {
      // Paint one last frame so the final result is surely in the video.
      paint(s);
      s.recorder.requestData();
      s.recorder.stop();
    } catch {
      finish();
    }
  });
}

/** "Cancelar gravação": stops and throws the file away; the draw is untouched. */
export function cancelRecording() {
  const s = session;
  if (!s) return;
  session = null;
  snapshot = null;
  emit();
  s.recorder.onstop = null;
  try {
    s.recorder.stop();
  } catch {
    /* already stopped */
  }
  release(s);
}

/* ---------- painting ---------- */

function colorIndex(i: number, count: number) {
  let c = i % 8;
  if (count > 1 && i === count - 1 && c === 0) c = 2;
  return c;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Splits text into at most `maxLines` lines that fit `width`. */
function wrap(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= width || !line) line = test;
    else {
      lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    let last = kept[maxLines - 1] ?? "";
    while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
    kept[maxLines - 1] = `${last}…`;
    return kept;
  }
  return lines;
}

const SANS = '"Nunito", system-ui, sans-serif';
const DISPLAY = '"Baloo 2", "Nunito", system-ui, sans-serif';

function paint(s: Session) {
  const { ctx, frame: f, colors: c } = s;
  if (!ctx) return;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.bg;
  ctx.fillRect(0, 0, W, H);

  const spotlight = ctx.createRadialGradient(W / 2, 610, 30, W / 2, 610, 630);
  spotlight.addColorStop(0, "#9258d526");
  spotlight.addColorStop(1, "#9258d500");
  ctx.fillStyle = spotlight;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = "center";
  ctx.fillStyle = c.gold;
  ctx.font = `800 24px ${SANS}`;
  ctx.fillText(f.group, W / 2, 31, W - 60);
  ctx.fillStyle = c.ink;
  ctx.font = `800 43px ${DISPLAY}`;
  ctx.fillText("Enigma Premiado", W / 2, 70);
  ctx.fillStyle = c.muted;
  ctx.font = `700 21px ${SANS}`;
  ctx.fillText(f.date, W / 2, 96);

  const now = performance.now();
  const motion = f.spinning ? s.motion : null;
  const landed = motion?.progress === 1;
  const reducedMotion = prefersReducedMotion();
  const celebrationMs = f.celebrationAt !== undefined && !reducedMotion
    ? Math.max(0, now - f.celebrationAt)
    : undefined;
  const nextCourtesy = s.nextCourtesyAt !== null && now - s.nextCourtesyAt < COURTESY_INTRO_MS
    && !f.countdown && !f.spinning && !f.winner;
  if (f.summary) {
    paintSummary(ctx, c, f.summary, now - s.summaryPresentedAt);
  } else {
    paintSponsor(ctx, c, f, s.logo, s.sponsorPresentedAt);
    const rotation = motion?.rotation ?? f.rotation;
    const zoom = motion?.zoom ?? 1;
    const winnerVisible = !!f.winner || landed;
    paintWheel(
      ctx, c, f.names, rotation, W / 2, WHEEL_Y, WHEEL_RADIUS, zoom, motion?.pointerTilt ?? 0,
      winnerVisible, winnerVisible ? f.winnerIndex : undefined, reducedMotion,
    );
    if (f.winner && celebrationMs !== undefined) {
      const radius = WHEEL_RADIUS + WHEEL_BEZEL;
      paintWinnerConfetti(ctx, W / 2 - radius, WHEEL_Y - radius, 2 * radius, celebrationMs);
    }
    const focus = zoom > 1 ? f.names[segmentAtPointer(rotation, f.names.length)] : undefined;
    if (focus) {
      // Match the interface's raised zoom label, clear of the wheel hub.
      ctx.save();
      ctx.globalAlpha = wheelFocusOpacity(zoom);
      ctx.textAlign = "center";
      ctx.font = `800 27px ${DISPLAY}`;
      const lines = wrap(ctx, focus, W - 164, 2);
      const h = lines.length > 1 ? 92 : 62;
      const top = 805;
      ctx.fillStyle = c.bg;
      ctx.shadowColor = c.goldDeep;
      ctx.shadowBlur = 12;
      roundRect(ctx, 56, top, W - 112, h, 25);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = c.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = c.ink;
      lines.forEach((line, i) => ctx.fillText(line, W / 2, top + 40 + i * 30, W - 164));
      ctx.restore();
    }
  }

  if (nextCourtesy && !f.summary) {
    ctx.save();
    ctx.fillStyle = c.bg;
    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 3;
    roundRect(ctx, 125, 592, 470, 136, 28);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = c.gold;
    ctx.font = `800 42px ${DISPLAY}`;
    ctx.fillText("Próxima cortesia", W / 2, 654);
    ctx.fillStyle = c.ink;
    ctx.font = `800 27px ${SANS}`;
    ctx.fillText(f.roundLabel, W / 2, 697);
    ctx.restore();
  }

  if (f.countdown) {
    const { step, startedAt } = f.countdown;
    const elapsed = Math.max(0, now - startedAt);
    const pulse = reducedMotion ? 0 : Math.max(0, 1 - elapsed / 260);
    const width = step === "VALENDO!" ? 340 : 156;
    ctx.save();
    ctx.translate(W / 2, WHEEL_Y);
    ctx.scale(1 + 0.1 * pulse, 1 + 0.1 * pulse);
    ctx.fillStyle = c.bg;
    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 4;
    ctx.shadowColor = c.gold;
    ctx.shadowBlur = 8 + 12 * pulse;
    roundRect(ctx, -width / 2, -74, width, 148, 36);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = c.gold;
    ctx.font = `800 ${step === "VALENDO!" ? 53 : 104}px ${DISPLAY}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(step), 0, 0, width - 30);
    ctx.restore();
  }

  const infoWidth = s.video ? 414 : W - 60;
  const infoLeft = W - 30 - infoWidth;
  const infoCenter = infoLeft + infoWidth / 2;
  const infoTextWidth = infoWidth - 44;
  ctx.fillStyle = c.card;
  roundRect(ctx, infoLeft, 1000, infoWidth, 240, 28);
  ctx.fill();
  ctx.strokeStyle = "#f4d19038";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = "center";
  if (f.winner && !f.spinning && !f.summary) {
    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 5;
    roundRect(ctx, infoLeft, 1000, infoWidth, 240, 28);
    ctx.stroke();
    ctx.save();
    if (celebrationMs !== undefined) {
      const entrance = winnerEntryProgress(celebrationMs);
      ctx.beginPath();
      ctx.rect(infoLeft + 12, 1020, infoWidth - 24, 200);
      ctx.clip();
      ctx.globalAlpha = 0.4 + 0.6 * entrance;
      ctx.translate(0, 14 * (1 - entrance));
    }
    ctx.fillStyle = c.gold;
    ctx.font = `800 28px ${SANS}`;
    ctx.fillText(
      f.winnerNumber ? `🏆 GANHADOR(A) · Nº ${f.winnerNumber}` : "🏆 GANHADOR(A)",
      infoCenter,
      1050,
      infoTextWidth,
    );
    ctx.fillStyle = c.ink;
    const { size, lines } = fitText(f.winner, infoTextWidth, 3, [46, 40, 34, 28, 22], (text, px) => {
      ctx.font = `800 ${px}px ${DISPLAY}`;
      return ctx.measureText(text).width;
    });
    const lineHeight = Math.min(size * 1.14, 136 / lines.length);
    ctx.font = `800 ${Math.min(size, lineHeight / 1.08)}px ${DISPLAY}`;
    ctx.textBaseline = "middle";
    lines.forEach((line, i) =>
      ctx.fillText(line, infoCenter, 1145 + (i - (lines.length - 1) / 2) * lineHeight, infoTextWidth),
    );
    ctx.restore();
  } else {
    ctx.fillStyle = c.ink;
    ctx.font = `800 32px ${DISPLAY}`;
    const status = f.spinning
      ? (landed ? "Resultado" : "Girando…")
      : f.summary ? "Sorteio encerrado" : f.countdown ? "Contagem regressiva" : "Valendo!";
    ctx.fillText(status, infoCenter, 1110, infoTextWidth);
    ctx.fillStyle = c.muted;
    ctx.font = `700 24px ${SANS}`;
    ctx.fillText(
      f.summary
        ? `${f.summary.length} ${f.summary.length === 1 ? "cortesia sorteada" : "cortesias sorteadas"}`
        : `${f.names.length} ${f.names.length === 1 ? "nome" : "nomes"} na roleta`,
      infoCenter,
      1155,
      infoTextWidth,
    );
  }

  if (s.video) paintFace(s, s.video, ctx, 145, 1120, 111);
}

/**
 * Fit each field separately. Keep the phone intact even when the address needs both lines.
 * The ellipsis is reserved for copy that exceeds the card at the smallest readable size.
 */
function fitSponsorText(
  ctx: CanvasRenderingContext2D,
  text: string,
  width: number,
  maxLines: number,
  sizes: number[],
  family: string,
  weight = 800,
) {
  const { size, lines } = fitText(text, width, maxLines, sizes, (line, px) => {
    ctx.font = `${weight} ${px}px ${family}`;
    return ctx.measureText(line).width;
  });
  ctx.font = `${weight} ${size}px ${family}`;
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    const chars = Array.from(visible[maxLines - 1] ?? "");
    while (chars.length && ctx.measureText(`${chars.join("")}…`).width > width) chars.pop();
    visible[maxLines - 1] = `${chars.join("").trimEnd()}…`;
  }
  return visible;
}

function paintSponsor(
  ctx: CanvasRenderingContext2D,
  c: Palette,
  f: RecFrame,
  logo: HTMLImageElement | null,
  presentedAt: number,
) {
  const left = 30;
  const top = 112;
  const width = W - left * 2;
  const height = 190;
  const pad = 20;
  const right = left + width - pad;
  const hasContact = !!(f.address || f.phone);

  ctx.save();
  const surface = ctx.createLinearGradient(left, top, W - left, top + height);
  surface.addColorStop(0, c.card);
  surface.addColorStop(1, c.bg);
  ctx.fillStyle = surface;
  ctx.strokeStyle = "#f4d1905c";
  ctx.lineWidth = 2;
  roundRect(ctx, left, top, width, height, 24);
  ctx.fill();
  ctx.stroke();

  const sweep = (performance.now() - presentedAt) / 900;
  if (!f.spinning && !f.countdown && sweep >= 0 && sweep < 1 && !prefersReducedMotion()) {
    const center = left - 100 + (width + 200) * sweep;
    const glow = ctx.createLinearGradient(center - 100, 0, center + 100, 0);
    glow.addColorStop(0, "#ffe29600");
    glow.addColorStop(0.5, "#ffe296cc");
    glow.addColorStop(1, "#ffe29600");
    ctx.strokeStyle = glow;
    ctx.stroke();
  }

  ctx.textAlign = "left";
  ctx.fillStyle = c.gold;
  ctx.font = `800 16px ${SANS}`;
  ctx.fillText("OFERECIMENTO", left + pad, 136);

  if (f.roundLabel) {
    ctx.font = `800 18px ${SANS}`;
    const labelWidth = ctx.measureText(f.roundLabel).width + 24;
    ctx.fillStyle = "#f4d19026";
    roundRect(ctx, right - labelWidth, 119, labelWidth, 24, 12);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = c.gold;
    ctx.fillText(f.roundLabel, right - 12, 137);
    ctx.textAlign = "left";
  }

  const x = logo ? left + pad + 124 : left + pad;
  const textWidth = right - x;
  if (logo) {
    const tileWidth = 108;
    const tileHeight = hasContact ? 89 : 128;
    const tileTop = 146;
    ctx.fillStyle = "#ffffff10";
    ctx.strokeStyle = "#ffffff25";
    ctx.lineWidth = 1;
    roundRect(ctx, left + pad, tileTop, tileWidth, tileHeight, 14);
    ctx.fill();
    ctx.stroke();
    if (logo.naturalWidth && logo.naturalHeight) {
      const ratio = Math.min((tileWidth - 10) / logo.naturalWidth, (tileHeight - 10) / logo.naturalHeight);
      const imageWidth = logo.naturalWidth * ratio;
      const imageHeight = logo.naturalHeight * ratio;
      ctx.drawImage(
        logo,
        left + pad + (tileWidth - imageWidth) / 2,
        tileTop + (tileHeight - imageHeight) / 2,
        imageWidth,
        imageHeight,
      );
    } else {
      ctx.fillStyle = c.muted;
      ctx.font = `800 29px ${DISPLAY}`;
      ctx.textAlign = "center";
      ctx.fillText(initials(f.merchant), left + pad + tileWidth / 2, tileTop + tileHeight / 2 + 9);
      ctx.textAlign = "left";
    }
  }

  ctx.fillStyle = c.ink;
  const merchantLines = fitSponsorText(ctx, f.merchant, textWidth, 2, [25, 23, 21], SANS);
  merchantLines.forEach((line, i) => ctx.fillText(line, x, 163 + i * 20));

  ctx.fillStyle = c.gold;
  let prizeLines = fitSponsorText(
    ctx,
    f.prize,
    textWidth,
    hasContact ? 3 : 5 - merchantLines.length,
    [31, 28, 25, 23],
    DISPLAY,
  );
  if (hasContact && merchantLines.length === 2 && prizeLines.length === 3)
    prizeLines = fitSponsorText(ctx, f.prize, textWidth, 3, [23, 22, 21], DISPLAY);
  const prizeTop = merchantLines.length === 1 ? 191 : hasContact ? 205 : 211;
  const prizeLineHeight = hasContact && merchantLines.length === 2 ? 19 : 22;
  prizeLines.forEach((line, i) => ctx.fillText(line, x, prizeTop + i * prizeLineHeight));

  if (hasContact) {
    ctx.strokeStyle = "#f4d1903d";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left + pad, 248);
    ctx.lineTo(right, 248);
    ctx.stroke();

    ctx.font = `800 20px ${SANS}`;
    const phoneWidth = f.phone ? ctx.measureText(f.phone).width + 28 : 0;
    if (f.phone) {
      ctx.fillStyle = "#f4d19020";
      roundRect(ctx, right - phoneWidth, 253, phoneWidth, 34, 12);
      ctx.fill();
      ctx.fillStyle = c.ink;
      ctx.textAlign = "right";
      ctx.fillText(f.phone, right - 14, 277);
      ctx.textAlign = "left";
    }
    if (f.address) {
      ctx.fillStyle = c.ink;
      const addressWidth = right - (left + pad) - (phoneWidth ? phoneWidth + 20 : 0);
      const address = fitSponsorText(ctx, f.address, addressWidth, 2, [22, 21, 20, 19], SANS, 700);
      address.forEach((line, i) => ctx.fillText(line, left + pad, (address.length === 1 ? 277 : 269) + i * 19));
    }
  }
  ctx.restore();
}

function paintWheel(
  ctx: CanvasRenderingContext2D,
  c: Palette,
  names: string[],
  rotation: number,
  cx: number,
  cy: number,
  r: number,
  zoom: number,
  pointerTilt: number,
  pointerHighlighted: boolean,
  winnerIndex: number | undefined,
  steadyLamps: boolean,
) {
  const count = names.length;
  ctx.save();
  if (zoom > 1) {
    const top = cy - r - WHEEL_BEZEL;
    ctx.beginPath();
    ctx.rect(30, top, W - 60, 2 * (r + WHEEL_BEZEL));
    ctx.clip();
    ctx.translate(cx, top);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -top);
  }
  ctx.fillStyle = c.goldDeep;
  ctx.beginPath();
  ctx.arc(cx, cy, r + WHEEL_BEZEL, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fill();
  const firstLamp = rimLightIndex(rotation);
  for (let i = 0; i < RIM_LAMP_COUNT; i++) {
    const angle = (i * Math.PI * 2) / RIM_LAMP_COUNT - Math.PI / 2;
    const on = rimLampIsLit(i, firstLamp);
    const bright = !steadyLamps && on;
    const x = cx + Math.cos(angle) * (r + 11);
    const y = cy + Math.sin(angle) * (r + 11);
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = steadyLamps ? "#ffe7a5" : bright ? "#fffaf0" : "#d99517";
    if (bright) {
      ctx.shadowColor = "#fff5b8";
      ctx.shadowBlur = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  const seg = count > 0 ? 360 / count : 360;
  const rad = (d: number) => (d * Math.PI) / 180;
  if (count === 0) {
    ctx.fillStyle = c.card;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < count; i++) {
    const a0 = rad(-90 + i * seg + rotation);
    const a1 = rad(-90 + (i + 1) * seg + rotation);
    ctx.fillStyle = c.wheel[colorIndex(i, count)] ?? c.card;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, a0, a1);
    ctx.closePath();
    ctx.fill();
    if (count > 1) {
      ctx.strokeStyle = c.bg;
      ctx.lineWidth = count > 100 ? 0.36 : count > 40 ? 0.6 : 1.8;
      ctx.stroke();
    }
  }
  if (winnerIndex !== undefined && winnerIndex >= 0 && winnerIndex < count) {
    const start = rad(-90 + winnerIndex * seg + rotation);
    ctx.save();
    ctx.beginPath();
    if (count > 1) ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r * 0.97, start, start + rad(seg));
    ctx.closePath();
    ctx.fillStyle = "#ffd96b30";
    ctx.fill();
    ctx.strokeStyle = "#fff0b5";
    ctx.shadowColor = "#ffe18a";
    ctx.shadowBlur = 9;
    ctx.lineWidth = count > 100 ? 2.5 : 4.5;
    ctx.stroke();
    ctx.restore();
  }
  if (count > 0) {
    const size = wheelFontSize(count) * (r / 100);
    ctx.font = `800 ${size}px ${SANS}`;
    ctx.textBaseline = "middle";
    names.forEach((name, i) => {
      if (!name) return;
      const center = count === 1 ? 0 : (i + 0.5) * seg;
      const light = count > 1 && (colorIndex(i, count) === 1 || colorIndex(i, count) === 4);
      const flip = center > 180;
      const label = wheelLabel(name, count);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rad(-90 + center + rotation));
      ctx.fillStyle = light ? c.inkDark : c.ink;
      if (flip) {
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
        ctx.fillText(label, -r * 0.88, 0);
      } else {
        ctx.textAlign = "right";
        ctx.fillText(label, r * 0.88, 0);
      }
      ctx.restore();
    });
    ctx.textBaseline = "alphabetic";
  }
  // Hub and pointer
  ctx.fillStyle = c.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.bg;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Same stationary marker as the app: metallic finish, short click and final glow.
  ctx.save();
  ctx.translate(cx, cy - r - 22);
  ctx.rotate((pointerTilt * Math.PI) / 180);
  const gold = ctx.createLinearGradient(-26, -26, 26, 56);
  gold.addColorStop(0, "#fff5bf");
  gold.addColorStop(0.48, "#ffd452");
  gold.addColorStop(1, "#b87910");
  ctx.fillStyle = gold;
  ctx.strokeStyle = c.goldDeep;
  ctx.lineWidth = 3;
  if (pointerHighlighted) {
    ctx.shadowColor = "#fff0a1";
    ctx.shadowBlur = 18;
  }
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.lineTo(-26, 0);
  ctx.arc(0, 0, 26, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = c.bg;
  ctx.beginPath();
  ctx.arc(0, -7, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff6bb";
  ctx.beginPath();
  ctx.arc(-2, -9, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintSummary(
  ctx: CanvasRenderingContext2D,
  c: Palette,
  rows: NonNullable<RecFrame["summary"]>,
  elapsed: number,
) {
  const pages = Math.max(1, Math.ceil(rows.length / SUMMARY_ROWS_PER_PAGE));
  const page = Math.floor(Math.max(0, elapsed) / SUMMARY_PAGE_MS) % pages;
  const offset = page * SUMMARY_ROWS_PER_PAGE;
  const visible = rows.slice(offset, offset + SUMMARY_ROWS_PER_PAGE);
  ctx.fillStyle = c.card;
  ctx.strokeStyle = "#f4d1905c";
  ctx.lineWidth = 2;
  roundRect(ctx, 30, 112, W - 60, 858, 28);
  ctx.fill();
  ctx.stroke();
  ctx.textAlign = "center";
  ctx.fillStyle = c.gold;
  ctx.font = `800 43px ${DISPLAY}`;
  ctx.fillText("Resumo do sorteio", W / 2, 169);
  if (pages > 1) {
    ctx.fillStyle = c.muted;
    ctx.font = `800 23px ${SANS}`;
    ctx.fillText(`Página ${page + 1} de ${pages}`, W / 2, 203);
  }
  ctx.textAlign = "left";
  const rowH = Math.min(178, 744 / Math.max(1, visible.length));
  visible.forEach((row, i) => {
    const y = 211 + i * rowH;
    const x = 55;
    const width = W - 110;
    ctx.strokeStyle = "#f4d1903d";
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(W - x, y);
    ctx.stroke();

    ctx.fillStyle = c.gold;
    const label = row.number !== undefined ? `Prêmio ${offset + i + 1} · Nº ${row.number}` : `Prêmio ${offset + i + 1}`;
    ctx.font = `800 19px ${SANS}`;
    ctx.fillText(label, x, y + 26);

    ctx.fillStyle = c.ink;
    const winner = fitSponsorText(ctx, row.winner, width, 2, [32, 29, 26, 23], DISPLAY);
    winner.forEach((line, j) => ctx.fillText(line, x, y + 60 + j * 25));

    ctx.fillStyle = c.muted;
    const sponsor = fitSponsorText(ctx, `${row.prize} · ${row.merchant}`, width, 1, [23, 21, 19], SANS, 700);
    ctx.fillText(sponsor[0] ?? "", x, y + 111);
  });
}

function paintFace(
  s: Session,
  video: HTMLVideoElement,
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const c = s.colors;
  ctx.save();
  ctx.fillStyle = c.card;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  if (video.videoWidth > 0 && video.videoHeight > 0) {
    const side = Math.min(video.videoWidth, video.videoHeight);
    const sx = (video.videoWidth - side) / 2;
    const sy = (video.videoHeight - side) / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    // Mirrored, like looking in a mirror.
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.drawImage(video, sx, sy, side, side, -r, -r, r * 2, r * 2);
  }
  ctx.restore();
  ctx.save();
  ctx.strokeStyle = "#e9c47c4d";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.stroke();
  const rim = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  rim.addColorStop(0, "#ffe8ad");
  rim.addColorStop(0.55, c.gold);
  rim.addColorStop(1, c.goldDeep);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
