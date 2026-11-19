/**
 * Draws the share-as-image artwork on a canvas and turns it into vertical PNG files
 * (1080 × 1920). Browser-only: call from event handlers or effects.
 * What each picture shows comes from cards.ts; this file only paints it.
 */
import {
  cardFileName,
  fitText,
  initials,
  paginate,
  partLabel,
  participantsLabel,
  shopsLabel,
  wrapLines,
  type ListCard,
  type ListaoItem,
  type RiddleCard,
  type SummaryCard,
  type WinnerCard,
} from "./cards";
import { formatDateBR } from "./logic";
import { APP_NAME, GROUP_NAME } from "./types";

/** `numbers`: list pictures only, the public numbers printed on that picture (for checks). */
export type CardImage = { blob: Blob; url: string; filename: string; numbers?: number[] };

const W = 1080;
const H = 1920;
const M = 84; // side margin inside the frame
const CONTENT_W = W - 2 * M;
const FOOTER_TOP = H - 210;

const SANS = '"Nunito", system-ui, sans-serif';
const DISPLAY = '"Baloo 2", "Nunito", system-ui, sans-serif';

type Ctx = CanvasRenderingContext2D;
type Palette = {
  bg: string;
  card: string;
  glow: string;
  gold: string;
  goldDeep: string;
  goldGlow: string;
  ink: string;
  muted: string;
  inkDark: string;
  border: string;
};

const FALLBACK: Palette = {
  bg: "#1d0c2e",
  card: "#331250",
  glow: "#40166a",
  gold: "#f2c230",
  goldDeep: "#b9851c",
  goldGlow: "#fadc5a",
  ink: "#f7f2fc",
  muted: "#c9b8dd",
  inkDark: "#1f0b33",
  border: "#5a2f86",
};

/** The app's own color tokens, when the canvas understands them; otherwise close hex values. */
function readPalette(ctx: Ctx): Palette {
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
    glow: pick("--accent", FALLBACK.glow),
    gold: pick("--gold", FALLBACK.gold),
    goldDeep: pick("--gold-deep", FALLBACK.goldDeep),
    goldGlow: pick("--primary-glow", FALLBACK.goldGlow),
    ink: pick("--foreground", FALLBACK.ink),
    muted: pick("--muted-foreground", FALLBACK.muted),
    inkDark: pick("--primary-foreground", FALLBACK.inkDark),
    border: pick("--border", FALLBACK.border),
  };
}

/** The app's fonts must be ready before measuring, or line breaks would differ from the drawing. */
async function loadFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  const sample = "Enigma Premiado ÁÉÍÓÚãõç 0123456789";
  await Promise.allSettled([
    document.fonts.load(`800 64px "Baloo 2"`, sample),
    document.fonts.load(`700 64px "Baloo 2"`, sample),
    document.fonts.load(`700 40px "Nunito"`, sample),
    document.fonts.load(`800 40px "Nunito"`, sample),
  ]);
}

function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

type Kit = {
  ctx: Ctx;
  canvas: HTMLCanvasElement;
  pal: Palette;
  groupLogo: HTMLImageElement | null;
};

function newCanvas(groupLogo: HTMLImageElement | null): Kit {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  return { ctx, canvas, pal: readPalette(ctx), groupLogo };
}

function toFile(canvas: HTMLCanvasElement, filename: string): Promise<CardImage> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("png"));
      resolve({ blob, url: URL.createObjectURL(blob), filename });
    }, "image/png");
  });
}

// ---------- drawing helpers ----------

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function setFont(ctx: Ctx, weight: number, size: number, family: string, spacing = 0) {
  ctx.font = `${weight} ${size}px ${family}`;
  if ("letterSpacing" in ctx)
    (ctx as Ctx & { letterSpacing: string }).letterSpacing = `${spacing}px`;
}

function measurer(ctx: Ctx, weight: number, family: string) {
  return (t: string, size: number) => {
    setFont(ctx, weight, size, family);
    return ctx.measureText(t).width;
  };
}

function wrap(
  ctx: Ctx,
  text: string,
  width: number,
  weight: number,
  size: number,
  family: string,
): string[] {
  setFont(ctx, weight, size, family);
  return wrapLines(text, width, (t) => ctx.measureText(t).width);
}

function drawLines(ctx: Ctx, lines: string[], x: number, top: number, lineH: number, size: number) {
  // Text sits on a baseline about 0.78 of the font size below the line top.
  const pad = (lineH - size) / 2 + size * 0.78;
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lineH + pad));
}

function goldGradient(ctx: Ctx, pal: Palette, y0: number, y1: number) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, pal.goldGlow);
  g.addColorStop(0.55, pal.gold);
  g.addColorStop(1, pal.goldDeep);
  return g;
}

function sparkle(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Logo in a rounded tile, or the shop's initials when it has none. */
function drawLogo(
  k: Kit,
  img: HTMLImageElement | null,
  name: string,
  x: number,
  y: number,
  size: number,
) {
  const { ctx, pal } = k;
  ctx.save();
  rr(ctx, x, y, size, size, size * 0.22);
  if (img) {
    ctx.fillStyle = pal.ink;
    ctx.fill();
    ctx.clip();
    const s = Math.max(size / img.width, size / img.height);
    const w = img.width * s;
    const h = img.height * s;
    ctx.drawImage(img, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else {
    ctx.fillStyle = pal.glow;
    ctx.fill();
    ctx.lineWidth = Math.max(3, size * 0.03);
    ctx.strokeStyle = pal.gold;
    ctx.stroke();
    ctx.fillStyle = pal.gold;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setFont(ctx, 800, size * 0.4, DISPLAY);
    ctx.fillText(initials(name), x + size / 2, y + size / 2 + size * 0.03);
  }
  ctx.restore();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
}

/** Background, gold frame, the discreet "Enigma Premiado" line on top and the group signature. */
function drawFrame(k: Kit) {
  const { ctx, pal } = k;
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, -120, 60, W / 2, -120, 1250);
  glow.addColorStop(0, pal.glow);
  glow.addColorStop(1, pal.bg);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.lineWidth = 3;
  ctx.strokeStyle = goldGradient(ctx, pal, 0, H);
  rr(ctx, 36, 36, W - 72, H - 72, 44);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  rr(ctx, 50, 50, W - 100, H - 100, 34);
  ctx.stroke();
  ctx.restore();

  // Discreet top line.
  ctx.fillStyle = pal.muted;
  ctx.textAlign = "center";
  setFont(ctx, 800, 28, SANS, 8);
  const top = APP_NAME.toUpperCase();
  ctx.fillText(top, W / 2, 118);
  const tw = ctx.measureText(top).width;
  ctx.strokeStyle = pal.goldDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - tw / 2 - 96, 108);
  ctx.lineTo(W / 2 - tw / 2 - 24, 108);
  ctx.moveTo(W / 2 + tw / 2 + 24, 108);
  ctx.lineTo(W / 2 + tw / 2 + 96, 108);
  ctx.stroke();
  sparkle(ctx, W / 2 - tw / 2 - 108, 108, 9, pal.gold);
  sparkle(ctx, W / 2 + tw / 2 + 108, 108, 9, pal.gold);

  // Signature.
  ctx.strokeStyle = pal.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(M + 40, FOOTER_TOP + 30);
  ctx.lineTo(W - M - 40, FOOTER_TOP + 30);
  ctx.stroke();
  const badge = 76;
  setFont(ctx, 800, 34, SANS, 3);
  const sw = ctx.measureText(GROUP_NAME).width;
  const total = badge + 22 + sw;
  const bx = (W - total) / 2;
  const by = FOOTER_TOP + 70;
  ctx.save();
  ctx.beginPath();
  ctx.arc(bx + badge / 2, by + badge / 2, badge / 2, 0, Math.PI * 2);
  ctx.fillStyle = pal.card;
  ctx.fill();
  if (k.groupLogo) {
    ctx.save();
    ctx.clip();
    const img = k.groupLogo;
    const s = Math.max(badge / img.width, badge / img.height);
    ctx.drawImage(
      img,
      bx + (badge - img.width * s) / 2,
      by + (badge - img.height * s) / 2,
      img.width * s,
      img.height * s,
    );
    ctx.restore();
  } else {
    ctx.fillStyle = pal.gold;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    setFont(ctx, 800, 30, DISPLAY);
    ctx.fillText("CJ", bx + badge / 2, by + badge / 2 + 2);
    ctx.textBaseline = "alphabetic";
  }
  ctx.lineWidth = 4;
  ctx.strokeStyle = pal.gold;
  ctx.beginPath();
  ctx.arc(bx + badge / 2, by + badge / 2, badge / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = pal.ink;
  ctx.textAlign = "left";
  setFont(ctx, 800, 34, SANS, 3);
  ctx.fillText(GROUP_NAME, bx + badge + 22, by + badge / 2 + 12);
}

/** Where content starts below the header, always leaving room for a "Parte 1 de 2" pill. */
function contentTop(probe: Kit, title: string, subtitle: string): number {
  return drawHeader(probe, title, subtitle, "Parte 9 de 9");
}

/** Title, date line and "Parte 1 de 3"; returns where the content can start. */
function drawHeader(k: Kit, title: string, subtitle: string, part: string | null): number {
  const { ctx, pal } = k;
  const fit = fitText(title, CONTENT_W, 2, [92, 84, 76, 68], measurer(ctx, 800, DISPLAY));
  const lineH = fit.size * 1.08;
  let y = 160;
  ctx.textAlign = "center";
  ctx.fillStyle = pal.ink;
  setFont(ctx, 800, fit.size, DISPLAY);
  drawLines(ctx, fit.lines, W / 2, y, lineH, fit.size);
  y += fit.lines.length * lineH + 6;
  ctx.fillStyle = pal.gold;
  const sub = wrap(ctx, subtitle, CONTENT_W, 800, 42, SANS);
  setFont(ctx, 800, 42, SANS);
  drawLines(ctx, sub, W / 2, y, 54, 42);
  y += sub.length * 54;
  if (part) {
    setFont(ctx, 800, 30, SANS, 2);
    const pw = ctx.measureText(part).width + 56;
    y += 14;
    rr(ctx, (W - pw) / 2, y, pw, 54, 27);
    ctx.fillStyle = pal.card;
    ctx.fill();
    ctx.strokeStyle = pal.goldDeep;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = pal.ink;
    ctx.fillText(part, W / 2, y + 38);
    y += 54;
  }
  ctx.textAlign = "left";
  return y + 34;
}

// ---------- 1. Lista de participantes ----------

const COL_GAP = 28;
const COL_W = (CONTENT_W - COL_GAP) / 2;
const NUM_W = 78;
const NAME_SIZE = 40;
const NAME_LH = 50;
const ROW_PAD = 14;
const ROW_GAP = 10;

type CourtesyBlock = {
  lines: { text: string[]; size: number; lh: number; color: "gold" | "muted" | "label" }[];
  height: number;
};

function measureCourtesies(k: Kit, list: ListCard): CourtesyBlock {
  const { ctx } = k;
  const inner = CONTENT_W - 64;
  const multi = list.courtesies.length > 1;
  const lines: CourtesyBlock["lines"] = [];
  list.courtesies.forEach((c, i) => {
    if (multi) lines.push({ text: [`PRÊMIO ${i + 1}`], size: 26, lh: 36, color: "label" });
    lines.push({
      text: wrap(ctx, c.prize, inner, 800, 46, DISPLAY),
      size: 46,
      lh: 54,
      color: "gold",
    });
    lines.push({
      text: wrap(ctx, `Oferecimento: ${c.merchantName}`, inner, 700, 32, SANS),
      size: 32,
      lh: 42,
      color: "muted",
    });
  });
  const height =
    48 + lines.reduce((s, l) => s + l.text.length * l.lh, 0) + (list.courtesies.length - 1) * 22;
  return { lines, height };
}

function drawCourtesies(k: Kit, block: CourtesyBlock, y: number, perCourtesy: number) {
  const { ctx, pal } = k;
  rr(ctx, M, y, CONTENT_W, block.height, 32);
  ctx.fillStyle = pal.card;
  ctx.fill();
  ctx.strokeStyle = pal.goldDeep;
  ctx.lineWidth = 2;
  ctx.stroke();
  let cy = y + 24;
  block.lines.forEach((l, i) => {
    if (i > 0 && i % perCourtesy === 0) cy += 22;
    ctx.fillStyle = l.color === "gold" ? pal.gold : pal.muted;
    setFont(
      ctx,
      l.color === "gold" ? 800 : l.color === "label" ? 800 : 700,
      l.size,
      l.color === "gold" ? DISPLAY : SANS,
      l.color === "label" ? 4 : 0,
    );
    drawLines(ctx, l.text, M + 32, cy, l.lh, l.size);
    cy += l.text.length * l.lh;
  });
}

function drawPill(k: Kit, text: string, y: number): number {
  const { ctx, pal } = k;
  setFont(ctx, 800, 38, SANS);
  const w = ctx.measureText(text).width + 72;
  rr(ctx, (W - w) / 2, y, w, 70, 35);
  ctx.fillStyle = goldGradient(ctx, pal, y, y + 70);
  ctx.fill();
  ctx.fillStyle = pal.inkDark;
  ctx.textAlign = "center";
  ctx.fillText(text, W / 2, y + 48);
  ctx.textAlign = "left";
  return y + 70;
}

export async function renderListCards(list: ListCard, groupLogoSrc?: string): Promise<CardImage[]> {
  await loadFonts();
  const groupLogo = await loadImage(groupLogoSrc);
  const probe = newCanvas(groupLogo);
  const subtitle = `Sorteio de ${formatDateBR(list.date)}`;
  const perCourtesy = list.courtesies.length > 1 ? 3 : 2;
  const courtesies = measureCourtesies(probe, list);

  // Names keep their size; long ones take a second line instead of shrinking.
  const measureNames = (colW: number) => {
    const lines = list.names.map((n) =>
      wrap(probe.ctx, n, colW - NUM_W - 24, 800, NAME_SIZE, DISPLAY),
    );
    return { lines, heights: lines.map((l) => l.length * NAME_LH + ROW_PAD * 2) };
  };

  const top = contentTop(probe, "Participantes confirmados", subtitle);
  const firstExtra = courtesies.height + 28 + 70 + 30;
  const bottom = FOOTER_TOP - 10;
  const colCap = (col: number) => (col < 2 ? bottom - top - firstExtra : bottom - top - 70 - 30);
  // A short list that fits one wide column stays in one column; longer lists use two.
  const wide = measureNames(CONTENT_W);
  const oneColumn = paginate(wide.heights, colCap, ROW_GAP).length === 1;
  const colW = oneColumn ? CONTENT_W : COL_W;
  const { lines: nameLines, heights } = oneColumn ? wide : measureNames(COL_W);
  const columns = paginate(heights, colCap, ROW_GAP);
  const pages: number[][][] = [];
  for (let i = 0; i < columns.length; i += 2) pages.push(columns.slice(i, i + 2));

  const out: CardImage[] = [];
  for (let p = 0; p < pages.length; p++) {
    const k = newCanvas(groupLogo);
    drawFrame(k);
    let y = drawHeader(k, "Participantes confirmados", subtitle, partLabel(p, pages.length));
    if (p === 0) {
      drawCourtesies(k, courtesies, y, perCourtesy);
      y += courtesies.height + 28;
    }
    y = drawPill(k, participantsLabel(list.names.length), y) + 30;
    const page = pages[p] ?? [];
    page.forEach((col, c) => {
      const x = M + c * (colW + COL_GAP);
      let ry = y;
      for (const i of col) {
        const lines = nameLines[i] ?? [""];
        const h = heights[i] ?? 0;
        rr(k.ctx, x, ry, colW, h, 18);
        k.ctx.fillStyle = k.pal.card;
        k.ctx.fill();
        k.ctx.fillStyle = k.pal.gold;
        k.ctx.textAlign = "right";
        setFont(k.ctx, 800, NAME_SIZE, DISPLAY);
        drawLines(k.ctx, [`${i + 1}`], x + NUM_W, ry + ROW_PAD, NAME_LH, NAME_SIZE);
        k.ctx.textAlign = "left";
        k.ctx.fillStyle = k.pal.ink;
        setFont(k.ctx, 800, NAME_SIZE, DISPLAY);
        drawLines(k.ctx, lines, x + NUM_W + 20, ry + ROW_PAD, NAME_LH, NAME_SIZE);
        ry += h + ROW_GAP;
      }
    });
    if (list.names.length === 0) {
      k.ctx.fillStyle = k.pal.muted;
      k.ctx.textAlign = "center";
      setFont(k.ctx, 700, 40, SANS);
      k.ctx.fillText("Nenhum nome confirmado ainda", W / 2, y + 80);
      k.ctx.textAlign = "left";
    }
    const img = await toFile(k.canvas, cardFileName("lista", list.date, p, pages.length));
    out.push({ ...img, numbers: page.flat().map((i) => i + 1) });
  }
  return out;
}

// ---------- 2. Listão da Alegria ----------

const LOGO = 150;
const BLOCK_PAD = 30;
const BLOCK_GAP = 26;

export async function renderListaoCards(
  today: string,
  items: ListaoItem[],
  groupLogoSrc?: string,
): Promise<CardImage[]> {
  await loadFonts();
  const groupLogo = await loadImage(groupLogoSrc);
  const logos = new Map<string, HTMLImageElement | null>();
  for (const it of items)
    if (it.kind === "shop" && !logos.has(it.id)) logos.set(it.id, await loadImage(it.logo));
  const probe = newCanvas(groupLogo);
  const textW = CONTENT_W - 2 * BLOCK_PAD - LOGO - 30;
  const layout = items.map((it) => {
    if (it.kind === "section") return { it, name: [] as string[], note: [] as string[], h: 86 };
    const name = wrap(probe.ctx, it.name, textW, 800, 56, DISPLAY);
    const note = wrap(probe.ctx, it.note, textW, 700, 32, SANS);
    const textH = name.length * 62 + 8 + note.length * 42;
    return { it, name, note, h: Math.max(LOGO, textH) + 2 * BLOCK_PAD };
  });
  const active = items.filter(
    (i) => i.kind === "shop" && i.note.startsWith("Em divulgação"),
  ).length;
  const subtitle = `${formatDateBR(today)} · ${shopsLabel(active)}`;
  const top = contentTop(probe, "Listão da Alegria", subtitle);
  const cap = FOOTER_TOP - 20 - top;
  const pages = paginate(
    layout.map((l) => l.h),
    () => cap,
    BLOCK_GAP,
  );
  // A "Agendados" title never ends a picture on its own.
  for (let p = 0; p < pages.length - 1; p++) {
    const page = pages[p] ?? [];
    const last = page[page.length - 1];
    const next = pages[p + 1];
    if (last !== undefined && next && page.length > 1 && layout[last]?.it.kind === "section")
      next.unshift(page.pop()!);
  }

  const out: CardImage[] = [];
  for (let p = 0; p < pages.length; p++) {
    const k = newCanvas(groupLogo);
    const { ctx, pal } = k;
    drawFrame(k);
    let y = drawHeader(k, "Listão da Alegria", subtitle, partLabel(p, pages.length));
    if (items.length === 0) {
      ctx.fillStyle = pal.muted;
      ctx.textAlign = "center";
      setFont(ctx, 700, 44, SANS);
      drawLines(
        ctx,
        wrap(ctx, "Nenhum comércio em divulgação hoje", CONTENT_W, 700, 44, SANS),
        W / 2,
        y + 120,
        56,
        44,
      );
      ctx.textAlign = "left";
    }
    for (const i of pages[p] ?? []) {
      const l = layout[i];
      if (!l) continue;
      if (l.it.kind === "section") {
        ctx.fillStyle = pal.ink;
        setFont(ctx, 800, 50, DISPLAY);
        drawLines(ctx, [l.it.title], M + 8, y + 10, 64, 50);
        ctx.strokeStyle = pal.goldDeep;
        ctx.lineWidth = 2;
        setFont(ctx, 800, 50, DISPLAY);
        const tw = ctx.measureText(l.it.title).width;
        ctx.beginPath();
        ctx.moveTo(M + 8 + tw + 24, y + 44);
        ctx.lineTo(W - M, y + 44);
        ctx.stroke();
        y += l.h + BLOCK_GAP;
        continue;
      }
      const scheduled = !l.it.note.startsWith("Em divulgação");
      rr(ctx, M, y, CONTENT_W, l.h, 32);
      ctx.fillStyle = pal.card;
      ctx.fill();
      ctx.strokeStyle = scheduled ? pal.border : pal.goldDeep;
      ctx.lineWidth = 2;
      ctx.stroke();
      drawLogo(k, logos.get(l.it.id) ?? null, l.it.name, M + BLOCK_PAD, y + (l.h - LOGO) / 2, LOGO);
      const textH = l.name.length * 62 + 8 + l.note.length * 42;
      let ty = y + (l.h - textH) / 2;
      const tx = M + BLOCK_PAD + LOGO + 30;
      ctx.fillStyle = scheduled ? pal.ink : pal.gold;
      setFont(ctx, 800, 56, DISPLAY);
      drawLines(ctx, l.name, tx, ty, 62, 56);
      ty += l.name.length * 62 + 8;
      ctx.fillStyle = pal.muted;
      setFont(ctx, 700, 32, SANS);
      drawLines(ctx, l.note, tx, ty, 42, 32);
      y += l.h + BLOCK_GAP;
    }
    out.push(await toFile(k.canvas, cardFileName("listao", today, p, pages.length)));
  }
  return out;
}

// ---------- 3. Ganhador ----------

function drawTrophy(k: Kit, cx: number, top: number, size: number) {
  const { ctx, pal } = k;
  const s = size / 100;
  ctx.save();
  // Soft halo and a few rays.
  const halo = ctx.createRadialGradient(cx, top + 45 * s, 10, cx, top + 45 * s, 120 * s);
  halo.addColorStop(0, "rgba(255, 214, 90, 0.28)");
  halo.addColorStop(1, "rgba(255, 214, 90, 0)");
  ctx.fillStyle = halo;
  ctx.fillRect(cx - 130 * s, top - 80 * s, 260 * s, 260 * s);
  ctx.strokeStyle = pal.goldDeep;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  for (const a of [-60, -35, 35, 60]) {
    const r = (a * Math.PI) / 180;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(r) * 78 * s, top + 45 * s - Math.cos(r) * 78 * s);
    ctx.lineTo(cx + Math.sin(r) * 112 * s, top + 45 * s - Math.cos(r) * 112 * s);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = goldGradient(ctx, pal, top, top + size);
  ctx.strokeStyle = goldGradient(ctx, pal, top, top + size);
  // Handles.
  ctx.lineWidth = 8 * s;
  ctx.beginPath();
  ctx.arc(cx - 34 * s, top + 26 * s, 16 * s, Math.PI * 0.5, Math.PI * 1.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx + 34 * s, top + 26 * s, 16 * s, Math.PI * 1.5, Math.PI * 0.5);
  ctx.stroke();
  // Cup.
  ctx.beginPath();
  ctx.moveTo(cx - 36 * s, top + 6 * s);
  ctx.lineTo(cx + 36 * s, top + 6 * s);
  ctx.quadraticCurveTo(cx + 36 * s, top + 60 * s, cx, top + 64 * s);
  ctx.quadraticCurveTo(cx - 36 * s, top + 60 * s, cx - 36 * s, top + 6 * s);
  ctx.fill();
  // Stem and base.
  ctx.fillRect(cx - 6 * s, top + 62 * s, 12 * s, 16 * s);
  rr(ctx, cx - 26 * s, top + 76 * s, 52 * s, 12 * s, 4 * s);
  ctx.fill();
  rr(ctx, cx - 34 * s, top + 86 * s, 68 * s, 12 * s, 4 * s);
  ctx.fill();
  ctx.restore();
  sparkle(ctx, cx - 92 * s, top + 4 * s, 12 * s, pal.goldGlow);
  sparkle(ctx, cx + 96 * s, top + 70 * s, 9 * s, pal.goldGlow);
}

function divider(k: Kit, y: number, width = 360) {
  const { ctx, pal } = k;
  ctx.strokeStyle = pal.goldDeep;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - width / 2, y);
  ctx.lineTo(W / 2 - 22, y);
  ctx.moveTo(W / 2 + 22, y);
  ctx.lineTo(W / 2 + width / 2, y);
  ctx.stroke();
  ctx.save();
  ctx.translate(W / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = pal.gold;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

export async function renderWinnerCard(
  card: WinnerCard,
  groupLogoSrc?: string,
): Promise<CardImage> {
  await loadFonts();
  const k = newCanvas(await loadImage(groupLogoSrc));
  const logo = await loadImage(card.merchantLogo);
  const { ctx, pal } = k;
  drawFrame(k);
  let y = drawHeader(k, "Resultado do sorteio", formatDateBR(card.date), card.label);

  const textW = CONTENT_W - 40;
  const room = FOOTER_TOP - 30 - y;
  // From roomy to compact: the first layout that fits the picture wins, so long names
  // and prizes get smaller instead of running into the signature.
  const layouts = [
    {
      trophy: 140,
      winner: [150, 136, 124, 112, 100, 90, 80, 72],
      prize: [72, 66, 60, 54, 48],
      logo: 170,
      gap: 1,
    },
    {
      trophy: 110,
      winner: [120, 110, 100, 90, 80, 72, 64],
      prize: [60, 54, 48, 44, 40],
      logo: 130,
      gap: 0.75,
    },
    {
      trophy: 80,
      winner: [96, 88, 80, 72, 64, 58],
      prize: [50, 46, 42, 38, 34],
      logo: 104,
      gap: 0.5,
    },
  ];
  const plan = (l: (typeof layouts)[number]) => {
    const winner = fitText(card.winner, textW, 3, l.winner, measurer(ctx, 800, DISPLAY));
    const prize = fitText(card.prize, textW, 3, l.prize, measurer(ctx, 800, DISPLAY));
    const shop = fitText(
      card.merchantName,
      textW,
      2,
      [52, 46, 42, 38, 34],
      measurer(ctx, 800, DISPLAY),
    );
    const g = (n: number) => n * l.gap;
    const trophyArea = l.trophy * 1.75; // rays and halo reach above the cup
    const height =
      trophyArea +
      g(20) +
      46 +
      12 +
      winner.lines.length * winner.size * 1.05 +
      g(44) +
      20 +
      g(40) +
      40 +
      10 +
      prize.lines.length * prize.size * 1.15 +
      g(48) +
      40 +
      18 +
      l.logo +
      18 +
      shop.lines.length * shop.size * 1.15;
    return { l, winner, prize, shop, g, trophyArea, height };
  };
  let chosen = plan(layouts[0]!);
  for (const l of layouts) {
    chosen = plan(l);
    if (chosen.height <= room) break;
  }
  const { l, winner, prize, shop, g, trophyArea } = chosen;
  const winnerLH = winner.size * 1.05;
  const prizeLH = prize.size * 1.15;
  const shopLH = shop.size * 1.15;
  y += Math.max(0, (room - chosen.height) / 2);

  drawTrophy(k, W / 2, y + l.trophy * 0.7, l.trophy);
  y += trophyArea + g(20);
  ctx.textAlign = "center";
  ctx.fillStyle = pal.gold;
  setFont(ctx, 800, 40, DISPLAY, 4);
  ctx.fillText(card.number ? `GANHADOR(A) · Nº ${card.number}` : "GANHADOR(A)", W / 2, y + 36);
  y += 46 + 12;
  ctx.fillStyle = pal.ink;
  setFont(ctx, 800, winner.size, DISPLAY);
  drawLines(ctx, winner.lines, W / 2, y, winnerLH, winner.size);
  y += winner.lines.length * winnerLH + g(44);
  divider(k, y + 10);
  y += 20 + g(40);
  ctx.fillStyle = pal.muted;
  setFont(ctx, 800, 30, SANS, 6);
  ctx.fillText("CORTESIA", W / 2, y + 30);
  y += 40 + 10;
  ctx.fillStyle = pal.gold;
  setFont(ctx, 800, prize.size, DISPLAY);
  drawLines(ctx, prize.lines, W / 2, y, prizeLH, prize.size);
  y += prize.lines.length * prizeLH + g(48);
  ctx.fillStyle = pal.muted;
  setFont(ctx, 800, 30, SANS, 6);
  ctx.fillText("OFERECIMENTO", W / 2, y + 30);
  y += 40 + 18;
  drawLogo(k, logo, card.merchantName, (W - l.logo) / 2, y, l.logo);
  y += l.logo + 18;
  ctx.textAlign = "center";
  ctx.fillStyle = pal.ink;
  setFont(ctx, 800, shop.size, DISPLAY);
  drawLines(ctx, shop.lines, W / 2, y, shopLH, shop.size);
  ctx.textAlign = "left";
  return toFile(
    k.canvas,
    cardFileName("ganhador", card.date, 0, 1, card.label ? card.round : undefined),
  );
}

export async function renderSummaryCards(
  card: SummaryCard,
  groupLogoSrc?: string,
): Promise<CardImage[]> {
  await loadFonts();
  const groupLogo = await loadImage(groupLogoSrc);
  const logos = await Promise.all(card.rows.map((r) => loadImage(r.merchantLogo)));
  const probe = newCanvas(groupLogo);
  const L = 110;
  const textW = CONTENT_W - 60 - L - 26;
  const layout = card.rows.map((r) => {
    const head = wrap(
      probe.ctx,
      `${r.label.toUpperCase()} · ${r.merchantName}`,
      textW,
      800,
      28,
      SANS,
    );
    const prize = wrap(probe.ctx, r.prize, textW, 800, 40, DISPLAY);
    const winner = wrap(
      probe.ctx,
      r.number ? `Nº ${r.number} · ${r.winner}` : r.winner,
      CONTENT_W - 60 - 72,
      800,
      60,
      DISPLAY,
    );
    const topH = Math.max(L, head.length * 38 + 6 + prize.length * 48);
    return { head, prize, winner, topH, h: 30 + topH + 24 + winner.length * 68 + 30 };
  });
  const subtitle = `${formatDateBR(card.date)} · ${card.rows.length} cortesias`;
  const top = contentTop(probe, "Resultado do sorteio", subtitle);
  const pages = paginate(
    layout.map((l) => l.h),
    () => FOOTER_TOP - 20 - top,
    24,
  );

  const out: CardImage[] = [];
  for (let p = 0; p < pages.length; p++) {
    const k = newCanvas(groupLogo);
    const { ctx, pal } = k;
    drawFrame(k);
    let y = drawHeader(k, "Resultado do sorteio", subtitle, partLabel(p, pages.length));
    for (const i of pages[p] ?? []) {
      const l = layout[i];
      const r = card.rows[i];
      if (!l || !r) continue;
      rr(ctx, M, y, CONTENT_W, l.h, 32);
      ctx.fillStyle = pal.card;
      ctx.fill();
      ctx.strokeStyle = pal.goldDeep;
      ctx.lineWidth = 2;
      ctx.stroke();
      const x = M + 30;
      drawLogo(k, logos[i] ?? null, r.merchantName, x, y + 30, L);
      let ty = y + 30 + (l.topH - (l.head.length * 38 + 6 + l.prize.length * 48)) / 2;
      ctx.fillStyle = pal.muted;
      setFont(ctx, 800, 28, SANS, 2);
      drawLines(ctx, l.head, x + L + 26, ty, 38, 28);
      ty += l.head.length * 38 + 6;
      ctx.fillStyle = pal.gold;
      setFont(ctx, 800, 40, DISPLAY);
      drawLines(ctx, l.prize, x + L + 26, ty, 48, 40);
      const wy = y + 30 + l.topH + 24;
      ctx.strokeStyle = pal.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, wy - 12);
      ctx.lineTo(W - M - 30, wy - 12);
      ctx.stroke();
      drawTrophy(k, x + 28, wy + 14, 40);
      ctx.fillStyle = pal.ink;
      setFont(ctx, 800, 60, DISPLAY);
      drawLines(ctx, l.winner, x + 72, wy, 68, 60);
      y += l.h + 24;
    }
    out.push(await toFile(k.canvas, cardFileName("resumo", card.date, p, pages.length)));
  }
  return out;
}

/** E08: the riddle art (no answer) or the answer art (answer in big letters). */
export async function renderRiddleCard(
  card: RiddleCard,
  groupLogoSrc?: string,
): Promise<CardImage> {
  await loadFonts();
  const k = newCanvas(await loadImage(groupLogoSrc));
  const img = await loadImage(card.image);
  const { ctx, pal } = k;
  drawFrame(k);
  let y = drawHeader(
    k,
    card.kind === "enigma" ? "Enigma Premiado" : "Resposta do Enigma",
    formatDateBR(card.date),
    null,
  );
  const room = FOOTER_TOP - 30 - y;
  ctx.textAlign = "center";
  const head = fitText(
    card.kind === "enigma" ? card.headline.toUpperCase() : card.headline,
    CONTENT_W - 40,
    3,
    card.kind === "enigma" ? [56, 50, 44] : [140, 120, 104, 90, 78, 66],
    measurer(ctx, 800, DISPLAY),
  );
  const body = card.text
    ? fitText(card.text, CONTENT_W - 40, 8, [64, 58, 52, 46, 40, 36], measurer(ctx, 800, DISPLAY))
    : null;
  const headH = head.lines.length * head.size * 1.1;
  const bodyH = body ? body.lines.length * body.size * 1.2 + 40 : 0;
  const imgMax = Math.max(0, room - headH - bodyH - 80);
  let iw = 0;
  let ih = 0;
  if (img && imgMax > 120) {
    const scale = Math.min(CONTENT_W / img.width, imgMax / img.height);
    iw = img.width * scale;
    ih = img.height * scale;
  }
  y += Math.max(0, (room - headH - bodyH - (ih ? ih + 40 : 0)) / 2);
  ctx.fillStyle = pal.gold;
  setFont(ctx, 800, head.size, DISPLAY);
  drawLines(ctx, head.lines, W / 2, y, head.size * 1.1, head.size);
  y += headH + 40;
  if (img && ih) {
    ctx.drawImage(img, (W - iw) / 2, y, iw, ih);
    ctx.strokeStyle = pal.gold;
    ctx.lineWidth = 6;
    ctx.strokeRect((W - iw) / 2, y, iw, ih);
    y += ih + 40;
  }
  if (body) {
    ctx.fillStyle = pal.ink;
    setFont(ctx, 800, body.size, DISPLAY);
    drawLines(ctx, body.lines, W / 2, y, body.size * 1.2, body.size);
  }
  ctx.textAlign = "left";
  return toFile(k.canvas, cardFileName(card.kind, card.date));
}

export function releaseCards(cards: CardImage[]) {
  for (const c of cards) URL.revokeObjectURL(c.url);
}
