import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PartnerTools } from "@/components/enigma/Partners";
import { repo, useAppState } from "@/lib/enigma/repo";
import { updateSim } from "@/lib/enigma/partners-store";
import { emptySim } from "@/lib/enigma/partners";
import type { AppState } from "@/lib/enigma/types";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate, Link: "a" }));

function Panel() {
  const state = useAppState();
  return state ? <PartnerTools state={state} /> : null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  navigate.mockClear();
});

async function selectOffers(count: number) {
  localStorage.clear();
  repo.reload();
  const merchants = Array.from({ length: count }, (_, i) => ({
    id: `m${i}`, name: `Loja ${i}`, createdAt: 1,
  }));
  for (const merchant of merchants) await repo.saveMerchant(merchant);
  updateSim(() => ({
    ...emptySim(),
    offers: merchants.map((merchant, i) => ({
      id: `o${i}`, accountId: "a", merchantId: merchant.id,
      name: merchant.name, whatsapp: "43999990000", createdAt: 1, prize: `Prêmio ${i}`,
    })),
  }));
  render(<Panel />);
  for (const checkbox of screen.getAllByRole("checkbox")) fireEvent.click(checkbox);
  fireEvent.click(screen.getByText("Escolher data da rodada"));
}

function savedState(): AppState {
  return JSON.parse(localStorage.getItem("enigma-premiado:v1")!);
}

it.each([1, 2])("cria rascunho com %i ofertas e mantém acesso após confirmar a última", async (count) => {
  await selectOffers(count);
  expect(savedState().draws).toHaveLength(0);
  fireEvent.click(screen.getByText("Confirmar e criar rascunho"));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Rascunho criado"));
  expect(screen.queryByText(/Ofertas recebidas/)).toBeNull();
  for (let i = 0; i < count; i++) {
    expect(screen.getByText(`Loja ${i} — Prêmio ${i}`)).toBeTruthy();
  }
  const draft = savedState().draws[0]!;
  fireEvent.click(screen.getByText("Abrir rascunho"));
  expect(navigate).toHaveBeenCalledWith({
    to: "/sorteios/editar/$drawId", params: { drawId: draft.id },
  });
  cleanup();
  repo.reload();
  const snapshot = repo.getSnapshot();
  expect(snapshot?.kind).toBe("ok");
  if (snapshot?.kind !== "ok") throw new Error("Falha na releitura");
  expect(snapshot.state.draws).toHaveLength(1);
  expect(snapshot.state.draws[0]?.draft).toBe(true);
  expect([draft.prize, ...(draft.extraPrizes ?? []).map((p) => p.prize)])
    .toEqual(Array.from({ length: count }, (_, i) => `Prêmio ${i}`));
});

it("mantém seleção e data quando o armazenamento recusa a criação", async () => {
  await selectOffers(2);
  const input = screen.getByLabelText("Data da rodada");
  fireEvent.change(input, { target: { value: "2026-12-10" } });
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "enigma-premiado:v1") throw new Error("Sem espaço");
    original.call(this, key, value);
  });
  fireEvent.click(screen.getByText("Confirmar e criar rascunho"));
  await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
  expect(savedState().draws).toHaveLength(0);
  expect(screen.queryByText("Abrir rascunho")).toBeNull();
  expect((input as HTMLInputElement).value).toBe("2026-12-10");
  expect(screen.getAllByRole("checkbox").every((c) => (c as HTMLInputElement).checked)).toBe(true);
});

function failOfferConfirmation() {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === "enigma-premiado:p1-ensaio") throw new Error("Falha após salvar rodada");
    original.call(this, key, value);
  });
}

function savedOffers() {
  return JSON.parse(localStorage.getItem("enigma-premiado:p1-ensaio")!).offers as import("@/lib/enigma/partners").Offer[];
}

it("recupera A após falha parcial e deixa B selecionada e pendente", async () => {
  await selectOffers(2);
  fireEvent.click(screen.getAllByRole("checkbox")[1]!);
  const failure = failOfferConfirmation();
  fireEvent.click(screen.getByText("Confirmar e criar rascunho"));
  await waitFor(() => expect(screen.getByText("Abrir rascunho")).toBeTruthy());
  expect(savedOffers().every((o) => !o.confirmed)).toBe(true);
  failure.mockRestore();
  fireEvent.click(screen.getAllByRole("checkbox")[1]!);
  fireEvent.click(screen.getByText("Confirmar e criar rascunho"));
  await waitFor(() => expect(savedOffers()[0]?.confirmed).toBeTruthy());
  expect(savedOffers()[1]?.confirmed).toBeUndefined();
  expect(savedState().draws).toHaveLength(1);
  expect(savedState().draws[0]?.extraPrizes ?? []).toHaveLength(0);
  expect(screen.getAllByRole("checkbox")).toHaveLength(1);
  expect((screen.getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
});

it("recupera associação explícita após remontar e escolher outro destino", async () => {
  await selectOffers(1);
  const base = {
    id: "destino-a", merchantId: "m0", merchant: "Loja 0", prize: "Prêmio 0",
    date: "2026-12-10", names: [], createdAt: 1,
  };
  await act(async () => {
    await repo.createDraw(base, { makeCurrent: false });
    await repo.createDraw({ ...base, id: "destino-b", date: "2026-12-09" }, { makeCurrent: false });
  });
  fireEvent.click(screen.getByText("Adicionar a uma rodada existente"));
  fireEvent.click(screen.getByLabelText('Sim, é “Prêmio 0”'));
  const failure = failOfferConfirmation();
  fireEvent.click(screen.getByText("Confirmar e adicionar"));
  await waitFor(() => expect(screen.getByText("Confirmar e adicionar").hasAttribute("disabled")).toBe(false));
  failure.mockRestore();
  cleanup();
  repo.reload();
  render(<Panel />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByText("Adicionar a uma rodada existente"));
  fireEvent.change(screen.getByTestId("draw-select"), { target: { value: "destino-b" } });
  fireEvent.click(screen.getByText("Confirmar e adicionar"));
  await waitFor(() => expect(savedOffers()[0]?.confirmed).toBeTruthy());
  expect(savedOffers()[0]?.confirmed).toMatchObject({ drawId: "destino-a", roundId: "destino-a", linked: true });
  expect(savedState().draws.every((d) => !d.extraPrizes?.length)).toBe(true);
});

it("bloqueia dois acionamentos no mesmo instante", async () => {
  await selectOffers(1);
  const create = vi.spyOn(repo, "createDraw");
  const button = screen.getByText("Confirmar e criar rascunho");
  act(() => {
    button.click();
    button.click();
  });
  await waitFor(() => expect(screen.getByText("Abrir rascunho")).toBeTruthy());
  expect(create).toHaveBeenCalledTimes(1);
  expect(savedState().draws).toHaveLength(1);
});

it("oferta acrescentada em A permanece em A após falha, releitura e escolha de B", async () => {
  await selectOffers(1);
  const base = {
    id: "a", merchantId: "m0", merchant: "Loja 0", prize: "Prêmio original",
    date: "2026-12-10", names: [], createdAt: 1,
  };
  await act(async () => {
    await repo.createDraw(base, { makeCurrent: false });
    await repo.createDraw({ ...base, id: "b", date: "2026-12-09" }, { makeCurrent: false });
  });
  fireEvent.click(screen.getByText("Adicionar a uma rodada existente"));
  const failure = failOfferConfirmation();
  fireEvent.click(screen.getByText("Confirmar e adicionar"));
  await waitFor(() => expect(savedState().draws[0]?.extraPrizes).toHaveLength(1));
  await waitFor(() => expect(screen.getByText("Confirmar e adicionar").hasAttribute("disabled")).toBe(false));
  expect(savedOffers()[0]?.confirmed).toBeUndefined();
  failure.mockRestore();
  cleanup();
  repo.reload();
  render(<Panel />);
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByText("Adicionar a uma rodada existente"));
  fireEvent.change(screen.getByTestId("draw-select"), { target: { value: "b" } });
  fireEvent.click(screen.getByText("Confirmar e adicionar"));
  await waitFor(() => expect(savedOffers()[0]?.confirmed?.drawId).toBe("a"));
  expect(savedState().draws[0]?.extraPrizes).toHaveLength(1);
  expect(savedState().draws[1]?.extraPrizes).toBeUndefined();
});
