/** Font size in the wheel's 200-unit viewBox. Dense wheels must fit the narrow slices. */
export function wheelFontSize(count: number): number {
  if (count <= 6) return 9;
  if (count <= 10) return 7.5;
  if (count <= 16) return 6;
  if (count <= 30) return 4.5;
  // Use most of each slice's available width at the name radius, without
  // allowing adjacent labels to overlap on dense wheels.
  return Math.min(4.3, (Math.PI * 2 * 70 * 0.78) / count);
}

/** Short labels affect presentation only; the registered names remain untouched. */
export function wheelLabel(name: string, count: number): string {
  const max = count <= 10 ? 14 : count <= 30 ? 18 : count <= 80 ? 24 : count <= 120 ? 22 : 18;
  const clean = name.trim().replace(/\s+/g, " ");
  const chars = Array.from(clean);
  if (chars.length <= max) return clean;
  const excerpt = chars.slice(0, max - 1).join("");
  // A word boundary looks better than cutting someone's surname in half.
  const boundary = excerpt.lastIndexOf(" ");
  // If the last character already finishes a word, keep that complete word.
  if (chars[max - 1] === " ") return excerpt + "…";
  return (boundary >= Math.ceil(max * 0.58) ? excerpt.slice(0, boundary) : excerpt) + "…";
}

export const WHEEL_CLOSEUP_MS = 5000;
export const RIM_LAMP_COUNT = 24;

export type WheelMotion = {
  rotation: number;
  zoom: number;
  progress: number;
  pointerTilt: number;
};

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/** Ease into the anchored close-up, hold the saved result, then ease back to the full wheel. */
export function wheelZoom(progress: number, enabled: boolean, landedMs = 0): number {
  if (!enabled) return 1;
  const enter = smoothStep((progress - 0.56) / 0.32);
  const exit = smoothStep((landedMs - (WHEEL_CLOSEUP_MS - 800)) / 800);
  return 1 + 0.9 * enter * (1 - exit);
}

export function wheelFocusOpacity(zoom: number): number {
  return Math.min(1, Math.max(0, (zoom - 1) / 0.2));
}

/** The light cluster makes one lap for every two turns of the wheel. */
export function rimLightIndex(rotation: number): number {
  const advance = Math.floor((rotation / 720) * RIM_LAMP_COUNT);
  return ((advance % RIM_LAMP_COUNT) + RIM_LAMP_COUNT) % RIM_LAMP_COUNT;
}

export function rimLampIsLit(lamp: number, first: number): boolean {
  return (lamp - first + RIM_LAMP_COUNT) % RIM_LAMP_COUNT < 4;
}

/** A short mechanical deflection and return after the pointer crosses a slice. */
export function pointerClickTilt(elapsedMs: number): number {
  if (elapsedMs < 0 || elapsedMs >= 170) return 0;
  const t = elapsedMs / 170;
  return -8 * Math.sin(2 * Math.PI * t) * (1 - t);
}
