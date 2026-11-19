import { toast } from "sonner";

import { repo, type RepoResult } from "./repo";

/**
 * Shows the failure of a repo action in plain words. Write errors offer "Tentar novamente";
 * conflicts already reloaded the data. Returns true when the action succeeded.
 */
export function report<T>(r: RepoResult<T>, retry?: () => void): r is { ok: true; value: T } {
  if (r.ok) return true;
  const action =
    r.error === "read"
      ? { label: "Tentar novamente", onClick: () => repo.reload() }
      : retry && r.error !== "conflict"
        ? { label: "Tentar novamente", onClick: retry }
        : undefined;
  toast.error(r.message, { id: `repo-${r.error}`, ...(action ? { action } : {}) });
  return false;
}
