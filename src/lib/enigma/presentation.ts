import { useSyncExternalStore } from "react";

/** Roleta full-screen mode: hides the tabs and secondary controls. Not saved. */
let on = false;
const listeners = new Set<() => void>();

export function setPresentation(value: boolean) {
  if (on === value) return;
  on = value;
  listeners.forEach((l) => l());
}

export function usePresentation(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => on,
    () => false,
  );
}

/** Asks for the device's own full screen; false when the browser can't (e.g. iPhone, editor preview). */
export async function requestDeviceFullscreen(): Promise<boolean> {
  const el = document.documentElement;
  if (!document.fullscreenEnabled || !el.requestFullscreen) return false;
  try {
    await el.requestFullscreen({ navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

export async function exitDeviceFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // already left
    }
  }
}
