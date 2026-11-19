import { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/__root";
import { repo } from "@/lib/enigma/repo";
import { writeJournal, STORAGE_KEY } from "@/lib/enigma/store";
import { RESTORE_KEY } from "@/lib/enigma/restore-lock";
import { SIM_KEY, updateSim } from "@/lib/enigma/partners-store";
import { emptySim } from "@/lib/enigma/partners";

vi.mock("@tanstack/react-router", () => ({
  createRootRouteWithContext: () => (options: object) => ({
    ...options, useRouteContext: () => ({ queryClient: new QueryClient() }),
  }),
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) => select({ location: { pathname: "/" } }),
  useRouter: () => ({}),
  Outlet: () => <p>Conteúdo protegido</p>,
  Link: "a", HeadContent: () => null, Scripts: () => null,
}));
vi.mock("@/lib/lovable-error-reporting", () => ({ reportLovableError: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("bloqueia tela e gravações enquanto a recuperação não consegue terminar", async () => {
  localStorage.clear();
  repo.reload();
  await repo.startRehearsal();
  const raw = localStorage.getItem(STORAGE_KEY)!;
  writeJournal({ phase: "data", prevRaw: raw, newRaw: raw, newVideoIds: [], prevPartnerRaw: null, newPartnerRaw: JSON.stringify(emptySim()) });
  const original = Storage.prototype.setItem;
  const failure = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key === SIM_KEY) throw new Error("Sem espaço");
    original.call(this, key, value);
  });
  const Root = (Route as unknown as { component: () => React.ReactNode }).component;
  render(<Root />);
  await screen.findByText("Recuperar cópia interrompida");
  expect(screen.queryByText("Conteúdo protegido")).toBeNull();
  expect(await repo.setPreferences({ sound: false })).toMatchObject({ ok: false, error: "restore" });
  expect(updateSim(emptySim)).toBe(false);
  expect(localStorage.getItem(RESTORE_KEY)).toBeTruthy();
  failure.mockRestore();
  fireEvent.click(screen.getByText("Tentar recuperar novamente"));
  await screen.findByText("Conteúdo protegido");
  expect(localStorage.getItem(RESTORE_KEY)).toBeNull();
  expect((await repo.setPreferences({ sound: false })).ok).toBe(true);
});
