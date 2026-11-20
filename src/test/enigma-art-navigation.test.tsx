// @vitest-environment jsdom
import type { ReactNode } from "react";
import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ImageShareDialog } from "@/components/enigma/ImageShare";
import type { CardImage } from "@/lib/enigma/cards-render";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => (open ? <>{children}</> : null),
  DialogContent: ({ children }: { children: ReactNode }) => <section role="dialog">{children}</section>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));
vi.mock("@/lib/enigma/cards-render", () => ({ releaseCards: vi.fn() }));

afterEach(() => cleanup());

const arts = [
  { id: "resumo", label: "Resumo" },
  { id: "0", label: "Prêmio 1" },
  { id: "1", label: "Prêmio 2" },
  { id: "2", label: "Prêmio 3" },
];
const card = (id: string, n = 1): CardImage[] =>
  Array.from({ length: n }, (_, i) => ({
    filename: `${id}-${i + 1}.png`,
    url: `blob:${id}-${i + 1}`,
    blob: new Blob([id], { type: "image/png" }),
  }));

function Harness({ pages = {} as Record<string, number> }) {
  const [choice, setChoice] = useState("resumo");
  return (
    <ImageShareDialog
      open
      onClose={vi.fn()}
      title="Arte dos ganhadores"
      description="Confira."
      renderKey={choice}
      make={async () => card(choice, pages[choice] ?? 1)}
      choices={arts}
      choice={choice}
      onChoice={setChoice}
    />
  );
}

it("with three courtesies, the arrows walk Resumo → Prêmio 1 → 2 → 3 and back", async () => {
  render(<Harness />);
  expect(await screen.findByText("Arte 1 de 4")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(true);
  for (const [n, label] of [[2, "Prêmio 1"], [3, "Prêmio 2"], [4, "Prêmio 3"]] as const) {
    fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
    expect(await screen.findByText(`Arte ${n} de 4`)).toBeTruthy();
    expect(screen.getByRole("tab", { name: label }).getAttribute("aria-selected")).toBe("true");
  }
  expect(screen.getByRole("button", { name: "Próxima" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
  expect(await screen.findByText("Arte 3 de 4")).toBeTruthy();
});

it("a swipe moves to the next art; a vertical drag does not", async () => {
  render(<Harness />);
  const region = await screen.findByRole("region", { name: "Prévia da arte" });
  fireEvent.touchStart(region, { changedTouches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(region, { changedTouches: [{ clientX: 60, clientY: 110 }] });
  expect(await screen.findByText("Arte 2 de 4")).toBeTruthy();
  const again = await screen.findByRole("region", { name: "Prévia da arte" });
  fireEvent.touchStart(again, { changedTouches: [{ clientX: 200, clientY: 100 }] });
  fireEvent.touchEnd(again, { changedTouches: [{ clientX: 170, clientY: 260 }] });
  expect(screen.getByText("Arte 2 de 4")).toBeTruthy();
});

it("an art split in several pictures shows every page before moving to the next art", async () => {
  render(<Harness pages={{ resumo: 2 }} />);
  expect(await screen.findByText("Imagem 1 de 2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("Imagem 2 de 2")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(await screen.findByText("Arte 2 de 4")).toBeTruthy();
  expect(screen.getByRole("tab", { name: "Prêmio 1" }).getAttribute("aria-selected")).toBe("true");
});
