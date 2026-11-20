// @vitest-environment jsdom
import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { CameraDialog } from "@/components/enigma/CameraDialog";

// Isolate the recording-mode chooser from portal/focus-trap behavior.
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => <>{children}</>,
  DialogContent: ({ children, className }: { children: ReactNode; className: string }) =>
    <div className={className}>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("keeps the three recording modes, their labels and a distinct visual icon each", () => {
  const { container } = render(<CameraDialog open onClose={vi.fn()} onStart={vi.fn()} />);
  expect(screen.getByRole("radiogroup", { name: "Modo de gravação" })).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(container.querySelectorAll(".enigma-capture-icon")).toHaveLength(3);
  expect(container.querySelectorAll(".enigma-capture-icon svg")).toHaveLength(3);
  expect(screen.getByRole("radio", { name: /Roleta com meu rosto/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: /Só a roleta/ })).toBeTruthy();
  expect(screen.getByRole("radio", { name: /Só minha voz/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Continuar" })).toBeTruthy();
});

it("preserves mode selection and microphone switch behavior", () => {
  render(<CameraDialog open onClose={vi.fn()} onStart={vi.fn()} />);
  fireEvent.click(screen.getByRole("radio", { name: /Só a roleta/ }));
  expect(screen.getByRole("radio", { name: /Só a roleta/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("radio", { name: /Roleta com meu rosto/ }).getAttribute("aria-checked")).toBe("false");

  const mic = screen.getByRole("switch", { name: /Microfone/ });
  expect(mic.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(mic);
  expect(mic.getAttribute("aria-checked")).toBe("false");

  fireEvent.click(screen.getByRole("radio", { name: /Só minha voz/ }));
  expect(screen.getByRole("radio", { name: /Só minha voz/ }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("switch")).toBeNull();
});

it("keeps the original Cancelar action and never opens camera just to choose a mode", () => {
  const onClose = vi.fn();
  const onStart = vi.fn();
  render(<CameraDialog open onClose={onClose} onStart={onStart} />);
  fireEvent.click(screen.getByRole("radio", { name: /Só a roleta/ }));
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onStart).not.toHaveBeenCalled();
});
