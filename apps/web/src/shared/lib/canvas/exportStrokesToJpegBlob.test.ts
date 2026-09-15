import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportStrokesToJpegBlob } from "./exportStrokesToJpegBlob";
import type { Stroke } from "./useDrawingStrokes";

interface MockContext2D {
  fillStyle: string;
  globalCompositeOperation: string;
  fillRectCalls: number[][];
  drawImageCalls: unknown[][];
  fillRect: (...args: number[]) => void;
  fill: (path?: unknown) => void;
  drawImage: (...args: unknown[]) => void;
  translate: (...args: number[]) => void;
}

interface ToBlobCall {
  type: string | undefined;
  quality: number | undefined;
  canvasWidth: number;
  canvasHeight: number;
}

function createMockContext(): MockContext2D {
  const ctx: MockContext2D = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
    fillRectCalls: [],
    drawImageCalls: [],
    fillRect: (...args: number[]) => ctx.fillRectCalls.push(args),
    fill: vi.fn(),
    drawImage: (...args: unknown[]) => ctx.drawImageCalls.push(args),
    translate: vi.fn(),
  };
  return ctx;
}

let mockCtx: MockContext2D;
let toBlobCalls: ToBlobCall[];

beforeEach(() => {
  mockCtx = createMockContext();
  toBlobCalls = [];
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => mockCtx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(
    this: HTMLCanvasElement,
    callback: BlobCallback,
    type?: string,
    quality?: number,
  ) {
    toBlobCalls.push({ type, quality, canvasWidth: this.width, canvasHeight: this.height });
    callback(new Blob(["fake-jpeg"], { type: type ?? "image/jpeg" }));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PEN_STROKE: Stroke = {
  tool: "pen",
  points: [
    { x: 10, y: 10, pressure: 0.5 },
    { x: 40, y: 40, pressure: 0.5 },
  ],
};

/** bounding box(가로) + 24px * 2 패딩이 1600px를 훌쩍 넘도록 만든 획. */
const WIDE_STROKE: Stroke = {
  tool: "pen",
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 2000, y: 40, pressure: 0.5 },
  ],
};

describe("exportStrokesToJpegBlob", () => {
  it("획이 하나도 없으면 null을 반환한다", async () => {
    const result = await exportStrokesToJpegBlob([]);
    expect(result).toBeNull();
  });

  it("불투명 흰 배경을 채운 뒤 잉크 레이어를 합성해서 JPEG Blob을 반환한다", async () => {
    const result = await exportStrokesToJpegBlob([PEN_STROKE]);

    expect(mockCtx.fillStyle).toBe("#ffffff");
    expect(mockCtx.fillRectCalls.length).toBeGreaterThan(0);
    expect(mockCtx.drawImageCalls.length).toBeGreaterThan(0);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("image/jpeg");
  });

  it("펜 획은 source-over로 잉크 레이어에 그려진다", async () => {
    await exportStrokesToJpegBlob([PEN_STROKE]);

    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it("image/jpeg 포맷과 0.85 품질로 인코딩한다", async () => {
    await exportStrokesToJpegBlob([PEN_STROKE]);

    expect(toBlobCalls).toHaveLength(1);
    expect(toBlobCalls[0]!.type).toBe("image/jpeg");
    expect(toBlobCalls[0]!.quality).toBe(0.85);
  });

  it("긴 변이 1600px 이하이면 원본 크기 그대로 인코딩한다(불필요한 확대 금지)", async () => {
    // bounding box: 30x30 + 패딩(24*2) = 78x78, 1600px 이하.
    await exportStrokesToJpegBlob([PEN_STROKE]);

    expect(toBlobCalls).toHaveLength(1);
    expect(toBlobCalls[0]!.canvasWidth).toBe(78);
    expect(toBlobCalls[0]!.canvasHeight).toBe(78);
  });

  it("긴 변이 1600px를 초과하면 비율을 유지한 채 1600px로 축소한다", async () => {
    // bounding box: 2000x40 + 패딩(24*2) = 2048x88 → 긴 변 2048px, 1600/2048 비율로 축소.
    await exportStrokesToJpegBlob([WIDE_STROKE]);

    expect(toBlobCalls).toHaveLength(1);
    const { canvasWidth, canvasHeight } = toBlobCalls[0]!;
    expect(canvasWidth).toBe(1600);
    expect(canvasHeight).toBe(Math.round(88 * (1600 / 2048)));
    expect(Math.max(canvasWidth, canvasHeight)).toBeLessThanOrEqual(1600);

    // 원본(2048x88) 캔버스에서 축소된 캔버스로 한 번 더 drawImage가 일어난다(리사이즈 단계).
    expect(mockCtx.drawImageCalls.length).toBeGreaterThanOrEqual(2);
  });
});
