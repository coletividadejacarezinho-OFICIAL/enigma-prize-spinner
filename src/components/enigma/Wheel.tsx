import { useEffect, useId, useRef } from "react";
import { wheelEase } from "@/lib/enigma/jingle";
import { segmentAtPointer } from "@/lib/enigma/logic";
import { wheelFontSize, wheelLabel, wheelZoom } from "@/lib/enigma/wheel-visual";

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

type Props = {
  names: string[];
  rotation: number;
  /** When set, the wheel animates from `from` to `rotation`. */
  spin?: { from: number; durationMs: number; key: number; zoom: boolean } | null;
  idle?: boolean;
  winner?: boolean;
  onIdleRotation?: (rotation: number) => void;
  onTick?: () => void;
  onSpinEnd?: () => void;
};

export function Wheel({ names, rotation, spin, idle = false, winner = false, onIdleRotation, onTick, onSpinEnd }: Props) {
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
  onTickRef.current = onTick;
  onEndRef.current = onSpinEnd;
  onIdleRef.current = onIdleRotation;

  useEffect(() => {
    const el = groupRef.current;
    const rim = rimRef.current;
    const focus = focusRef.current;
    if (!el || !rim || !focus) return;
    focus.hidden = true;
    rim.style.transform = "";
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
        onIdleRef.current?.(angle);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
      return () => cancelAnimationFrame(raf);
    }
    const start = performance.now();
    const from = spin.from;
    const total = rotation - from;
    let lastSeg = Math.floor(from / seg);
    let lastFocus = -1;
    let lastPointerTick = -Infinity;
    let pointerAnimation: Animation | null = null;
    const animatePointer = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / spin.durationMs));
      const r = from + total * wheelEase(t);
      el.style.transform = `rotate(${r}deg)`;
      const zoom = wheelZoom(t, spin.zoom);
      if (zoom > 1) {
        rim.style.transform = `scale(${zoom})`;
        const index = segmentAtPointer(r, count);
        if (index !== lastFocus) {
          focus.textContent = names[index] ?? "";
          focus.hidden = !names[index];
          lastFocus = index;
        }
      }
      const s = Math.floor(r / seg);
      if (t < 1 && s !== lastSeg) {
        lastSeg = s;
        onTickRef.current?.();
        // A brief mechanical click, capped at eight per second on dense wheels.
        if (count > 1 && animatePointer && now - lastPointerTick >= 125) {
          const tip = pointerTipRef.current;
          if (tip?.animate) {
            pointerAnimation?.cancel();
            pointerAnimation = tip.animate(
              [
                { transform: "rotate(0deg)", offset: 0 },
                { transform: "rotate(-6deg)", offset: 0.32 },
                { transform: "rotate(2deg)", offset: 0.68 },
                { transform: "rotate(0deg)", offset: 1 },
              ],
              { duration: 170, easing: "ease-out", iterations: 1 },
            );
            lastPointerTick = now;
          }
        }
      }
      if (t >= 1) pointerRef.current?.classList.add("wheel-pointer--landed");
      // Hold the finished close-up for five seconds so the audience can read it.
      if (t < 1 || (spin.zoom && now - start < spin.durationMs + 5000))
        raf = requestAnimationFrame(frame);
      else onEndRef.current?.();
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      pointerAnimation?.cancel();
      pointerRef.current?.classList.remove("wheel-pointer--landed");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key, rotation, idle, count]);

  const fontSize = wheelFontSize(count);

  return (
    <div className="wheel-size relative">
      <div className={spin?.zoom ? "absolute inset-0 overflow-hidden" : "absolute inset-0"}>
        <div ref={rimRef} className={`wheel-rim absolute inset-0 origin-top rounded-full p-[3.5%]${spin ? " wheel-rim--spinning" : ""}`}>
          {/* Independent perimeter lights: decorative only, never change the draw. */}
          <div className="pointer-events-none absolute inset-0 rounded-full" aria-hidden="true">
            {Array.from({ length: 24 }, (_, i) => {
              const angle = (i * Math.PI * 2) / 24 - Math.PI / 2;
              return (
                <span
                  key={i}
                  className="wheel-bulb absolute rounded-full"
                  style={{
                    left: `${50 + 47 * Math.cos(angle)}%`,
                    top: `${50 + 47 * Math.sin(angle)}%`,
                    // Stagger all 24 bulbs so the illuminated group travels clockwise.
                    animationDelay: `${-((24 - i) * (spin ? 0.05 : 0.1))}s`,
                  }}
                />
              );
            })}
          </div>
          <div className="relative h-full w-full overflow-hidden rounded-full bg-card">
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
                  names.map((_, i) => {
                    const a0 = i * seg;
                    const a1 = (i + 1) * seg;
                    const p0 = point(a0, 100);
                    const p1 = point(a1, 100);
                    const large = seg > 180 ? 1 : 0;
                    return (
                      <path
                        key={i}
                        d={`M100 100 L${p0.x} ${p0.y} A100 100 0 ${large} 1 ${p1.x} ${p1.y} Z`}
                        style={{
                          fill: `var(--wheel-${colorIndex(i, count) + 1})`,
                          stroke: "var(--background)",
                          strokeWidth: count > 100 ? 0.12 : count > 40 ? 0.2 : 0.6,
                        }}
                      />
                    );
                  })}
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
        className="pointer-events-none absolute inset-x-4 bottom-3 truncate rounded-full bg-background/95 px-3 py-1 text-center text-base font-bold text-foreground"
      />
    </div>
  );
}
