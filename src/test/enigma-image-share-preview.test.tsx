// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ImageShareDialog } from "@/components/enigma/ImageShare";
import type { CardImage } from "@/lib/enigma/cards-render";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: ReactNode; open: boolean }) => open ? <>{children}</> : null,
  DialogContent: ({ children, className }: { children: ReactNode; className: string }) =>
    <section role="dialog" className={className}>{children}</section>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

vi.mock("@/lib/enigma/cards-render", () => ({
  releaseCards: vi.fn(),
}));

const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
const originalCanShare = Object.getOwnPropertyDescriptor(navigator, "canShare");
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [key, descriptor] of [
    ["share", originalShare],
    ["canShare", originalCanShare],
  ] as const) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor);
    else Reflect.deleteProperty(navigator, key);
  }
});

function images(count: number): CardImage[] {
  return Array.from({ length: count }, (_, i) => ({
    filename: `enigma-resumo-parte-${i + 1}.png`,
    url: `blob:teste-${i + 1}`,
    blob: new Blob([`parte ${i + 1}`], { type: "image/png" }),
  }));
}

async function show(cards: CardImage[]) {
  const make = vi.fn().mockResolvedValue(cards);
  render(
    <ImageShareDialog
      open
      onClose={vi.fn()}
      title="Arte dos ganhadores"
      description="Confira as imagens."
      renderKey="teste"
      make={make}
    />,
  );
  await screen.findByRole("region", { name: "Prévia da arte" });
  return make;
}

it("shows one art at a time, with clear previous/next controls and page count", async () => {
  await show(images(3));
  const preview = screen.getByRole("region", { name: "Prévia da arte" });
  expect(preview.querySelectorAll("img")).toHaveLength(1);
  expect(screen.getByText("Imagem 1 de 3")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Anterior" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("Imagem 2 de 3")).toBeTruthy();
  expect(screen.getByRole("img", { name: "Imagem 2 de 3" }).getAttribute("src")).toBe("blob:teste-2");
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("Imagem 3 de 3")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Próxima" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
  expect(screen.getByText("Imagem 2 de 3")).toBeTruthy();
});

it("supports horizontal swiping but ignores vertical gestures", async () => {
  await show(images(3));
  const preview = screen.getByRole("region", { name: "Prévia da arte" });
  fireEvent.touchStart(preview, { changedTouches: [{ clientX: 180, clientY: 100 }] });
  fireEvent.touchEnd(preview, { changedTouches: [{ clientX: 80, clientY: 110 }] });
  expect(screen.getByText("Imagem 2 de 3")).toBeTruthy();
  fireEvent.touchStart(preview, { changedTouches: [{ clientX: 180, clientY: 100 }] });
  fireEvent.touchEnd(preview, { changedTouches: [{ clientX: 140, clientY: 220 }] });
  expect(screen.getByText("Imagem 2 de 3")).toBeTruthy();
});

it("keeps multi-file sharing independent from the currently selected preview", async () => {
  const share = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "canShare", { configurable: true, value: vi.fn().mockReturnValue(true) });
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  await show(images(3));
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("Imagem 2 de 3")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Compartilhar imagens (3)" }));
  await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
  const arg = share.mock.calls[0]?.[0] as { files: File[] };
  expect(arg.files.map((f) => f.name)).toEqual([
    "enigma-resumo-parte-1.png",
    "enigma-resumo-parte-2.png",
    "enigma-resumo-parte-3.png",
  ]);
});

it("keeps single-image preview simple and offers saving when direct sharing is unsupported", async () => {
  await show(images(1));
  expect(screen.getByRole("img", { name: "Arte dos ganhadores" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Anterior" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Próxima" })).toBeNull();
  expect(screen.getByRole("button", { name: "Salvar imagem" })).toBeTruthy();
});

it("resets the preview to the first image when the selected artwork changes", async () => {
  const originalCards = images(3);
  const newer = images(2);
  const props = {
    open: true,
    onClose: vi.fn(),
    title: "Arte dos ganhadores",
    description: "Confira as imagens.",
  };
  const { rerender } = render(
    <ImageShareDialog {...props} renderKey="resumo" make={async () => originalCards} />,
  );
  await screen.findByText("Imagem 1 de 3");
  fireEvent.click(screen.getByRole("button", { name: "Próxima" }));
  expect(screen.getByText("Imagem 2 de 3")).toBeTruthy();
  rerender(<ImageShareDialog {...props} renderKey="premio-1" make={async () => newer} />);
  await screen.findByText("Imagem 1 de 2");
  expect(screen.getByRole("img", { name: "Imagem 1 de 2" })).toBeTruthy();
});
