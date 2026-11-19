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

export function wheelLabel(name: string, count: number): string {
  const max = count <= 10 ? 14 : 18;
  const chars = Array.from(name);
  return chars.length > max ? `${chars.slice(0, max - 1).join("")}…` : name;
}

/** Enlarge the upper half as the spin slows down, keeping the top pointer anchored. */
export function wheelZoom(progress: number, enabled: boolean): number {
  if (!enabled) return 1;
  const t = Math.max(0, Math.min(1, (progress - 0.56) / 0.32));
  return 1 + 0.9 * t * t * (3 - 2 * t);
}
