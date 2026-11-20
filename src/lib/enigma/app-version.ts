/**
 * Which version of the app this phone is running, and whether a newer one was
 * published. An installed app (opened from its icon) is often only resumed, never
 * reloaded, so it can keep running old code long after a publish; this lets the
 * screen offer "Atualizar agora". Pure parsing/comparison first (tested), then the
 * browser-only part.
 */

export type AppVersion = { commit: string | null; entry: string | null };

const COMMIT_RE = /data-commit-sha="([0-9a-f]{7,40})"/i;
const ENTRY_RE = /<script\b[^>]*\btype="module"[^>]*\bsrc="([^"]*\/assets\/index-[^"/]+\.js)"/i;
const ENTRY_PATH_RE = /\/assets\/index-[^"/]+\.js$/;

function entryPath(src: string): string | null {
  const path = src.replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0] ?? "";
  return ENTRY_PATH_RE.test(path) ? path : null;
}

/** Version stamped in a served page: the published commit, and the main script file. */
export function parseVersion(html: string): AppVersion {
  const commit = COMMIT_RE.exec(html)?.[1]?.toLowerCase() ?? null;
  const src = ENTRY_RE.exec(html)?.[1];
  return { commit, entry: src ? entryPath(src) : null };
}

/** True only when both sides can be compared and they differ (commit first, then script file). */
export function isNewer(current: AppVersion, latest: AppVersion): boolean {
  if (current.commit && latest.commit) return current.commit !== latest.commit;
  if (current.entry && latest.entry) return current.entry !== latest.entry;
  return false;
}

export function hasVersion(v: AppVersion): boolean {
  return !!(v.commit || v.entry);
}

/** Short label for Ajustes: 7 characters of the commit, else the script file code. */
export function shortVersion(v: AppVersion): string | null {
  if (v.commit) return v.commit.slice(0, 7);
  const code = v.entry?.match(/index-([^/]+)\.js$/)?.[1];
  return code ?? null;
}

// ---- Browser part ----

let running: AppVersion | null = null;

function fromDocument(): AppVersion {
  const commit =
    document.querySelector("script[data-commit-sha]")?.getAttribute("data-commit-sha")?.toLowerCase() ?? null;
  let entry: string | null = null;
  for (const s of Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]'))) {
    entry = entryPath(s.getAttribute("src") ?? "");
    if (entry) break;
  }
  return { commit: commit && /^[0-9a-f]{7,40}$/.test(commit) ? commit : null, entry };
}

/** Version of the code loaded in this tab (read once, when first asked). */
export function runningVersion(): AppVersion {
  if (!running) running = fromDocument();
  return running;
}

async function latestVersion(): Promise<AppVersion | null> {
  try {
    const res = await fetch(`/?v=${Date.now()}`, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const v = parseVersion(await res.text());
    return hasVersion(v) ? v : null;
  } catch {
    return null;
  }
}

export type UpdateCheck = "new" | "same" | "unknown";

/** Asks the site for its current page and compares it with the code running here. */
export async function checkForUpdate(): Promise<UpdateCheck> {
  const latest = await latestVersion();
  if (!latest) return "unknown";
  const current = runningVersion();
  if (!hasVersion(current)) {
    // Nothing readable in this tab: the first answer becomes the reference.
    running = latest;
    return "same";
  }
  if (!isNewer(current, latest)) {
    // Fill in what this tab could not read, so later checks can compare it.
    running = { commit: current.commit ?? latest.commit, entry: current.entry ?? latest.entry };
    return "same";
  }
  return "new";
}

const FIRST_CHECK_MS = 4000;
const EVERY_MS = 10 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

/** Checks soon after opening, when the app comes back to the screen, and every 10 minutes. */
export function watchForUpdates(onNew: () => void): () => void {
  let last = 0;
  let found = false;
  const run = () => {
    if (found || document.visibilityState !== "visible" || !navigator.onLine) return;
    if (Date.now() - last < MIN_GAP_MS) return;
    last = Date.now();
    void checkForUpdate().then((r) => {
      if (r === "new" && !found) {
        found = true;
        onNew();
      }
    });
  };
  const first = window.setTimeout(run, FIRST_CHECK_MS);
  const timer = window.setInterval(run, EVERY_MS);
  const onShow = () => run();
  document.addEventListener("visibilitychange", onShow);
  window.addEventListener("focus", onShow);
  window.addEventListener("online", onShow);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onShow);
    window.removeEventListener("focus", onShow);
    window.removeEventListener("online", onShow);
  };
}
