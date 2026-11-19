import { useEffect, useRef } from "react";

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

function shorten(name: string, max: number) {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

type Props = {
  names: string[];
  /** Text per slice (E06): names on small wheels, numbered marks on big ones. Defaults to names. */
  labels?: string[];
  rotation: number;
  /** When set, the wheel animates from `from` to `rotation`. */
  spin?: { from: number; durationMs: number; key: number } | null;
  onTick?: () => void;
  onSpinEnd?: () => void;
};

export function Wheel({ names, labels, rotation, spin, onTick, onSpinEnd }: Props) {
  // The whole <svg> turns (its centre is symmetric), so the browser can move it as one layer.
  const groupRef = useRef<SVGSVGElement>(null);
  const count = names.length;
  const seg = count > 0 ? 360 / count : 360;
  const onTickRef = useRef(onTick);
  const onEndRef = useRef(onSpinEnd);
  onTickRef.current = onTick;
  onEndRef.current = onSpinEnd;

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    if (!spin) {
      el.style.transform = `rotate(${rotation}deg)`;
      return;
    }
    const start = performance.now();
    const from = spin.from;
    const total = rotation - from;
    let lastSeg = Math.floor(from / seg);
    let raf = 0;
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / spin.durationMs);
      const r = from + total * ease(t);
      el.style.transform = `rotate(${r}deg)`;
      const s = Math.floor(r / seg);
      if (s !== lastSeg) {
        lastSeg = s;
        onTickRef.current?.();
      }
      if (t < 1) raf = requestAnimationFrame(frame);
      else onEndRef.current?.();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spin?.key, rotation]);

  const texts = labels ?? names;
  const marks = count > 60;
  const fontSize = marks ? 7 : count <= 6 ? 9 : count <= 10 ? 7.5 : count <= 16 ? 6 : count <= 30 ? 4.5 : 3.2;
  const maxChars = count <= 10 ? 14 : 18;
  const showText = count > 0;

  return (
    <div className="wheel-size relative">
      <div className="wheel-rim absolute inset-0 rounded-full p-[3.5%]">
        <div className="relative h-full w-full overflow-hidden rounded-full bg-card">
          <svg
            ref={groupRef}
            viewBox="0 0 200 200"
            className="h-full w-full will-change-transform"
            style={{ transform: `rotate(${rotation}deg)` }}
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
                        strokeWidth: count > 40 ? 0.2 : 0.6,
                      }}
                    />
                  );
                })}
              {showText &&
                texts.map((name, i) => {
                  if (!name) return null;
                  const center = count === 1 ? 0 : (i + 0.5) * seg;
                  const light = count > 1 && LIGHT.has(colorIndex(i, count));
                  // Names on the left half are turned around so they never read upside down.
                  const flip = center > 180;
                  return (
                    <text
                      key={`t${i}`}
                      x={flip ? (marks ? 4 : 12) : marks ? 196 : 188}
                      y="100"
                      textAnchor={flip ? "start" : "end"}
                      dominantBaseline="central"
                      transform={`rotate(${flip ? center + 90 : center - 90} 100 100)`}
                      style={{
                        fill: light ? "var(--wheel-ink-dark)" : "var(--wheel-ink)",
                        fontSize,
                        fontWeight: 800,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {shorten(name, maxChars)}
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
      {/* Fixed pointer at the top */}
      <svg
        viewBox="0 0 40 48"
        className="absolute left-1/2 top-0 z-10 w-[11%] -translate-x-1/2 -translate-y-[38%] drop-shadow-lg"
        aria-hidden="true"
      >
        <path
          d="M20 46 L4 14 A16 16 0 1 1 36 14 Z"
          style={{ fill: "var(--gold)", stroke: "var(--gold-deep)", strokeWidth: 2 }}
        />
        <circle cx="20" cy="15" r="6" style={{ fill: "var(--background)" }} />
      </svg>
    </div>
  );
}
