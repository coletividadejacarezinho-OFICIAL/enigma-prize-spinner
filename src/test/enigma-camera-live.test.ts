// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cancelRecording,
  setRecFrame,
  startRecording,
  stopRecording,
  type RecFrame,
} from "@/lib/enigma/recorder";

const frame: RecFrame = {
  group: "Coletividade",
  date: "19/11/2026",
  roundLabel: "",
  prize: "Cortesia de teste",
  merchant: "Comércio de teste",
  names: ["Ana", "Bia"],
  rotation: 0,
  spin: null,
  winner: null,
  summary: null,
};

const drawImage = vi.fn();
const canvasContext = new Proxy(
  {
    drawImage,
    measureText: (text: string) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  },
  { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
);
const originalCapture = Object.getOwnPropertyDescriptor(
  HTMLCanvasElement.prototype,
  "captureStream",
);
let host: HTMLDivElement;
const source = () => {
  const track = { stop: vi.fn() };
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { track, stream };
};

beforeEach(() => {
  vi.useFakeTimers();
  drawImage.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    canvasContext as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: () => ({ addTrack: vi.fn() }),
  });
  vi.stubGlobal(
    "MediaRecorder",
    class {
      static isTypeSupported() {
        return true;
      }
      onstop: (() => void) | null = null;
      start() {}
      requestData() {}
      stop() {
        this.onstop?.();
      }
    },
  );
});

afterEach(() => {
  cancelRecording();
  host.remove();
  if (originalCapture)
    Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", originalCapture);
  else Reflect.deleteProperty(HTMLCanvasElement.prototype, "captureStream");
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const options = () => ({
  drawId: "teste",
  frame,
  cameraHost: host,
  mic: false,
  sound: false,
  volume: 0,
});

it("uses the visible camera video in the recording, through the spin and the result", async () => {
  const { stream, track } = source();
  expect(startRecording({ ...options(), mode: "roleta-camera", stream })).toBe(true);
  const video = host.querySelector("video")!;
  expect(video.srcObject).toBe(stream);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  Object.defineProperties(video, { videoWidth: { value: 480 }, videoHeight: { value: 640 } });

  setRecFrame({
    ...frame,
    spin: { from: 0, to: 360, startedAt: performance.now(), durationMs: 1000, zoom: true },
  });
  vi.advanceTimersByTime(40);
  expect(drawImage.mock.lastCall?.[0]).toBe(video);
  setRecFrame({ ...frame, winner: "Ana" });
  vi.advanceTimersByTime(40);
  expect(host.querySelector("video")).toBe(video);
  expect(drawImage.mock.lastCall?.[0]).toBe(video);

  await stopRecording();
  expect(host.childElementCount).toBe(0);
  expect(video.srcObject).toBeNull();
  expect(track.stop).toHaveBeenCalledOnce();
});

it("cleans the camera on cancellation and leaves the preview empty in wheel-only mode", () => {
  const { stream, track } = source();
  expect(startRecording({ ...options(), mode: "roleta-camera", stream })).toBe(true);
  cancelRecording();
  expect(host.childElementCount).toBe(0);
  expect(track.stop).toHaveBeenCalledOnce();
  expect(startRecording({ ...options(), mode: "roleta-voz", stream: null })).toBe(true);
  expect(host.childElementCount).toBe(0);
});
