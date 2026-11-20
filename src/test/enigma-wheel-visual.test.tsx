// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { Wheel } from "@/components/enigma/Wheel";
import { targetRotation } from "@/lib/enigma/logic";
import { rimLightIndex, wheelFontSize, wheelLabel, wheelZoom } from "@/lib/enigma/wheel-visual";

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
  expect(labels[count - 1]?.getAttribute("x")).toBe("10");

  // Bright slices use dark letters with a light border; dark slices use the reverse.
  expect(labels[0]?.style.stroke).not.toBe(labels[1]?.style.stroke);
  expect(labels[0]?.style.paintOrder).toBe("stroke");
  expect(labels[1]?.style.paintOrder).toBe("stroke");
});

it("moves the 24 rim lights with the reported rotation and leaves them in place when it stops", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const original = names.slice(0, 75);
  const onSpinFrame = vi.fn();
  const { container } = render(
    <Wheel names={original} rotation={1880} spin={{ from: 0, durationMs: 1000, key: 1, zoom: true }} onSpinFrame={onSpinFrame} />,
  );
  const bulbs = Array.from(container.querySelectorAll(".wheel-bulb"));
  const wheel = container.querySelector('svg[aria-label="Roleta"]')!;
  const lit = () => bulbs.flatMap((bulb, index) => bulb.hasAttribute("data-lit") ? [index] : []);
  expect(bulbs).toHaveLength(24);
  expect(lit()).toEqual([0, 1, 2, 3]);

  act(() => frame(330));
  const first = rimLightIndex(onSpinFrame.mock.lastCall![0].rotation);
  expect(lit()).toContain(first);
  expect(lit()).toHaveLength(4);
  expect(lit()).not.toEqual([0, 1, 2, 3]);

  act(() => frame(1000));
  const stopped = lit();
  act(() => frame(3000));
  expect(lit()).toEqual(stopped);
  expect(wheel.querySelectorAll("path")).toHaveLength(75);
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
  const focus = container.querySelector<HTMLDivElement>(".wheel-focus")!;
  const pointer = container.querySelector("svg.wheel-pointer")!;
  act(() => frame(500));
  expect(rim.style.transform).toBe("");
  expect(focus.hidden).toBe(true);
  act(() => frame(1000));
  expect(rim.style.transform).toBe("scale(1.9)");
  expect(rim.contains(pointer)).toBe(false);
  expect(focus.hidden).toBe(false);
  expect(focus.textContent).toBe("Pessoa 250");
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(5200));
  expect(rim.style.transform).toBe("scale(1.9)");
  act(() => frame(5600));
  expect(rim.style.transform).toBe("scale(1.45)");
  act(() => frame(5999));
  expect(focus.textContent).toBe("Pessoa 250");
  expect(focus.hidden).toBe(false);
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(6000));
  expect(onSpinEnd).toHaveBeenCalledTimes(1);
  expect(rim.style.transform).toBe("");
  expect(focus.hidden).toBe(true);
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

it("shares the pointer deflection and stops the track when the wheel lands", () => {
  let frame: FrameRequestCallback = () => {};
  vi.spyOn(performance, "now").mockReturnValue(0);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const onSpinEnd = vi.fn();
  const onSpinLand = vi.fn();
  const onSpinFrame = vi.fn();
  const stopTrack = vi.fn();
  const startTrack = vi.fn(() => stopTrack);
  const rotation = targetRotation(0, 74, 75, 0.5);
  const { container, rerender } = render(
    <Wheel
      names={names.slice(0, 75)}
      winnerIndex={74}
      rotation={rotation}
      spin={{ from: 0, durationMs: 1000, key: 1, zoom: true }}
      onSpinStart={startTrack}
      onSpinFrame={onSpinFrame}
      onSpinLand={onSpinLand}
      onSpinEnd={onSpinEnd}
    />,
  );
  const pointer = container.querySelector<SVGSVGElement>(".wheel-pointer")!;
  const rim = container.querySelector(".wheel-rim")!;
  expect(rim.querySelector(".wheel-winning-slice")).toBeTruthy();
  expect(rim.hasAttribute("data-landed")).toBe(false);
  const tip = container.querySelector<SVGGElement>(".wheel-pointer-tip")!;
  expect(startTrack).toHaveBeenCalledExactlyOnceWith(1000);
  act(() => frame(200));
  act(() => frame(240));
  const tilt = onSpinFrame.mock.lastCall![0].pointerTilt;
  // The next slice can cross during that same deflection without restarting it.
  expect(tilt).toBeLessThan(-3);
  expect(tip.style.transform).toBe(`rotate(${tilt}deg)`);
  expect(onSpinLand).not.toHaveBeenCalled();
  expect(stopTrack).not.toHaveBeenCalled();

  act(() => frame(1000));
  expect(pointer.classList.contains("wheel-pointer--landed")).toBe(true);
  expect(rim.hasAttribute("data-landed")).toBe(true);
  expect(onSpinFrame.mock.lastCall![0]).toMatchObject({ rotation, progress: 1, pointerTilt: 0 });
  expect(tip.style.transform).toBe("");
  expect(stopTrack).toHaveBeenCalledOnce();
  expect(onSpinLand).toHaveBeenCalledOnce();
  expect(onSpinEnd).not.toHaveBeenCalled();
  act(() => frame(6000));
  expect(onSpinLand).toHaveBeenCalledOnce();
  expect(onSpinEnd).toHaveBeenCalledOnce();
  rerender(<Wheel names={names.slice(0, 75)} winnerIndex={74} rotation={rotation} winner />);
  expect(rim.hasAttribute("data-landed")).toBe(false);
  expect(rim.hasAttribute("data-winner")).toBe(true);
  expect(pointer.classList.contains("wheel-pointer--landed")).toBe(false);
  expect(pointer.classList.contains("wheel-pointer--winner")).toBe(true);
});
