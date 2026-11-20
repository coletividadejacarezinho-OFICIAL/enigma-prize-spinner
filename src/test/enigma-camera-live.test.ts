// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  cancelRecording,
  setRecFrame,
  setRecMotion,
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
  spinning: false,
  address: "Rua de Teste, 123",
  phone: "(43) 99999-0000",
  winner: null,
  summary: null,
};

const arc = vi.fn();
const drawImage = vi.fn();
const fillText = vi.fn();
const translate = vi.fn();
const scale = vi.fn();
const canvasContext = new Proxy(
  {
    arc,
    drawImage,
    fillText,
    translate,
    scale,
    measureText: (text: string) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
  },
  { get: (target, key) => Reflect.get(target, key) ?? (() => {}) },
);
const capturedTrack = { stop: vi.fn() };
const capture = vi.fn(function (this: HTMLCanvasElement) {
  return { addTrack: vi.fn(), getVideoTracks: () => [capturedTrack] };
});
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
  arc.mockClear();
  capture.mockClear();
  capturedTrack.stop.mockClear();
  drawImage.mockClear();
  fillText.mockClear();
  translate.mockClear();
  scale.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    canvasContext as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", {
    configurable: true,
    value: capture,
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
  previewHost: host,
  mic: false,
  sound: false,
  volume: 0,
});

it("records the visible canvas with sponsor contacts, the same spin motion and the camera at left", async () => {
  const { stream, track } = source();
  expect(startRecording({ ...options(), mode: "roleta-camera", stream })).toBe(true);
  const canvas = host.querySelector("canvas")!;
  expect(capture.mock.contexts[0]).toBe(canvas);
  expect(canvas.width / canvas.height).toBe(9 / 16);
  const text = fillText.mock.calls.map(([line]) => line).join(" ");
  expect(text).toContain(frame.address);
  expect(text).toContain(frame.phone);
  const video = host.querySelector("video")!;
  expect(video.srcObject).toBe(stream);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  Object.defineProperties(video, { videoWidth: { value: 480 }, videoHeight: { value: 640 } });

  vi.advanceTimersByTime(40);
  const initialCrop = drawImage.mock.lastCall;
  expect(initialCrop).toEqual([video, 0, 80, 480, 480, -111, -111, 222, 222]);
  expect(translate.mock.lastCall).toEqual([145, 1120]);

  setRecFrame({ ...frame, countdown: { step: 3, startedAt: performance.now() } });
  vi.advanceTimersByTime(40);
  expect(fillText).toHaveBeenCalledWith("3", 0, 0, 126);
  expect(drawImage.mock.lastCall).toEqual(initialCrop);

  setRecFrame({ ...frame, spinning: true });
  setRecMotion({ rotation: 270, progress: 0.9, zoom: 1.5 });
  vi.advanceTimersByTime(900);
  expect(scale).toHaveBeenCalledWith(1.5, 1.5);
  expect(arc).toHaveBeenCalledWith(360, 660, 300, Math.PI, Math.PI * 2);
  expect(drawImage.mock.lastCall).toEqual(initialCrop);
  expect(translate.mock.lastCall).toEqual([145, 1120]);

  const winner = "Maria Clara dos Santos de Almeida Pereira Rodrigues da Conceição Ferreira";
  setRecMotion({ rotation: 270, progress: 1, zoom: 1.5 });
  setRecFrame({ ...frame, winner, rotation: 270 });
  fillText.mockClear();
  arc.mockClear();
  vi.advanceTimersByTime(40);
  expect(host.querySelector("video")).toBe(video);
  expect(drawImage.mock.lastCall).toEqual(initialCrop);
  expect(translate.mock.lastCall).toEqual([145, 1120]);
  expect(arc).toHaveBeenCalledWith(360, 660, 300, Math.PI, Math.PI * 2);
  const nameLines = fillText.mock.calls.filter(([, x, y]) => x === 483 && y > 1050);
  expect(nameLines.map(([line]) => line).join(" ")).toBe(winner);
  expect(nameLines.every(([, x, , width]) => x - width / 2 > 145 + 111)).toBe(true);

  await stopRecording();
  expect(capturedTrack.stop).toHaveBeenCalledOnce();
  expect(host.childElementCount).toBe(0);
  expect(video.srcObject).toBeNull();
  expect(track.stop).toHaveBeenCalledOnce();
});

it("cleans the camera and the canvas, then shows only the canvas in wheel-only mode", () => {
  const { stream, track } = source();
  expect(startRecording({ ...options(), mode: "roleta-camera", stream })).toBe(true);
  cancelRecording();
  expect(host.childElementCount).toBe(0);
  expect(track.stop).toHaveBeenCalledOnce();
  expect(startRecording({ ...options(), mode: "roleta-voz", stream: null })).toBe(true);
  expect(host.childElementCount).toBe(1);
  expect(capture.mock.contexts[1]).toBe(host.querySelector("canvas"));
  expect(host.querySelector("video")).toBeNull();
});

it("uses the active courtesy's logo and replaces its address when the round changes", () => {
  vi.stubGlobal("Image", class {
    crossOrigin = "";
    src = "";
    naturalWidth = 200;
    naturalHeight = 100;
    get nodeName() {
      return "IMG";
    }
  });
  expect(startRecording({
    ...options(),
    frame: { ...frame, roundLabel: "Prêmio 1 de 2", merchantLogo: "data:image/png;base64,logo" },
    mode: "roleta-voz",
    stream: null,
  })).toBe(true);
  const [image, x, y, w, h] = drawImage.mock.lastCall!;
  expect(image.src).toBe("data:image/png;base64,logo");
  expect([x, y, w, h]).toEqual([55, 194, 100, 50]);

  setRecFrame({
    ...frame,
    roundLabel: "Prêmio 2 de 2",
    merchant: "Segundo comércio",
    address: "Avenida Nova, 80",
    phone: undefined,
  });
  fillText.mockClear();
  drawImage.mockClear();
  vi.advanceTimersByTime(40);
  const text = fillText.mock.calls.map(([line]) => line).join(" ");
  expect(text).toContain("Segundo comércio");
  expect(text).toContain("Avenida Nova, 80");
  expect(text).not.toContain(frame.address);
  expect(text).not.toContain(frame.phone);
  expect(drawImage).not.toHaveBeenCalled();
});
