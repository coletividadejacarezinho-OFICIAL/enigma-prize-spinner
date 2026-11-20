import { useEffect, useId, useRef } from "react";
import { WinnerConfetti } from "@/components/enigma/WinnerConfetti";
import { wheelEase } from "@/lib/enigma/jingle";
import { segmentAtPointer } from "@/lib/enigma/logic";
import {
  pointerClickTilt,
  rimLampIsLit,
  rimLightIndex,
  RIM_LAMP_COUNT,
  WHEEL_CLOSEUP_MS,
  wheelFocusOpacity,
  wheelFontSize,
  wheelLabel,
  wheelZoom,
  type WheelMotion,
} from "@/lib/enigma/wheel-visual";

const COLORS = 8;
// Segments whose color is light enough to need dark letters.
const LIGHT = new Set([1, 4]);

function point(angleDeg: number, r: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: 100 + r * Math.sin(a), y: 100 - r * Math.cos(a) };
}

function colorIndex(i: number, count: number) {
  let c = i % COLORS;
  // Avoid the last slice matching the first one.
  if (count > 1 && i === count - 1 && c === 0) c = 2;
  return c;
}

function slicePath(index: number, degrees: number, radius: number): string {
  const start = point(index * degrees, radius);
  const end = point((index + 1) * degrees, radius);
  return `M100 100 L${start.x} ${start.y} A${radius} ${radius} 0 ${degrees > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
}

type Props = {
  names: string[];
  rotation: number;
  /** When set, the wheel animates from `from` to `rotation`. */
  spin?: { from: number; durationMs: number; key: number; zoom: boolean; holdMs?: number } | null;
  idle?: boolean;
  winner?: boolean;
  winnerIndex?: number | undefined;
  celebrationAt?: number | undefined;
  onIdleRotation?: (rotation: number) => void;
  onSpinFrame?: (motion: WheelMotion) => void;
  onSpinStart?: (durationMs: number) => (() => void) | undefined;
  onSpinLand?: () => void;
  onTick?: () => void;
  onSpinEnd?: () => void;
};

export function Wheel({ names, rotation, spin, idle = false, winner = false, winnerIndex, celebrationAt, onIdleRotation, onSpinFrame, onSpinStart, onSpinLand, onTick, onSpinEnd }: Props) {
  // The whole <svg> turns (its centre is symmetric), so the browser can move it as one layer.
  const groupRef = useRef<SVGSVGElement>(null);
  const rimRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<SVGSVGElement>(null);
  const pointerTipRef = useRef<SVGGElement>(null);
  const pointerGradientId = "wheel-pointer-gold-" + useId().replace(/:/g, "");
  const count = names.length;
  const seg = count > 0 ? 360 / count : 360;
  const onTickRef = useRef(onTick);
  const onEndRef = useRef(onSpinEnd);
  const onIdleRef = useRef(onIdleRotation);
  const onSpinFrameRef = useRef(onSpinFrame);
  const onSpinStartRef = useRef(onSpinStart);
  const onSpinLandRef = useRef(onSpinLand);
  onSpinFrameRef.current = onSpinFrame;
  onSpinStartRef.current = onSpinStart;
  onSpinLandRef.current = onSpinLand;
  onTickRef.current = onTick;
  onEndRef.current = onSpinEnd;
  onIdleRef.current = onIdleRotation;

  useEffect(() => {
    const el = groupRef.current;
    const rim = rimRef.current;
    const focus = focusRef.current;
    if (!el || !rim || !focus) return;
    const lamps = rim.querySelectorAll<HTMLElement>(".wheel-bulb");
    let firstLamp = -1;
    function lightRim(angle: number) {
      const first = rimLightIndex(angle);
      if (first === firstLamp) return;
      firstLamp = first;
      lamps.forEach((lamp, i) => lamp.toggleAttribute("data-lit", rimLampIsLit(i, first)));
    }
    focus.hidden = true;
    rim.style.transform = "";
    lightRim(spin?.from ?? rotation);
    pointerRef.current?.classList.remove("wheel-pointer--landed");
    if (!spin) {
      if (!idle || count === 0) {
        el.style.transform = `rotate(${rotation}deg)`;
        return;
      }
      // Slow, silent presentation movement; never changes the saved result.
      const start = performance.now();
      let raf = 0;
      const frame = (now: number) => {
        const angle = ((now - start) * 360 / 90000) % 360;
        el.style.transform = `rotate(${angle}deg)`;
        lightRim(angle);
        onIdleRef.current?.(angle);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const stopTrack = onSpinStartRef.current?.(spin.durationMs);
    const from = spin.from;
    const holdMs = spin.holdMs ?? (spin.zoom ? WHEEL_CLOSEUP_MS : 0);
    const total = rotation - from;
    const tip = pointerTipRef.current;
    let lastSeg = Math.floor(from / seg);
    let lastFocus = -1;
    let lastPointerTick = -Infinity;
    let landed = false;
    let pointerAngle = 0;
    const animatePointer = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const frame = (now: number) => {
      const elapsed = now - start;
      const t = Math.max(0, Math.min(1, elapsed / spin.durationMs));
      const r = from + total * wheelEase(t);
      const landedMs = Math.max(0, elapsed - spin.durationMs);
      const zoom = wheelZoom(t, spin.zoom, landedMs, holdMs);
      el.style.transform = `rotate(${r}deg)`;
      lightRim(r);
      rim.style.transform = zoom > 1 ? `scale(${zoom})` : "";
      if (zoom > 1) {
        const index = segmentAtPointer(r, count);
        if (index !== lastFocus) {
          focus.textContent = names[index] ?? "";
          focus.hidden = !names[index];
          lastFocus = index;
        }
        focus.style.opacity = String(wheelFocusOpacity(zoom));
      } else {
        focus.hidden = true;
        lastFocus = -1;
      }

      const slice = Math.floor(r / seg);
      if (t < 1 && slice !== lastSeg) {
        lastSeg = slice;
        onTickRef.current?.();
        if (count > 1 && animatePointer && now - lastPointerTick >= 125) lastPointerTick = now;
      }
      const tilt = t < 1 ? pointerClickTilt(now - lastPointerTick) : 0;
      if (tip && tilt !== pointerAngle) {
        tip.style.transform = tilt ? `rotate(${tilt}deg)` : "";
        pointerAngle = tilt;
      }
      onSpinFrameRef.current?.({ rotation: r, zoom, progress: t, pointerTilt: tilt });
      if (t === 1 && !landed) {
        landed = true;
        rim.setAttribute("data-landed", "");
        pointerRef.current?.classList.add("wheel-pointer--landed");
        stopTrack?.();
        onSpinLandRef.current?.();
      }
      if (t < 1 || landedMs < holdMs) raf = requestAnimationFrame(frame);
      else onEndRef.current?.();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      if (!landed) stopTrack?.();
      if (tip) tip.style.transform = "";
      rim.removeAttribute("data-landed");
      pointerRef.current?.classList.remove("wheel-pointer--landed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key, rotation, idle, count]);

  const fontSize = wheelFontSize(count);
  const hasWinningSlice = winnerIndex !== undefined && winnerIndex >= 0 && winnerIndex < count;

  return (
    <div className="wheel-size relative isolate">
      <div className="wheel-stage-halo pointer-events-none absolute -inset-[6%] rounded-full" aria-hidden="true" />
      <div className={spin?.zoom ? "absolute inset-0 overflow-hidden" : "absolute inset-0"}>
        <div ref={rimRef} data-winner={winner || undefined} className="wheel-rim absolute inset-0 origin-top rounded-full p-[3.5%]">
          {/* Fine gold bezel between the disk and its fixed 24 decorative lamps. */}
          <div className="wheel-bezel-line pointer-events-none absolute inset-[2%] z-[1] rounded-full" aria-hidden="true" />
          {/* Independent perimeter lights: decorative only, never change the draw. */}
          <div className="wheel-bulb-track pointer-events-none absolute inset-0 z-[2] rounded-full" aria-hidden="true">
            {Array.from({ length: RIM_LAMP_COUNT }, (_, i) => {
              const angle = (i * Math.PI * 2) / RIM_LAMP_COUNT - Math.PI / 2;
              return (
                <span
                  key={i}
                  className="wheel-bulb absolute rounded-full"
                  style={{
                    left: `${50 + 48.15 * Math.cos(angle)}%`,
                    top: `${50 + 48.15 * Math.sin(angle)}%`,
                  }}
                />
              );
            })}
          </div>
          <div className="relative z-0 h-full w-full overflow-hidden rounded-full bg-card">
            <svg
              ref={groupRef}
              viewBox="0 0 200 200"
              className="h-full w-full will-change-transform"
              style={{ transform: `rotate(${spin?.from ?? rotation}deg)` }}
              role="img"
              aria-label="Roleta"
            >
              <g>
                {count === 0 && (
                  <>
                    <circle cx="100" cy="100" r="100" style={{ fill: "var(--muted)" }} />
                    <text
                      x="100"
                      y="104"
                      textAnchor="middle"
                      style={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 700 }}
                    >
                      Sem nomes ainda
                    </text>
                  </>
                )}
                {count === 1 && (
                  <circle cx="100" cy="100" r="100" style={{ fill: "var(--wheel-1)" }} />
                )}
                {count > 1 &&
                  names.map((_, i) => (
                    <path
                      key={i}
                      d={slicePath(i, seg, 100)}
                      style={{
                        fill: `var(--wheel-${colorIndex(i, count) + 1})`,
                        stroke: "var(--background)",
                        strokeWidth: count > 100 ? 0.12 : count > 40 ? 0.2 : 0.6,
                      }}
                    />
                  ))}
                {hasWinningSlice && (
                  count === 1
                    ? <circle cx="100" cy="100" r="97" className="wheel-winning-slice" />
                    : <path
                        d={slicePath(winnerIndex, seg, 97)}
                        className="wheel-winning-slice"
                        strokeWidth={count > 100 ? 0.9 : 1.8}
                      />
                )}
                {names.map((name, i) => {
                  if (!name) return null;
                  const center = count === 1 ? 0 : (i + 0.5) * seg;
                  const light = count > 1 && LIGHT.has(colorIndex(i, count));
                  // Names on the left half are turned around so they never read upside down.
                  const flip = center > 180;
                  return (
                    <text
                      key={`t${i}`}
                      aria-label={name}
                      x={flip ? 10 : 190}
                      y="100"
                      textAnchor={flip ? "start" : "end"}
                      dominantBaseline="central"
                      transform={`rotate(${flip ? center + 90 : center - 90} 100 100)`}
                      style={{
                        fill: light ? "var(--wheel-ink-dark)" : "var(--wheel-ink)",
                        fontSize,
                        fontWeight: 800,
                        fontFamily: "var(--font-sans)",
                        paintOrder: "stroke",
                        // Maintain contrast on both bright and dark wheel slices.
                        stroke: light ? "rgba(255,255,255,0.32)" : "rgba(0,0,0,0.52)",
                        strokeWidth: count > 100 ? 0.1 : 0.15,
                      }}
                    >
                      {wheelLabel(name, count)}
                    </text>
                  );
                })}
              </g>
              <circle cx="100" cy="100" r="15" style={{ fill: "var(--gold)" }} />
              <circle cx="100" cy="100" r="10" style={{ fill: "var(--background)" }} />
              <circle cx="100" cy="100" r="4" style={{ fill: "var(--gold)" }} />
            </svg>
          </div>
        </div>
      </div>
      {celebrationAt !== undefined && <WinnerConfetti startedAt={celebrationAt} />}
      <div className="wheel-pointer-aura pointer-events-none absolute -top-[5%] left-1/2 z-[3] h-[15%] w-[19%] -translate-x-1/2 rounded-full" aria-hidden="true" />
      {/* The fixed pointer is decorative and does not affect the selected winner. */}
      <svg
        ref={pointerRef}
        viewBox="0 0 40 48"
        className={["wheel-pointer absolute left-1/2 top-0 z-10 w-[11%] -translate-x-1/2 -translate-y-[38%]", winner && !spin ? "wheel-pointer--winner" : ""].filter(Boolean).join(" ")}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={pointerGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fff5bf" />
            <stop offset="48%" stopColor="#ffd452" />
            <stop offset="100%" stopColor="#b87910" />
          </linearGradient>
        </defs>
        <g ref={pointerTipRef} className="wheel-pointer-tip">
          <path
            d="M20 46 L4 14 A16 16 0 1 1 36 14 Z"
            fill={"url(#" + pointerGradientId + ")"}
            stroke="var(--gold-deep)"
            strokeWidth="2"
          />
          <path d="M20 39 L10 16 Q12 8 18 7 L18 27 Z" fill="#fff9dc" opacity="0.25" />
          <circle cx="20" cy="15" r="6" fill="var(--background)" />
          <circle cx="18" cy="13" r="2" fill="#fff6bb" opacity="0.75" />
        </g>
      </svg>
      <div
        ref={focusRef}
        hidden
        aria-hidden="true"
        className="wheel-focus pointer-events-none absolute inset-x-[7%] top-[72%] z-20 rounded-2xl border border-gold/55 bg-background/95 px-3 py-2 text-center text-[clamp(0.8rem,3.6vw,1rem)] font-extrabold leading-snug text-foreground shadow-xl backdrop-blur-md [overflow-wrap:anywhere]"
      />
    </div>
  );
}
