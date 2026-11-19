import { toast } from "sonner";

import { partnersRepo } from "./partners-repo";
import { repo, type RepoResult } from "./repo";

/**
 * Shows the failure of a repo action in plain words. Write errors offer "Tentar novamente";
 * conflicts already reloaded the data. Returns true when the action succeeded.
 */
export function report<T>(r: RepoResult<T>, retry?: () => void, reload = () => repo.reload()): r is { ok: true; value: T } {
  if (r.ok) return true;
  const action =
    r.error === "read"
      ? { label: "Tentar novamente", onClick: reload }
      : retry && r.error !== "conflict"
        ? { label: "Tentar novamente", onClick: retry }
        : undefined;
  toast.error(r.message, { id: `repo-${r.error}`, ...(action ? { action } : {}) });
  return false;
}


export function reportPartner<T>(result: RepoResult<T>): result is { ok: true; value: T } {
  return report(result, undefined, () => partnersRepo.reload());
}
