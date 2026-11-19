import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { openMedia, stopStream } from "@/lib/enigma/recorder";

const originalCapture = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "captureStream");
beforeEach(() => {
  vi.stubGlobal("MediaRecorder", class {});
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", { configurable: true, value: () => ({}) });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  if (originalCapture) Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", originalCapture);
  else Reflect.deleteProperty(HTMLCanvasElement.prototype, "captureStream");
});

it("pede apenas o dispositivo necessário e libera as faixas ao encerrar", async () => {
  const stop = vi.fn();
  const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream;
  const getUserMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const result = await openMedia({ camera: false, mic: true });
  expect(result.ok).toBe(true);
  expect(getUserMedia).toHaveBeenCalledWith({
    video: false, audio: { echoCancellation: true, noiseSuppression: true },
  });
  stopStream(stream);
  expect(stop).toHaveBeenCalledTimes(1);
});
it("permite só roleta sem solicitar câmera nem microfone", async () => {
  const getUserMedia = vi.fn();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  expect(await openMedia({ camera: false, mic: false })).toEqual({ ok: true, stream: null });
  expect(getUserMedia).not.toHaveBeenCalled();
});
it.each([
  ["NotAllowedError", "denied"], ["NotFoundError", "missing"], ["NotReadableError", "busy"],
])("trata a falha %s sem iniciar gravação", async (name, problem) => {
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn().mockRejectedValue(new DOMException("Falha simulada", name)) },
  });
  expect(await openMedia({ camera: true, mic: true })).toEqual({ ok: false, problem });
});
