/**
 * Real recording (stage 8): the front camera and microphone plus a drawing of the
 * Roleta, all in one video. The Roleta sends what is on screen with `setRecFrame()`;
 * this module paints it on a canvas (wheel, prize, winner, face in a small circle)
 * and records that canvas with the voice. Browser-only and kept in memory.
 */
import { useSyncExternalStore } from "react";

import { pickType, recordedMusicLevel, type Needs } from "./capture";
import { fitText } from "./cards";
import { wheelEase } from "./jingle";
import { segmentAtPointer } from "./logic";
import { audioContext, setRecordTap } from "./sound";
import type { RecordingMode } from "./types";
import { pointerNudge, wheelFontSize, wheelLabel, wheelZoom } from "./wheel-visual";

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
  names: string[];
  rotation: number;
  /** Same animation as the on-screen wheel, timed with performance.now(). */
  spin: { from: number; to: number; startedAt: number; durationMs: number; zoom: boolean } | null;
  winner: string | null;
  /** Public number of the winner in the confirmed list (E06). */
  winnerNumber?: number | null;
  summary: { prize: string; merchant: string; winner: string }[] | null;
};

const W = 720;
const H = 1280;

type Session = {
  mode: RecordingMode;
  mic: boolean;
  canvas: HTMLCanvasElement | null;
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
  /** Optional on-screen host for the same video element used by the recorder. */
  cameraHost?: HTMLElement | null;
  frame: RecFrame;
  sound: boolean;
  volume: number;
};

export function startRecording(o: StartOptions): boolean {
  if (session) return false;
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
    mix.end();
    return false;
  }
  if (o.mode === "roleta-camera" && o.stream?.getVideoTracks().length) {
    video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.srcObject = o.stream;
    video.setAttribute("aria-label", "Câmera ao vivo");
    // The live view and the saved canvas share a single decoder and camera stream.
    if (o.cameraHost) o.cameraHost.appendChild(video);
    else {
      Object.assign(video.style, {
        position: "fixed", width: "2px", height: "2px", opacity: "0",
        pointerEvents: "none", left: "0", top: "0",
      });
      document.body.appendChild(video);
    }
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
    ctx,
    video,
    stream: o.stream,
    recorder,
    chunks,
    mimeType: recorder.mimeType || mimeType || (audioOnly ? "audio/webm" : "video/webm"),
    startedAt: Date.now(),
    drawId: o.drawId,
    frame: o.frame,
    colors: ctx ? readPalette(ctx) : FALLBACK,
    timer: null,
    mixEnd: mix.end,
  };
  try {
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
  if (session) session.frame = frame;
}

export function isRecording(): boolean {
  return session !== null;
}

/** Frees the camera and microphone, the live preview and the audio mix. */
function release(s: Session) {
  if (s.timer) clearInterval(s.timer);
  stopStream(s.stream);
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

  // Header
  ctx.textAlign = "center";
  ctx.fillStyle = c.gold;
  ctx.font = `800 34px ${DISPLAY}`;
  ctx.fillText(f.group, W / 2, 62);
  ctx.fillStyle = c.muted;
  ctx.font = `700 26px ${SANS}`;
  ctx.fillText(`Enigma Premiado · ${f.date}`, W / 2, 100);

  // Prize card: always readable, never covered by the face.
  ctx.fillStyle = c.card;
  roundRect(ctx, 30, 124, W - 60, 190, 28);
  ctx.fill();
  ctx.textAlign = "left";
  let y = 168;
  if (f.roundLabel) {
    ctx.fillStyle = c.gold;
    ctx.font = `800 28px ${SANS}`;
    ctx.fillText(f.roundLabel, 56, y);
    y += 44;
  }
  ctx.fillStyle = c.ink;
  ctx.font = `800 38px ${DISPLAY}`;
  for (const line of wrap(ctx, f.prize, W - 112, f.roundLabel ? 1 : 2)) {
    ctx.fillText(line, 56, y);
    y += 44;
  }
  ctx.fillStyle = c.muted;
  ctx.font = `700 26px ${SANS}`;
  ctx.fillText(wrap(ctx, `Oferecimento: ${f.merchant}`, W - 112, 1)[0] ?? "", 56, Math.max(y, 290));

  if (f.summary) paintSummary(ctx, c, f.summary);
  else {
    const spin = f.spin;
    const progress = spin
      ? Math.max(0, Math.min(1, (performance.now() - spin.startedAt) / spin.durationMs))
      : 0;
    const rotation = spin ? spin.from + (spin.to - spin.from) * wheelEase(progress) : f.rotation;
    const zoom = wheelZoom(progress, spin?.zoom ?? false);
    paintWheel(ctx, c, f.names, rotation, W / 2, 660, 300, zoom, !!spin, !!spin && progress < 1, !!f.winner || (!!spin && progress >= 1));
    const focus = zoom > 1 ? f.names[segmentAtPointer(rotation, f.names.length)] : undefined;
    if (focus) {
      // Match the interface's raised zoom label, clear of the wheel hub.
      ctx.save();
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

  // Bottom row: winner box on the left, face on the right.
  const infoWidth = s.video ? 414 : W - 60;
  const infoCenter = 30 + infoWidth / 2;
  const infoTextWidth = infoWidth - 44;
  ctx.fillStyle = c.card;
  roundRect(ctx, 30, 1000, infoWidth, 240, 28);
  ctx.fill();
  ctx.textAlign = "center";
  if (f.winner && !f.spin) {
    ctx.strokeStyle = c.gold;
    ctx.lineWidth = 5;
    roundRect(ctx, 30, 1000, infoWidth, 240, 28);
    ctx.stroke();
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
    ctx.textBaseline = "alphabetic";
  } else {
    ctx.fillStyle = c.muted;
    ctx.font = `800 32px ${DISPLAY}`;
    ctx.fillText(f.spin ? "Girando…" : f.summary ? "Sorteio encerrado" : "Valendo!", infoCenter, 1110, infoTextWidth);
    ctx.font = `700 24px ${SANS}`;
    ctx.fillText(
      `${f.names.length} ${f.names.length === 1 ? "nome" : "nomes"} na roleta`,
      infoCenter,
      1155,
      infoTextWidth,
    );
  }

  if (s.video) paintFace(s, s.video, ctx, 575, 1120, 111);
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
  spinning: boolean,
  pointerMoving: boolean,
  pointerHighlighted: boolean,
) {
  const count = names.length;
  ctx.save();
  if (zoom > 1) {
    const top = cy - r - 16;
    ctx.beginPath();
    ctx.rect(30, top, W - 60, 2 * (r + 16));
    ctx.clip();
    ctx.translate(cx, top);
    ctx.scale(zoom, zoom);
    ctx.translate(-cx, -top);
  }
  ctx.fillStyle = c.goldDeep;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = c.gold;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 8, 0, Math.PI * 2);
  ctx.fill();
  // Match the clockwise sequence in the interface (and its faster spin speed).
  const activeLight = Math.floor(performance.now() / (spinning ? 50 : 100)) % 24;
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24 - Math.PI / 2;
    const on = ((i - activeLight + 24) % 24) < 4;
    const x = cx + Math.cos(angle) * (r + 11);
    const y = cy + Math.sin(angle) * (r + 11);
    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = on ? "#fffaf0" : "#d99517";
    if (on) {
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
  ctx.rotate((pointerNudge(rotation, count, pointerMoving) * Math.PI) / 180);
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
  rows: { prize: string; merchant: string; winner: string }[],
) {
  ctx.fillStyle = c.card;
  roundRect(ctx, 30, 340, W - 60, 630, 28);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = c.gold;
  ctx.font = `800 36px ${DISPLAY}`;
  ctx.fillText("Resumo do sorteio", W / 2, 395);
  ctx.textAlign = "left";
  const rowH = Math.min(150, 540 / Math.max(1, rows.length));
  rows.forEach((row, i) => {
    const y = 430 + i * rowH;
    ctx.fillStyle = c.muted;
    ctx.font = `700 ${Math.min(24, rowH / 5)}px ${SANS}`;
    ctx.fillText(
      wrap(ctx, `Prêmio ${i + 1}: ${row.prize} · ${row.merchant}`, W - 120, 1)[0] ?? "",
      60,
      y + rowH * 0.3,
    );
    ctx.fillStyle = c.ink;
    ctx.font = `800 ${Math.min(40, rowH / 3)}px ${DISPLAY}`;
    ctx.fillText(wrap(ctx, `🎉 ${row.winner}`, W - 120, 1)[0] ?? "", 60, y + rowH * 0.7);
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
  ctx.strokeStyle = c.gold;
  ctx.lineWidth = 4;
  ctx.shadowColor = c.bg;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
