// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Wheel } from "@/components/enigma/Wheel";
import { targetRotation } from "@/lib/enigma/logic";
import { wheelFontSize, wheelLabel, wheelZoom } from "@/lib/enigma/wheel-visual";

const names = Array.from({ length: 250 }, (_, i) => `Pessoa ${i + 1}`);

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([75, 101, 250])("renders names and slices for %i participants", (count) => {
  const { container } = render(<Wheel names={names.slice(0, count)} rotation={0} />);
  const wheel = container.querySelector('svg[aria-label="Roleta"]')!;
  expect(wheel.querySelectorAll("path")).toHaveLength(count);
  expect(Array.from(wheel.querySelectorAll("text"), (label) => label.textContent)).toEqual(
    names.slice(0, count),
  );
});

it("shows longer names where the wheel has space, without changing the original", () => {
  const full = "Mariana Marcial Barbosa de Almeida";
  expect(wheelLabel("  Rosa  Maria  ", 75)).toBe("Rosa Maria");
  expect(wheelLabel("Rosana Moura Garlin", 75)).toBe("Rosana Moura Garlin");
  expect(wheelLabel(full, 75)).toBe("Mariana Marcial Barbosa…");
  expect(wheelLabel(full, 250).length).toBeLessThan(wheelLabel(full, 75).length);
  expect(full).toBe("Mariana Marcial Barbosa de Almeida");
});

it("zooms late, keeps the pointer fixed and displays the saved name at the end of the spin", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const onSpinEnd = vi.fn();
  const rotation = targetRotation(0, 249, 250, 0.5);
  const { container, rerender } = render(
    <Wheel
      names={names}
      rotation={rotation}
      spin={{ from: 0, durationMs: 1000, key: 1, zoom: true }}
      onSpinEnd={onSpinEnd}
    />,
  );
  const rim = container.querySelector<HTMLElement>(".wheel-rim")!;
  const focus = container.querySelector<HTMLDivElement>("div[aria-hidden=true]")!;
  const pointer = container.querySelector("svg[aria-hidden=true]")!;
  act(() => frame(500));
  expect(rim.style.transform).toBe("");
  expect(focus.hidden).toBe(true);
  act(() => frame(1000));
  expect(rim.style.transform).toBe("scale(1.9)");
  expect(rim.contains(pointer)).toBe(false);
  expect(focus.hidden).toBe(false);
  expect(focus.textContent).toBe("Pessoa 250");
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(5999));
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(6000));
  expect(onSpinEnd).toHaveBeenCalledTimes(1);
  rerender(<Wheel names={names} rotation={rotation} />);
  expect(rim.style.transform).toBe("");
  expect(focus.hidden).toBe(true);
});

it("scales dense labels and skips zoom with reduced motion", () => {
  expect(wheelFontSize(75)).toBeGreaterThan(wheelFontSize(101));
  expect(wheelFontSize(250)).toBeLessThan(wheelFontSize(101));
  expect(wheelZoom(0.7, true)).toBeGreaterThan(1);
  expect(wheelZoom(1, false)).toBe(1);
});

it("rotates gently while waiting and stops the idle animation on a spin", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  const cancel = vi.fn();
  vi.stubGlobal("cancelAnimationFrame", cancel);
  const onIdleRotation = vi.fn();
  const { container, rerender } = render(
    <Wheel names={names} rotation={0} idle onIdleRotation={onIdleRotation} />,
  );
  const wheel = container.querySelector<SVGSVGElement>('svg[aria-label="Roleta"]')!;
  act(() => frame(22500));
  expect(wheel.style.transform).toBe("rotate(90deg)");
  expect(onIdleRotation).toHaveBeenLastCalledWith(90);
  rerender(<Wheel names={names} rotation={0} idle={false} />);
  expect(cancel).toHaveBeenCalled();
  expect(wheel.style.transform).toBe("rotate(0deg)");
});
