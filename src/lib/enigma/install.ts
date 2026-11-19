import { useSyncExternalStore } from "react";

/** What "Instalar no celular" should show on this device. */
export type InstallView =
  | "installed" // already opened from the home-screen icon
  | "editor" // editor preview or a non-HTTPS address: installing needs the app opened directly
  | "prompt" // the browser offered installation: show "Instalar"
  | "ios-safari" // iPhone/iPad in Safari: Compartilhar → Adicionar à Tela de Início
  | "ios-other" // iPhone/iPad in another browser: open in Safari first
  | "menu"; // other browsers: add through the browser menu

export type InstallEnv = {
  standalone: boolean;
  editorPreview: boolean;
  secure: boolean;
  hasPrompt: boolean;
  ios: boolean;
  iosSafari: boolean;
};

export function installView(env: InstallEnv): InstallView {
  if (env.standalone) return "installed";
  if (env.editorPreview || !env.secure) return "editor";
  if (env.hasPrompt) return "prompt";
  if (env.ios) return env.iosSafari ? "ios-safari" : "ios-other";
  return "menu";
}

const PREVIEW_LABEL = /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/;

export function isEditorPreviewHost(hostname: string, inIframe: boolean): boolean {
  const host = hostname.toLowerCase();
  if (inIframe) return true;
  const label = host.split(".")[0] ?? "";
  const lovableHost = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  if (lovableHost && (PREVIEW_LABEL.test(label) || /^project--.+-dev$/.test(label))) return true;
  return /(^|\.)lovableproject(-dev)?\.com$/.test(host) || /(^|\.)beta\.lovable\.dev$/.test(host);
}

type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: PromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
let started = false;

/** Call once in the browser so the browser's install offer is kept for the "Instalar" button. */
export function initInstallPrompt() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
}

/** Shows the browser's install window. Returns true when the person accepted. */
export async function runInstallPrompt(): Promise<boolean> {
  const e = deferred;
  if (!e) return false;
  await e.prompt();
  const choice = await e.userChoice;
  deferred = null;
  notify();
  return choice.outcome === "accepted";
}

function readEnv(): InstallEnv {
  const nav = navigator as Navigator & { standalone?: boolean };
  const ua = nav.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }
  return {
    standalone:
      installedNow ||
      nav.standalone === true ||
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches,
    editorPreview: isEditorPreviewHost(window.location.hostname, inIframe),
    secure: window.isSecureContext,
    hasPrompt: deferred !== null,
    ios,
    iosSafari: ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|WhatsApp/.test(ua),
  };
}

let cachedKey = "";
let cachedView: InstallView | null = null;
function snapshot(): InstallView {
  const env = readEnv();
  const key = JSON.stringify(env);
  if (key !== cachedKey || !cachedView) {
    cachedKey = key;
    cachedView = installView(env);
  }
  return cachedView;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
}

/** null on the server and during hydration. */
export function useInstallView(): InstallView | null {
  return useSyncExternalStore(subscribe, snapshot, () => null);
}
