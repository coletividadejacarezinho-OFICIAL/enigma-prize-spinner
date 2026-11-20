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
const publishFrame = vi.fn();
const stampLabels = vi.fn();
const writeLabel = vi.fn();
const fillText = vi.fn();
const translate = vi.fn();
const scale = vi.fn();
const rotate = vi.fn();
const rect = vi.fn();
const canvasContext = new Proxy(
  {
    arc,
    drawImage: (source: CanvasImageSource, ...args: number[]) =>
      (source instanceof HTMLCanvasElement ? stampLabels : drawImage)(source, ...args),
    fillText,
    translate,
    scale,
    rotate,
    rect,
    measureText: (text: string) => ({ width: text.length * 10 }),
    createLinearGradient: () => ({ addColorStop: vi.fn() }),
    createRadialGradient: () => ({ addColorStop: vi.fn() }),
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
  drawImage.mockReset();
  publishFrame.mockClear();
  stampLabels.mockClear();
  writeLabel.mockClear();
  fillText.mockClear();
  translate.mockClear();
  scale.mockClear();
  rotate.mockClear();
  rect.mockClear();
  host = document.createElement("div");
  document.body.appendChild(host);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(function (
    this: HTMLCanvasElement,
    _type: string,
    settings?: CanvasRenderingContext2DSettings,
  ) {
    if (this.width === 1200) {
      return new Proxy({ fillText: writeLabel }, {
        get: (target, key) => Reflect.get(target, key) ?? (() => {}),
      }) as unknown as CanvasRenderingContext2D;
    }
    if (settings?.willReadFrequently) {
      Object.assign(canvasContext, { canvas: this });
      return canvasContext as unknown as CanvasRenderingContext2D;
    }
    return { drawImage: publishFrame } as unknown as CanvasRenderingContext2D;
  });
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
  expect(fillText).toHaveBeenCalledWith("Sorteio prestes a começar", 483, 1110, 370);
  expect(fillText).toHaveBeenCalledWith(frame.phone, 656, 266);
  const video = host.querySelector("video")!;
  expect(video.srcObject).toBe(stream);
  expect(video.muted).toBe(true);
  expect(video.playsInline).toBe(true);
  Object.defineProperties(video, {
    videoWidth: { value: 480 },
    videoHeight: { value: 640 },
    readyState: { value: HTMLMediaElement.HAVE_CURRENT_DATA },
  });

  vi.advanceTimersByTime(40);
  const initialCrop = drawImage.mock.lastCall;
  expect(initialCrop).toEqual([video, 0, 80, 480, 480, -111, -111, 222, 222]);
  expect(translate.mock.lastCall).toEqual([145, 1120]);

  setRecFrame({ ...frame, countdown: { step: 3, startedAt: performance.now() } });
  vi.advanceTimersByTime(40);
  expect(fillText).toHaveBeenCalledWith("3", 0, 0, 126);
  expect(drawImage.mock.lastCall).toEqual(initialCrop);
  expect(publishFrame).toHaveBeenLastCalledWith(expect.any(HTMLCanvasElement), 0, 0);
  expect(publishFrame.mock.lastCall?.[0]).not.toBe(canvas);
  expect(host.querySelectorAll("canvas")).toHaveLength(1);

  setRecFrame({ ...frame, spinning: true, winnerIndex: 0 });
  setRecMotion({ rotation: 270, progress: 0.9, zoom: 1.5, pointerTilt: -3 });
  vi.advanceTimersByTime(900);
  expect(scale).toHaveBeenCalledWith(1.5, 1.5);
  expect(rotate.mock.lastCall?.[0]).toBeCloseTo(-Math.PI / 60);
  expect(fillText).toHaveBeenCalledWith("Girando…", 483, 1110, 370);
  expect(arc).not.toHaveBeenCalledWith(360, 660, 291, Math.PI, Math.PI * 2);
  expect(arc).toHaveBeenCalledWith(360, 660, 300, Math.PI, Math.PI * 2);
  expect(drawImage.mock.lastCall).toEqual(initialCrop);
  expect(translate.mock.lastCall).toEqual([145, 1120]);

  const winner = "Maria Clara dos Santos de Almeida Pereira Rodrigues da Conceição Ferreira";
  setRecMotion({ rotation: 270, progress: 1, zoom: 1.5, pointerTilt: 0 });
  fillText.mockClear();
  vi.advanceTimersByTime(40);
  expect(fillText).toHaveBeenCalledWith("Resultado", 483, 1110, 370);
  expect(fillText).not.toHaveBeenCalledWith("Girando…", 483, 1110, 370);
  expect(arc).toHaveBeenCalledWith(360, 660, 291, Math.PI, Math.PI * 2);
  setRecFrame({
    ...frame,
    winner,
    winnerNumber: 21,
    winnerIndex: 0,
    rotation: 270,
    celebrationAt: performance.now() - 200,
  });
  fillText.mockClear();
  arc.mockClear();
  vi.advanceTimersByTime(33);
  expect(host.querySelector("video")).toBe(video);
  expect(drawImage.mock.lastCall).toEqual(initialCrop);
  expect(translate.mock.lastCall).toEqual([145, 1120]);
  expect(arc).toHaveBeenCalledWith(360, 660, 300, Math.PI, Math.PI * 2);
  expect(fillText).toHaveBeenCalledWith("Nº 21", expect.any(Number), 1050);
  const nameLines = fillText.mock.calls.filter(([, x, y]) => x === 483 && y > 1050);
  expect(nameLines.map(([line]) => line).join(" ")).toBe(winner);
  expect(nameLines.every(([, x, , width]) => x - width / 2 > 145 + 111)).toBe(true);
  expect(rect).toHaveBeenCalledWith(44, 344, 632, 632);
  vi.advanceTimersByTime(1400);
  rect.mockClear();
  vi.advanceTimersByTime(33);
  expect(rect).not.toHaveBeenCalledWith(44, 344, 632, 632);

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

it.each([
  [200, 100],
  [200, 200],
  [100, 200],
])("fits a %i×%i logo and replaces its address when the round changes", (width, height) => {
  vi.stubGlobal("Image", class {
    crossOrigin = "";
    src = "";
    naturalWidth = width;
    naturalHeight = height;
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
  expect(w / h).toBeCloseTo(width / height);
  expect(x).toBeGreaterThanOrEqual(55);
  expect(x + w).toBeLessThanOrEqual(153);
  expect(y).toBeGreaterThanOrEqual(151);
  expect(y + h).toBeLessThanOrEqual(230);

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
  expect(text).toContain("Próxima cortesia");
  expect(text).toContain("Prêmio 2 de 2");
  expect(text).toContain("Segundo comércio");
  expect(text).toContain("Avenida Nova, 80");
  expect(text).not.toContain(frame.address);
  expect(text).not.toContain(frame.phone);
  expect(drawImage).not.toHaveBeenCalled();
});

it("keeps a long prize and address inside their areas and shows the full phone", () => {
  const prize = "Vale compras na Padaria Central com entrega em Jacarezinho e um bolo para a família toda";
  const address = "Rua Paraná, 778, Centro, Jacarezinho, Paraná";
  expect(startRecording({
    ...options(),
    frame: { ...frame, address, prize },
    mode: "roleta-voz",
    stream: null,
  })).toBe(true);

  const prizeLines = fillText.mock.calls.filter(([, , y]) => y >= 191 && y <= 236);
  const addressLines = fillText.mock.calls.filter(([, x, y]) => x === 50 && y >= 269 && y <= 288);
  expect(prizeLines.map(([line]) => line).join(" ")).toBe(prize);
  expect(addressLines).toHaveLength(2);
  expect(addressLines.map(([line]) => line).join(" ")).toBe(address);
  expect(fillText).toHaveBeenCalledWith(frame.phone, 656, 277);
});

it("shows the full list of winners in readable pages, with their public numbers", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({
    merchant: `Comércio ${i + 1}`,
    prize: `Cortesia ${i + 1}`,
    winner: `Pessoa ${i + 1}`,
    number: i + 15,
  }));
  const end = { ...frame, winner: "Pessoa 8", winnerNumber: 22 };

  expect(startRecording({ ...options(), frame: end, mode: "roleta-voz", stream: null })).toBe(true);
  setRecFrame({ ...end, summary: rows });
  fillText.mockClear();
  vi.advanceTimersByTime(33);
  expect(fillText).toHaveBeenCalledWith("Resumo do sorteio", 360, 169);
  expect(fillText).toHaveBeenCalledWith("Prêmio 1 · Nº 15", 55, 237);
  expect(fillText).toHaveBeenCalledWith("Página 1 de 2", 360, 203);
  expect(fillText).not.toHaveBeenCalledWith("Prêmio 8 · Nº 22", expect.any(Number), expect.any(Number));
  expect(fillText).toHaveBeenCalledWith("8 cortesias sorteadas", 360, 1155, 616);

  vi.advanceTimersByTime(5500);
  fillText.mockClear();
  vi.advanceTimersByTime(33);
  expect(fillText).toHaveBeenCalledWith("Página 2 de 2", 360, 203);
  expect(fillText).toHaveBeenCalledWith("Prêmio 8 · Nº 22", expect.any(Number), expect.any(Number));
  expect(fillText).not.toHaveBeenCalledWith("Prêmio 1 · Nº 15", expect.any(Number), expect.any(Number));
});

it("keeps rendering the countdown and result if the camera loses a frame", () => {
  const { stream } = source();
  expect(startRecording({ ...options(), mode: "roleta-camera", stream })).toBe(true);
  const video = host.querySelector("video")!;
  Object.defineProperties(video, {
    videoWidth: { value: 480 },
    videoHeight: { value: 640 },
    readyState: { value: HTMLMediaElement.HAVE_CURRENT_DATA },
  });
  drawImage.mockImplementationOnce(() => { throw new DOMException("No frame", "InvalidStateError"); });
  setRecFrame({ ...frame, countdown: { step: 2, startedAt: performance.now() } });
  fillText.mockClear();
  publishFrame.mockClear();
  vi.advanceTimersByTime(33);
  expect(fillText).toHaveBeenCalledWith("2", 0, 0, 126);
  expect(fillText).toHaveBeenCalledWith("Câmera sem imagem", 145, 1120, 194);
  expect(publishFrame).toHaveBeenCalledOnce();

  setRecFrame({ ...frame, winner: "Ana", winnerNumber: 1 });
  fillText.mockClear();
  vi.advanceTimersByTime(33);
  expect(fillText).toHaveBeenCalledWith("Nº 1", expect.any(Number), 1050);
  expect(fillText).toHaveBeenCalledWith("Ana", 483, 1145, 370);
  expect(fillText).not.toHaveBeenCalledWith("Câmera sem imagem", expect.any(Number), expect.any(Number), expect.any(Number));
  expect(publishFrame).toHaveBeenCalledTimes(2);
});

it("keeps the last complete frame if a drawing operation throws and retries on the next frame", () => {
  expect(startRecording({ ...options(), mode: "roleta-voz", stream: null })).toBe(true);
  publishFrame.mockClear();
  fillText.mockImplementationOnce(() => { throw new Error("Drawing failed"); });
  vi.advanceTimersByTime(33);
  expect(publishFrame).not.toHaveBeenCalled();
  vi.advanceTimersByTime(33);
  expect(publishFrame).toHaveBeenCalledOnce();
});

it("reuses rasterized names through rotation and zoom, then rebuilds them for a new list", () => {
  const names = Array.from({ length: 51 }, (_, i) => `Participante ${i + 1}`);
  expect(startRecording({
    ...options(),
    frame: { ...frame, names },
    mode: "roleta-voz",
    stream: null,
  })).toBe(true);
  expect(writeLabel).toHaveBeenCalledTimes(51);
  const initialLayer = stampLabels.mock.lastCall?.[0];
  expect(initialLayer).toBeInstanceOf(HTMLCanvasElement);

  setRecFrame({ ...frame, names: [...names], spinning: true });
  setRecMotion({ rotation: 270, progress: 1, zoom: 1.9, pointerTilt: 0 });
  vi.advanceTimersByTime(100);
  expect(stampLabels).toHaveBeenLastCalledWith(initialLayer, -300, -300, 600, 600);
  expect(writeLabel).toHaveBeenCalledTimes(51);
  expect(fillText).toHaveBeenCalledWith("Participante 13", 360, 845, 556);

  setRecFrame({ ...frame, names: names.slice(1), roundLabel: "Prêmio 2 de 11" });
  writeLabel.mockClear();
  vi.advanceTimersByTime(33);
  expect(writeLabel).toHaveBeenCalledTimes(50);
  expect(writeLabel).not.toHaveBeenCalledWith("Participante 1", expect.any(Number), 0);
  expect(stampLabels.mock.lastCall?.[0]).not.toBe(initialLayer);
});
