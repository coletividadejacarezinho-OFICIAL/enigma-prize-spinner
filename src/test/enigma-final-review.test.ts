import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { commitSpin } from "@/lib/enigma/rounds";
import { createDraw } from "@/lib/enigma/logic";
import { emptySim } from "@/lib/enigma/partners";
import { repo } from "@/lib/enigma/repo";
import { prepareBackup } from "@/lib/enigma/backup-export";
import { previewRestore, applyRestore, settleOnOpen } from "@/lib/enigma/restore-import";
import { STORAGE_KEY, writeJournal } from "@/lib/enigma/store";
import { RESTORE_KEY } from "@/lib/enigma/restore-lock";

beforeEach(() => { localStorage.clear(); repo.reload(); repo.getSnapshot(); });
afterEach(() => vi.restoreAllMocks());

function ready() {
  const draw = createDraw({ date: "2026-11-19", merchant: { id: "m", name: "Loja", createdAt: 0 }, prize: "Pão", confirmed: true });
  return { ...draw, names: ["Ana", "Bia"] };
}
const result = { winner: "Ana", index: 0, rotation: 90, at: 1 };

it("o contrato de giro recusa rascunho mesmo com lista confirmada", () => {
  const draw = { ...ready(), draft: true as const };
  expect(commitSpin(draw, { drawId: draw.id, round: 0, pool: draw.names }, result).status).toBe("changed");
});
it("o contrato de giro recusa primeiro prêmio com apenas um participante", () => {
  const draw = { ...ready(), names: ["Ana"] };
  expect(commitSpin(draw, { drawId: draw.id, round: 0, pool: draw.names }, result).status).toBe("changed");
});
it("o contrato recusa resultado que não pode ser serializado sem perder valores", () => {
  const draw = ready();
  expect(commitSpin(draw, { drawId: draw.id, round: 0, pool: draw.names }, { ...result, rotation: NaN }).status).toBe("changed");
});

it("mantém recuperação bloqueada se o journal estiver danificado", async () => {
  localStorage.setItem(RESTORE_KEY, "{quebrado");
  expect(await settleOnOpen()).toBe("pending");
  expect(localStorage.getItem(RESTORE_KEY)).toBe("{quebrado");
});

it("recusa uma segunda restauração enquanto outra está em andamento", async () => {
  const backup = await prepareBackup();
  if (!backup.ok) throw new Error(backup.message);
  const preview = await previewRestore(new File([backup.blob], "copia.zip"));
  if (!preview.ok) throw new Error(preview.message);
  const raw = localStorage.getItem(STORAGE_KEY)!;
  writeJournal({ phase: "videos", prevRaw: raw, newRaw: raw, newVideoIds: [] });
  expect((await applyRestore(preview)).ok).toBe(false);
});

it("cópia local com parceiros continua exportável durante a recuperação pendente", async () => {
  const raw = localStorage.getItem(STORAGE_KEY)!;
  localStorage.setItem("enigma-premiado:p1-ensaio", JSON.stringify(emptySim()));
  writeJournal({ phase: "data", prevRaw: raw, newRaw: raw, newVideoIds: [] });
  expect((await prepareBackup()).ok).toBe(true);
});

it("não substitui os sorteios por um snapshot danificado dentro do journal", async () => {
  const original = localStorage.getItem(STORAGE_KEY)!;
  writeJournal({ phase: "data", prevRaw: original, newRaw: "{quebrado", newVideoIds: [] });
  expect(await settleOnOpen()).toBe("pending");
  expect(localStorage.getItem(STORAGE_KEY)).toBe(original);
});

it("não aplica dados de parceiros inválidos que estejam dentro do journal", async () => {
  const original = localStorage.getItem(STORAGE_KEY)!;
  writeJournal({
    phase: "data", prevRaw: original, newRaw: original,
    newVideoIds: [], newPartnerRaw: JSON.stringify({ offers: null }),
  });
  expect(await settleOnOpen()).toBe("pending");
  expect(localStorage.getItem("enigma-premiado:p1-ensaio")).toBeNull();
});
