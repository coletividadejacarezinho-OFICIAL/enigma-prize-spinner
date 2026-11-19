/** Shared by local adapters so interrupted restores cannot overwrite later saves. */
export const RESTORE_KEY = "enigma-premiado:restore";

export function restorePending(): boolean {
  try {
    return localStorage.getItem(RESTORE_KEY) !== null;
  } catch {
    return true;
  }
}
