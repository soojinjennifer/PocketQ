import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { exportStrokesToPngBlob } from "./exportStrokesToPngBlob";
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

beforeEach(() => {
  mockCtx = createMockContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => mockCtx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(["fake-png"], { type: "image/png" }));
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

describe("exportStrokesToPngBlob", () => {
  it("획이 하나도 없으면 null을 반환한다", async () => {
    const result = await exportStrokesToPngBlob([]);
    expect(result).toBeNull();
  });

  it("불투명 흰 배경을 채운 뒤 잉크 레이어를 합성해서 PNG Blob을 반환한다", async () => {
    const result = await exportStrokesToPngBlob([PEN_STROKE]);

    expect(mockCtx.fillStyle).toBe("#ffffff");
    expect(mockCtx.fillRectCalls.length).toBeGreaterThan(0);
    expect(mockCtx.drawImageCalls.length).toBeGreaterThan(0);
    expect(result).not.toBeNull();
    expect(result?.type).toBe("image/png");
  });

  it("펜 획은 source-over로 잉크 레이어에 그려진다", async () => {
    await exportStrokesToPngBlob([PEN_STROKE]);

    expect(mockCtx.fill).toHaveBeenCalled();
  });
});
