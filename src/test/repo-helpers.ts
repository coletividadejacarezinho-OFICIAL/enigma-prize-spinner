import { entriesFromNames } from "@/lib/enigma/logic";
import type { Draw } from "@/lib/enigma/types";
export { createDraw } from "@/lib/enigma/logic";

/** A draw whose Nomes list is already confirmed with these names. */
export function manualEntryNames(d: Draw, names: string[]): Draw {
  return { ...d, names, entries: entriesFromNames(names, 1, false) };
}
