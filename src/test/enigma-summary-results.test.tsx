// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { SummaryResultsDialog } from "@/components/enigma/SummaryResultsDialog";
import { createDraw } from "@/lib/enigma/logic";
import { roundsOf, withRoundResult } from "@/lib/enigma/rounds";
import type { Merchant } from "@/lib/enigma/types";

// Keep the modal local to the test; validate presentation and existing share actions.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) =>
    open ? <>{children}</> : null,
  DialogContent: ({ children, className }: { children: ReactNode; className: string }) =>
    <section role="dialog" className={className}>{children}</section>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const burger: Merchant = { id: "burger", name: "Burger 7", createdAt: 0 };
const bakery: Merchant = { id: "bakery", name: "Padaria da Praça", createdAt: 0 };
const merchants = [burger, bakery];

function completedDraw(prizeCount = 2) {
  const draw = createDraw({
    date: "2026-11-19",
    merchant: burger,
    prize: "Lanche especial",
    confirmed: true,
    more: Array.from({ length: prizeCount - 1 }, (_, i) => ({
      merchant: i % 2 ? burger : bakery,
      prize: `Cortesia ${i + 2}`,
    })),
  });
  let result = { ...draw, names: ["Ana", "Bia", "Caio"] };
  for (let i = 0; i < prizeCount; i++) {
    result = withRoundResult(result, i, {
      winner: i % 2 ? "Caio" : "Bia",
      index: i % 2 ? 2 : 1,
      rotation: 0,
      at: 1,
    });
  }
  return result;
}

it("shows saved winners, their public numbers and each sponsor without mixing courtesies", () => {
  const draw = completedDraw();
  const shareText = vi.fn();
  const shareArt = vi.fn();
  const { container } = render(
    <SummaryResultsDialog
      open
      onClose={vi.fn()}
      date="19/11/2026"
      draw={draw}
      rounds={roundsOf(draw, merchants)}
      onShareText={shareText}
      onShareArt={shareArt}
    />,
  );
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("Todas as 2 cortesias sorteadas")).toBeTruthy();
  expect(screen.getByText("Prêmio 1 de 2")).toBeTruthy();
  expect(screen.getByText("Prêmio 2 de 2")).toBeTruthy();
  expect(screen.getByText("Lanche especial")).toBeTruthy();
  expect(screen.getByText("Cortesia 2")).toBeTruthy();
  expect(screen.getByText("Burger 7")).toBeTruthy();
  expect(screen.getByText("Padaria da Praça")).toBeTruthy();
  expect(screen.getByText("Nº 2")).toBeTruthy();
  expect(screen.getByText("Nº 3")).toBeTruthy();
  expect(container.querySelectorAll('[data-testid="summary"] > li')).toHaveLength(2);

  fireEvent.click(screen.getByRole("button", { name: /Compartilhar no WhatsApp/ }));
  fireEvent.click(screen.getByRole("button", { name: /Compartilhar arte do ganhador/ }));
  expect(shareText).toHaveBeenCalledTimes(1);
  expect(shareArt).toHaveBeenCalledTimes(1);
});

it("holds eight courtesies in a scrollable list while keeping share controls outside it", () => {
  const draw = completedDraw(8);
  const { container } = render(
    <SummaryResultsDialog
      open
      onClose={vi.fn()}
      date="19/11/2026"
      draw={draw}
      rounds={roundsOf(draw, merchants)}
      onShareText={vi.fn()}
      onShareArt={vi.fn()}
    />,
  );
  const list = screen.getByRole("list", { name: "Resultados por cortesia" });
  expect(list.classList.contains("overflow-y-auto")).toBe(true);
  expect(container.querySelectorAll('[data-testid="summary"] > li')).toHaveLength(8);
  expect(screen.getByText("Todas as 8 cortesias sorteadas")).toBeTruthy();
  expect(screen.getByText("Prêmio 8 de 8")).toBeTruthy();
  expect(screen.getByRole("button", { name: /Compartilhar no WhatsApp/ })).toBeTruthy();
});

it("does not claim unfinished rounds have winners or offer final sharing", () => {
  const draw = completedDraw(2);
  const unfinished = { ...draw, extraPrizes: (draw.extraPrizes ?? []).map(({ result: _result, ...prize }) => prize) };
  render(
    <SummaryResultsDialog
      open
      onClose={vi.fn()}
      date="19/11/2026"
      draw={unfinished}
      rounds={roundsOf(unfinished, merchants)}
      onShareText={vi.fn()}
      onShareArt={vi.fn()}
    />,
  );
  expect(screen.getByText("1 de 2 cortesias sorteadas")).toBeTruthy();
  expect(screen.getByText("Ainda não sorteado")).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Compartilhar no WhatsApp/ })).toBeNull();
});
