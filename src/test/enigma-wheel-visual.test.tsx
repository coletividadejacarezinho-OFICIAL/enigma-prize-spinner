// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Wheel } from "@/components/enigma/Wheel";
import { targetRotation } from "@/lib/enigma/logic";
import { pointerNudge, wheelFontSize, wheelLabel, wheelZoom } from "@/lib/enigma/wheel-visual";

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

it.each([75, 150, 250])("keeps %i original names in order with readable edge labels", (count) => {
  const original = names.slice(0, count);
  const { container } = render(<Wheel names={original} rotation={0} />);
  const labels = Array.from(container.querySelectorAll<SVGTextElement>('svg[aria-label="Roleta"] text[aria-label]'));

  expect(labels).toHaveLength(count);
  expect(labels.map((label) => label.getAttribute("aria-label"))).toEqual(original);
  expect(labels[0]?.getAttribute("x")).toBe("190");
  expect(labels[Math.ceil(count / 2)]?.getAttribute("x")).toBe("10");
  expect(labels[count - 1]?.getAttribute("x")).toBe("190");

  // Bright slices use dark letters with a light border; dark slices use the reverse.
  expect(labels[0]?.style.stroke).not.toBe(labels[1]?.style.stroke);
  expect(labels[0]?.style.paintOrder).toBe("stroke");
  expect(labels[1]?.style.paintOrder).toBe("stroke");
});

it("uses 24 sequential lights without changing names or wheel segments", () => {
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const original = names.slice(0, 75);
  const { container, rerender } = render(<Wheel names={original} rotation={0} />);
  const rim = container.querySelector<HTMLElement>(".wheel-rim")!;
  const bulbs = Array.from(rim.querySelectorAll<HTMLElement>(".wheel-bulb"));
  const wheel = container.querySelector('svg[aria-label="Roleta"]')!;
  expect(bulbs).toHaveLength(24);
  expect(new Set(bulbs.map((bulb) => bulb.style.animationDelay)).size).toBe(24);
  const idleDelay = bulbs[1]?.style.animationDelay;
  const segmentCount = wheel.querySelectorAll("path").length;
  rerender(<Wheel names={original} rotation={0} spin={{ from: 0, durationMs: 1000, key: 1, zoom: true }} />);
  expect(rim.classList.contains("wheel-rim--spinning")).toBe(true);
  expect(bulbs[1]?.style.animationDelay).not.toBe(idleDelay);
  expect(wheel.querySelectorAll("path")).toHaveLength(segmentCount);
  expect(Array.from(wheel.querySelectorAll("text"), (label) => label.textContent)).toEqual(original);
});

it("keeps all 24 lamps on the outer bezel, clear of the wheel slices", () => {
  for (const size of [75, 250]) {
    const { container, unmount } = render(<Wheel names={names.slice(0, size)} rotation={0} />);
    const rim = container.querySelector(".wheel-rim");
    const bezel = rim?.querySelector(".wheel-bezel-line");
    const lights = Array.from(rim?.querySelectorAll<HTMLElement>(".wheel-bulb") ?? []);
    const disc = container.querySelector('svg[aria-label="Roleta"]');
    expect(bezel?.getAttribute("aria-hidden")).toBe("true");
    expect(lights).toHaveLength(24);
    expect(disc?.querySelectorAll("path")).toHaveLength(size);

    // Disc ends at 46.5% of the rim diameter; lamp centers must lie beyond it.
    for (const lamp of lights) {
      const x = Number.parseFloat(lamp.style.left);
      const y = Number.parseFloat(lamp.style.top);
      const distance = Math.hypot(x - 50, y - 50);
      expect(distance).toBeGreaterThan(48);
      expect(distance).toBeLessThan(48.3);
    }
    unmount();
  }
});

it("shows longer names where the wheel has space, without changing the original", () => {
  const full = "Mariana Marcial Barbosa de Almeida";
  expect(wheelLabel("  Rosa  Maria  ", 75)).toBe("Rosa Maria");
  expect(wheelLabel("Rosana Moura Garlin", 75)).toBe("Rosana Moura Garlin");
  expect(wheelLabel(full, 75)).toBe("Mariana Marcial Barbosa…");
  expect(wheelLabel(full, 250).length).toBeLessThan(wheelLabel(full, 75).length);
  expect(full).toBe("Mariana Marcial Barbosa de Almeida");
});

it("keeps the gold rim visible and the zoom focus clear of the wheel hub", () => {
  const { container } = render(<Wheel names={names.slice(0, 75)} rotation={0} />);
  const halo = container.querySelector(".wheel-stage-halo");
  const rim = container.querySelector(".wheel-rim");
  const bulbs = container.querySelector(".wheel-bulb-track");
  const disc = container.querySelector('svg[aria-label="Roleta"]')?.parentElement;
  const pointerAura = container.querySelector(".wheel-pointer-aura");
  const focus = container.querySelector<HTMLDivElement>(".wheel-focus");

  expect(halo?.getAttribute("aria-hidden")).toBe("true");
  expect(rim).toBeTruthy();
  expect(bulbs?.classList.contains("z-[2]")).toBe(true);
  expect(disc?.classList.contains("z-0")).toBe(true);
  expect(bulbs?.querySelectorAll(".wheel-bulb")).toHaveLength(24);
  expect(pointerAura?.getAttribute("aria-hidden")).toBe("true");
  expect(focus?.hidden).toBe(true);
  expect(focus?.classList.contains("top-[72%]")).toBe(true);
  expect(focus?.classList.contains("truncate")).toBe(false);
  expect(focus?.classList.contains("z-20")).toBe(true);
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

it("keeps the metallic pointer stationary at the top and highlights a confirmed winner", () => {
  const { container, rerender } = render(<Wheel names={names.slice(0, 75)} rotation={0} />);
  const pointer = container.querySelector<SVGSVGElement>(".wheel-pointer")!;
  const wheel = container.querySelector<SVGSVGElement>('svg[aria-label="Roleta"]')!;
  expect(pointer).toBeTruthy();
  expect(wheel.contains(pointer)).toBe(false);
  expect(pointer.querySelector("linearGradient")).toBeTruthy();
  expect(pointer.classList.contains("wheel-pointer--winner")).toBe(false);
  rerender(<Wheel names={names.slice(0, 75)} rotation={0} winner />);
  expect(pointer.classList.contains("wheel-pointer--winner")).toBe(true);
  expect(wheel.querySelectorAll("path")).toHaveLength(75);
});

it("flicks pointer on segment crossings, throttles dense slices and holds final glow", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const onSpinEnd = vi.fn();
  const rotation = targetRotation(0, 74, 75, 0.5);
  const { container, rerender } = render(
    <Wheel
      names={names.slice(0, 75)}
      rotation={rotation}
      spin={{ from: 0, durationMs: 1000, key: 1, zoom: true }}
      onSpinEnd={onSpinEnd}
    />,
  );
  const pointer = container.querySelector<SVGSVGElement>(".wheel-pointer")!;
  const tip = container.querySelector<SVGGElement>(".wheel-pointer-tip")!;
  const cancel = vi.fn();
  const animate = vi.fn(() => ({ cancel }));
  Object.defineProperty(tip, "animate", { configurable: true, value: animate });
  act(() => frame(200));
  expect(animate).toHaveBeenCalledTimes(1);
  act(() => frame(250));
  expect(animate).toHaveBeenCalledTimes(1);
  act(() => frame(400));
  expect(animate).toHaveBeenCalledTimes(2);
  act(() => frame(1000));
  expect(pointer.classList.contains("wheel-pointer--landed")).toBe(true);
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(5999));
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(6000));
  expect(onSpinEnd).toHaveBeenCalledTimes(1);
  rerender(<Wheel names={names.slice(0, 75)} rotation={rotation} winner />);
  expect(pointer.classList.contains("wheel-pointer--landed")).toBe(false);
  expect(pointer.classList.contains("wheel-pointer--winner")).toBe(true);
});

it("limits recorded pointer nudge to a subtle visual click", () => {
  const oneSlice = 360 / 75;
  expect(pointerNudge(0, 75, true)).toBeCloseTo(0);
  expect(pointerNudge(oneSlice * 0.15, 75, true)).toBeCloseTo(-5);
  expect(pointerNudge(oneSlice * 0.7, 75, true)).toBe(0);
  expect(pointerNudge(oneSlice * 0.15, 75, false)).toBe(0);
  expect(pointerNudge(oneSlice * 0.15, 1, true)).toBe(0);
  expect(pointerNudge(Infinity, 250, true)).toBe(0);
});
