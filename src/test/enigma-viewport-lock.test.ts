// @vitest-environment jsdom
import { afterEach, expect, it } from "vitest";

import { lockWheelViewport, WHEEL_VIEWPORT_LOCK } from "@/lib/enigma/viewport-lock";

afterEach(() => {
  document.documentElement.classList.remove(WHEEL_VIEWPORT_LOCK);
  document.body.classList.remove(WHEEL_VIEWPORT_LOCK);
});

it("locks document scrolling while the Roleta is mounted", () => {
  const unlock = lockWheelViewport(document);

  expect(document.documentElement.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(true);
  expect(document.body.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(true);

  unlock();
  expect(document.documentElement.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(false);
  expect(document.body.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(false);
});

it("restores scrolling when leaving Roleta and supports remounting", () => {
  const leaveFirstWheel = lockWheelViewport(document);
  leaveFirstWheel();
  expect(document.body.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(false);

  const leaveSecondWheel = lockWheelViewport(document);
  expect(document.documentElement.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(true);
  leaveSecondWheel();
  expect(document.documentElement.classList.contains(WHEEL_VIEWPORT_LOCK)).toBe(false);
});

it("does not change an unrelated application's navigation or content classes", () => {
  const nav = document.createElement("nav");
  nav.className = "enigma-bottom-nav fixed bottom-0";
  document.body.appendChild(nav);

  const unlock = lockWheelViewport(document);
  expect(nav.className).toBe("enigma-bottom-nav fixed bottom-0");
  unlock();

  expect(nav.className).toBe("enigma-bottom-nav fixed bottom-0");
  nav.remove();
});
