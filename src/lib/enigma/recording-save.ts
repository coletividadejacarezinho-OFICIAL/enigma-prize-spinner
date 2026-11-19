/** Browser-only (E07): keeps a finished recording and says "saved" only once both the file and its link to the draw are read back. */
import { repo } from "./repo";
import { loadState, rawSavedData } from "./store";
import type { Recording } from "./types";
import { loadVideo, saveVideo } from "./videos";

export async function keepRecording(drawId: string, rec: Recording, blob: Blob): Promise<boolean> {
  if (!(await saveVideo(rec.id, blob))) return false;
  const back = await loadVideo(rec.id);
  if (!back || back.size !== blob.size) return false;
  const loaded = loadState(rawSavedData());
  const linked = (s: typeof loaded) =>
    s.kind === "ok" &&
    !!s.state.draws.find((d) => d.id === drawId)?.recordings?.some((r) => r.id === rec.id);
  if (!linked(loaded)) {
    const r = await repo.addRecording(drawId, rec);
    if (!r.ok) return false;
  }
  return linked(loadState(rawSavedData()));
}
