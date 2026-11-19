import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PartnerTools, WinnerToShopCard } from "@/components/enigma/Partners";
import { Route as ShopRoute } from "@/routes/parceiros.loja";
import { repo, useAppState } from "@/lib/enigma/repo";
import { emptySim, type PartnerSim } from "@/lib/enigma/partners";
import { updateSim, SIM_KEY } from "@/lib/enigma/partners-store";
import { manualEntry } from "@/lib/enigma/entries";
import { poolFor, roundsOf, drawResultMessage } from "@/lib/enigma/rounds";
import { buildListao } from "@/lib/enigma/logic";
import { currentDraw, STORAGE_KEY, writeJournal } from "@/lib/enigma/store";
import { prepareBackup } from "@/lib/enigma/backup-export";
import { previewRestore, applyRestore, settleOnOpen } from "@/lib/enigma/restore-import";
import { keepRecording } from "@/lib/enigma/recording-save";
import type { AppState, Recording } from "@/lib/enigma/types";

const { nav, files, search } = vi.hoisted(() => ({
  nav: vi.fn(), files: new Map<string, Blob>(), search: { convite: "" },
}));
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => nav, Link: "a",
  createFileRoute: () => (options: object) => ({ ...options, useSearch: () => search }),
}));
vi.mock("@/lib/enigma/videos", () => ({
  saveVideo: async (id: string, blob: Blob) => { files.set(id, blob); return true; },
  loadVideo: async (id: string) => files.get(id) ?? null,
  deleteVideo: async (id: string) => { files.delete(id); return true; },
  putVideoOrThrow: async (id: string, blob: Blob) => { files.set(id, blob); },
}));

const Shop = (ShopRoute as unknown as { component: () => React.ReactNode }).component;
const saved = (): AppState => JSON.parse(localStorage.getItem(STORAGE_KEY)!);
const sim = (): PartnerSim => JSON.parse(localStorage.getItem(SIM_KEY)!);
function Admin() {
  const state = useAppState();
  return state ? <PartnerTools state={state} /> : null;
}
function Notices() {
  const state = useAppState();
  return state ? <WinnerToShopCard draw={currentDraw(state)} state={state} /> : null;
}
beforeEach(() => {
  localStorage.clear();
  repo.reload();
  repo.getSnapshot();
  updateSim(emptySim);
  files.clear();
});
afterEach(cleanup);

async function offer(name: string) {
  render(<Admin />);
  fireEvent.click(screen.getByText("Convidar comerciante"));
  search.convite = sim().invites.at(-1)!.id;
  cleanup();
  render(<Shop />);
  fireEvent.click(screen.getByText("Entrar com Google (simulado)"));
  fireEvent.change(screen.getByLabelText("Nome"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("WhatsApp com DDD"), { target: { value: name === "Loja A" ? "43999990001" : "43999990002" } });
  fireEvent.click(screen.getByText("Salvar e continuar"));
  await screen.findByText("Oferecer agora");
  fireEvent.click(screen.getByText("Oferecer agora"));
  fireEvent.change(screen.getByLabelText("Qual é o prêmio?"), { target: { value: "Cortesia " + name } });
  fireEvent.click(screen.getByText("Enviar para a administradora"));
  expect(sim().offers.at(-1)?.name).toBe(name);
  cleanup();
  render(<Admin />);
  fireEvent.click(screen.getByText("Cadastrar " + name));
  await waitFor(() => expect(saved().merchants.some((m) => m.name === name)).toBe(true));
  cleanup();
}

it("percorre convites e ofertas pela tela, sorteia duas cortesias e restaura dados e vídeo", async () => {
  await offer("Loja A");
  await offer("Loja B");
  render(<Admin />);
  for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
  fireEvent.click(screen.getByText("Escolher data da rodada"));
  fireEvent.change(screen.getByLabelText("Data da rodada"), { target: { value: "2026-11-19" } });
  fireEvent.click(screen.getByText("Confirmar e criar rascunho"));
  await screen.findByText("Abrir rascunho");
  expect(buildListao(saved(), "2026-11-19").active).toHaveLength(0);
  expect(currentDraw(saved())).toBeUndefined();
  const id = saved().draws[0]!.id;
  cleanup();
  expect((await repo.launchDraft(id)).ok).toBe(true);
  expect((await repo.changeEntries(id, () => ["Ana", "Bia", "Caio"].map((n) => manualEntry(n, 1)))).ok).toBe(true);
  expect((await repo.confirmList(id)).ok).toBe(true);
  for (let index = 0; index < 2; index++) {
    const draw = currentDraw(saved());
    const pool = poolFor(draw, index);
    const roundId = index === 0 ? id : draw.extraPrizes![0]!.id;
    expect((await repo.spin({
      drawId: id, roundId, pool,
      result: { winner: pool[0]!, index: 0, rotation: 45, at: index + 2 },
    })).ok).toBe(true);
    if (index === 0) expect((await repo.nextRound(id, roundId)).ok).toBe(true);
  }
  repo.reload();
  const results = roundsOf(currentDraw(saved()), saved().merchants).map((r) => r.result?.winner);
  expect(results).toEqual(["Ana", "Bia"]);
  expect(buildListao(saved(), "2026-11-19").active).toHaveLength(2);
  expect(drawResultMessage(currentDraw(saved()), saved().merchants, "Grupo")).toContain("Bia");
  render(<Notices />);
  for (const button of screen.getAllByText("Enviar ganhador à loja")) fireEvent.click(button);
  expect(sim().notices).toHaveLength(2);
  cleanup();
  render(<Shop />);
  fireEvent.click(screen.getByText("Marcar como retirado"));
  await waitFor(() => expect(currentDraw(saved()).deliveries).toHaveLength(1));
  cleanup();
  const rec: Recording = { id: "video1", real: true, mode: "roleta-voz", mic: true, startedAt: 1, durationMs: 1000, mimeType: "video/webm", size: 3 };
  expect(await keepRecording(id, rec, new Blob(["abc"], { type: "video/webm" }))).toBe(true);
  const before = saved();
  const partnerBefore = sim();
  const backup = await prepareBackup();
  expect(backup.ok).toBe(true);
  if (!backup.ok) throw new Error(backup.message);
  expect(backup.manifest.summary.videosIncluded).toBe(1);
  localStorage.clear();
  files.clear();
  repo.reload();
  const preview = await previewRestore(new File([backup.blob], "copia.zip"));
  expect(preview.ok).toBe(true);
  if (!preview.ok) throw new Error(preview.message);
  expect((await applyRestore(preview)).ok).toBe(true);
  repo.reload();
  expect(saved().draws).toEqual(before.draws);
  expect(sim().offers).toEqual(partnerBefore.offers);
  expect(sim().notices).toEqual(partnerBefore.notices);
  expect(sim().accounts).toEqual(partnerBefore.accounts);
  expect(files.get("video1")?.size).toBe(3);
});

it("conclui journal interrompido restaurando as duas chaves locais", async () => {
  const old = localStorage.getItem(STORAGE_KEY);
  const next = JSON.stringify({ ...saved(), sound: false });
  const partners = JSON.stringify({ ...emptySim(), accounts: [{ id: "conta", email: "teste@exemplo.com" }] });
  writeJournal({ phase: "data", prevRaw: old, newRaw: next, newVideoIds: [], prevPartnerRaw: localStorage.getItem(SIM_KEY), newPartnerRaw: partners });
  expect(await settleOnOpen()).toBe("finished");
  expect(saved().sound).toBe(false);
  expect(sim().accounts[0]?.id).toBe("conta");
});

it("recusa restauração se os parceiros mudarem depois da prévia", async () => {
  const backup = await prepareBackup();
  if (!backup.ok) throw new Error(backup.message);
  const preview = await previewRestore(new File([backup.blob], "copia.zip"));
  if (!preview.ok) throw new Error(preview.message);
  updateSim((s) => ({ ...s, accounts: [{ id: "nova", email: "teste@exemplo.com" }] }));
  expect((await applyRestore(preview)).ok).toBe(false);
  expect(sim().accounts[0]?.id).toBe("nova");
});

it("mantém journal pendente se faltar espaço e conclui ao reabrir depois", async () => {
  const previous = localStorage.getItem(STORAGE_KEY);
  writeJournal({
    phase: "data", prevRaw: previous, newRaw: JSON.stringify({ ...saved(), sound: false }),
    newVideoIds: [], prevPartnerRaw: localStorage.getItem(SIM_KEY),
    newPartnerRaw: JSON.stringify(emptySim()),
  });
  const original = Storage.prototype.setItem;
  const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === SIM_KEY) throw new Error("Sem espaço");
    original.call(this, key, value);
  });
  expect(await settleOnOpen()).toBe("pending");
  expect(localStorage.getItem("enigma-premiado:restore")).toBeTruthy();
  failure.mockRestore();
  expect(await settleOnOpen()).toBe("finished");
  expect(localStorage.getItem("enigma-premiado:restore")).toBeNull();
  expect(saved().sound).toBe(false);
});

it("abre cópia antiga sem dados dos parceiros", async () => {
  const JSZip = (await import("jszip")).default;
  const { buildManifest } = await import("@/lib/enigma/backup");
  const zip = new JSZip();
  const state = saved();
  zip.file("copia.json", JSON.stringify(buildManifest(state, JSON.stringify(state), STORAGE_KEY, new Set(), new Date())));
  const blob = await zip.generateAsync({ type: "blob" });
  const preview = await previewRestore(new File([blob], "antiga.zip"));
  expect(preview.ok).toBe(true);
  if (!preview.ok) throw new Error(preview.message);
  expect((await applyRestore(preview)).ok).toBe(true);
});

it("avisa sobre vídeo ausente e mantém os metadados no backup", async () => {
  await repo.startRehearsal();
  const draw = currentDraw(saved());
  await repo.addRecording(draw.id, { id: "ausente", real: true, mode: "voz", mic: true, startedAt: 1, durationMs: 20 });
  const backup = await prepareBackup();
  if (!backup.ok) throw new Error(backup.message);
  expect(backup.manifest.summary.videosMissing).toEqual([{ recordingId: "ausente", drawId: draw.id }]);
  expect(backup.manifest.state.draws[0]?.recordings?.[0]?.id).toBe("ausente");
});

it("libera a segunda cortesia quando resta um participante elegível", async () => {
  const { Route: WheelRoute } = await import("@/routes/index");
  const { createDraw } = await import("@/lib/enigma/logic");
  const merchant = { id: "m", name: "Loja", createdAt: 1 };
  await repo.saveMerchant(merchant);
  const draw = createDraw({
    merchant, date: "2026-11-19", prize: "Prêmio A", confirmed: true,
    more: [{ merchant, prize: "Prêmio B" }], repeatWinners: false,
  });
  await repo.createDraw(draw, { makeCurrent: true });
  await repo.changeEntries(draw.id, () => ["Ana", "Bia"].map((n) => manualEntry(n, 1)));
  await repo.confirmList(draw.id);
  await repo.setPreferences({ sound: false });
  await repo.spin({
    drawId: draw.id, roundId: draw.id, pool: ["Ana", "Bia"],
    result: { winner: "Ana", index: 0, rotation: 10, at: 1 },
  });
  await repo.nextRound(draw.id, draw.id);
  const Wheel = (WheelRoute as unknown as { component: () => React.ReactNode }).component;
  render(<Wheel />);
  expect(screen.getByText("Girar roleta")).toBeTruthy();
  fireEvent.click(screen.getByText("Girar roleta"));
  await waitFor(() => expect(currentDraw(saved()).extraPrizes?.[0]?.result?.winner).toBe("Bia"));
});

it("desfaz as duas gravações se o armazenamento recusar os sorteios durante a restauração", async () => {
  updateSim(() => ({ ...emptySim(), accounts: [{ id: "backup", email: "backup@exemplo.com" }] }));
  await repo.startRehearsal();
  const backup = await prepareBackup();
  if (!backup.ok) throw new Error(backup.message);
  cleanup();
  localStorage.clear();
  repo.reload();
  repo.getSnapshot();
  updateSim(emptySim);
  const before = localStorage.getItem(STORAGE_KEY);
  const partnerBefore = localStorage.getItem(SIM_KEY);
  const preview = await previewRestore(new File([backup.blob], "copia.zip"));
  if (!preview.ok) throw new Error(preview.message);
  const original = Storage.prototype.setItem;
  let refused = false;
  const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === STORAGE_KEY && !refused) {
      refused = true;
      throw new Error("Falha ao salvar sorteios");
    }
    original.call(this, key, value);
  });
  expect((await applyRestore(preview)).ok).toBe(false);
  failure.mockRestore();
  expect(localStorage.getItem(STORAGE_KEY)).toBe(before);
  expect(localStorage.getItem(SIM_KEY)).toBe(partnerBefore);
  expect(localStorage.getItem("enigma-premiado:restore")).toBeNull();
});

it("preserva alterações locais feitas enquanto o vídeo da cópia está sendo restaurado", async () => {
  await repo.startRehearsal();
  const id = currentDraw(saved()).id;
  await keepRecording(id, { id: "v", real: true, mode: "voz", mic: true, startedAt: 1, durationMs: 10 }, new Blob(["voz"]));
  const backup = await prepareBackup();
  if (!backup.ok) throw new Error(backup.message);
  localStorage.clear();
  files.clear();
  repo.reload();
  repo.getSnapshot();
  updateSim(emptySim);
  const preview = await previewRestore(new File([backup.blob], "copia.zip"));
  if (!preview.ok) throw new Error(preview.message);
  const videos = await import("@/lib/enigma/videos");
  const write = vi.spyOn(videos, "putVideoOrThrow").mockImplementationOnce(async (videoId, blob) => {
    files.set(videoId, blob);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved(), merchants: [{ id: "durante", name: "Novo comércio", createdAt: 1 }] }));
  });
  expect((await applyRestore(preview)).ok).toBe(false);
  write.mockRestore();
  expect(saved().merchants.map((m) => m.id)).toEqual(["durante"]);
  expect(saved().draws).toHaveLength(0);
  expect(files.has("v")).toBe(false);
});

it("permite confirmar pela tela uma restauração com apenas parceiros novos", async () => {
  const { RestoreCard } = await import("@/components/enigma/RestoreCard");
  updateSim(() => ({ ...emptySim(), accounts: [{ id: "unica", email: "teste@exemplo.com" }] }));
  await repo.startRehearsal();
  const backup = await prepareBackup();
  if (!backup.ok) throw new Error(backup.message);
  updateSim(emptySim);
  render(<RestoreCard />);
  const file = new File([backup.blob], "parceiros.zip");
  fireEvent.change(screen.getByTestId("restore-file"), { target: { files: [file] } });
  const button = await screen.findByText("Confirmar e restaurar");
  fireEvent.click(button);
  await waitFor(() => expect(sim().accounts[0]?.id).toBe("unica"));
  expect(saved().draws).toHaveLength(1);
});

it("mantém a oferta ao falhar e reutiliza seu ID quando a operação demora", async () => {
  const { partnersRepo } = await import("@/lib/enigma/partners-repo");
  await partnersRepo.signIn({ id: "conta", email: "teste@exemplo.com", name: "Loja teste", whatsapp: "43999990000" });
  render(<Shop />);
  fireEvent.click(screen.getByText("Salvar e continuar"));
  await screen.findByText("Oferecer agora");
  fireEvent.click(screen.getByText("Oferecer agora"));
  fireEvent.change(screen.getByLabelText("Qual é o prêmio?"), { target: { value: "Um pão" } });
  let finish: (result: import("@/lib/enigma/repo").RepoResult) => void = () => {};
  const send = vi.spyOn(partnersRepo, "submitOffer").mockImplementationOnce(() =>
    new Promise((resolve) => { finish = resolve; }));
  const button = screen.getByText("Enviar para a administradora");
  act(() => { button.click(); button.click(); });
  expect(send).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Enviando…")).toBeDisabled();
  await act(async () => { finish({ ok: false, error: "write", message: "Falha simulada" }); });
  expect(screen.getByLabelText("Qual é o prêmio?")).toHaveValue("Um pão");
  const first = send.mock.calls[0]![0];
  send.mockResolvedValueOnce({ ok: true, value: undefined });
  fireEvent.click(screen.getByText("Enviar para a administradora"));
  await screen.findByText("Tudo certo!");
  expect(send.mock.calls[1]![0]).toEqual(first);
  send.mockRestore();
});
