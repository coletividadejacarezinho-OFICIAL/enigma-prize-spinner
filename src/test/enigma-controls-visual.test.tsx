// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { BottomNav } from "@/components/enigma/BottomNav";
import { GoldButton, SecondaryButton } from "@/components/enigma/GoldButton";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    className,
    activeOptions,
  }: {
    to: string;
    children: ReactNode;
    className?: string;
    activeOptions?: { exact?: boolean };
  }) => (
    <a href={to} className={className} data-exact={String(activeOptions?.exact)}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps all four bottom navigation destinations and the compact height", () => {
  const { container } = render(<BottomNav />);
  const nav = screen.getByRole("navigation", { name: "Menu principal" });
  expect(nav.classList.contains("enigma-bottom-nav")).toBe(true);
  expect(container.querySelector("ul")?.classList.contains("h-16")).toBe(true);

  for (const [label, path] of [
    ["Roleta", "/"],
    ["Nomes", "/nomes"],
    ["Sorteios", "/sorteios"],
    ["Ajustes", "/ajustes"],
  ] as const) {
    const link = screen.getByRole("link", { name: label });
    expect(link.getAttribute("href")).toBe(path);
    expect(link.classList.contains("enigma-bottom-item")).toBe(true);
  }
  expect(container.querySelectorAll(".enigma-bottom-icon")).toHaveLength(4);
  expect(screen.getByRole("link", { name: "Roleta" }).getAttribute("data-exact")).toBe("true");
});

it("preserves existing button callbacks and disabled behavior with roleta styling", () => {
  const primary = vi.fn();
  const secondary = vi.fn();
  const { rerender } = render(
    <div className="enigma-roleta-actions">
      <GoldButton onClick={primary}>Girar roleta</GoldButton>
      <SecondaryButton className="enigma-secondary-action" onClick={secondary}>
        Editar nomes
      </SecondaryButton>
    </div>,
  );

  fireEvent.click(screen.getByRole("button", { name: "Girar roleta" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar nomes" }));
  expect(primary).toHaveBeenCalledTimes(1);
  expect(secondary).toHaveBeenCalledTimes(1);

  rerender(
    <div className="enigma-roleta-actions">
      <GoldButton onClick={primary} disabled>Girando…</GoldButton>
      <SecondaryButton className="enigma-secondary-action" onClick={secondary} disabled>
        Editar nomes
      </SecondaryButton>
    </div>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Girando…" }));
  fireEvent.click(screen.getByRole("button", { name: "Editar nomes" }));
  expect(primary).toHaveBeenCalledTimes(1);
  expect(secondary).toHaveBeenCalledTimes(1);
});
