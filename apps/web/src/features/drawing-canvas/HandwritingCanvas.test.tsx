import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingCanvas } from "./HandwritingCanvas";
import type { Stroke } from "../../shared/lib/canvas/useDrawingStrokes";

interface FillCall {
  compositeOperation: string;
  fillStyle: string;
}

/** `fillStyle`/`globalCompositeOperation`/`fill` 호출을 기록하는 최소 2D 컨텍스트 mock. */
interface MockContext2D {
  fillStyle: string;
  globalCompositeOperation: string;
  fillCalls: FillCall[];
  setTransform: (...args: number[]) => void;
  clearRect: (...args: number[]) => void;
  fill: (path?: unknown) => void;
}

function createMockContext(): MockContext2D {
  const ctx: MockContext2D = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
    fillCalls: [],
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fill: () => {},
  };
  ctx.fill = vi.fn(() => {
    ctx.fillCalls.push({
      compositeOperation: ctx.globalCompositeOperation,
      fillStyle: ctx.fillStyle,
    });
  });
  return ctx;
}

let mockCtx: MockContext2D;

beforeEach(() => {
  mockCtx = createMockContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => mockCtx as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const PEN_STROKE: Stroke = {
  tool: "pen",
  points: [
    { x: 0, y: 0, pressure: 0.5 },
    { x: 5, y: 5, pressure: 0.5 },
  ],
};

const ERASER_STROKE: Stroke = {
  tool: "eraser",
  points: [
    { x: 10, y: 10, pressure: 0.5 },
    { x: 15, y: 15, pressure: 0.5 },
  ],
};

describe("HandwritingCanvas 렌더링(mock 2D 컨텍스트)", () => {
  it("펜 획은 globalCompositeOperation을 source-over로 설정하고 fill을 호출한다", () => {
    render(
      <HandwritingCanvas strokes={[PEN_STROKE]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} />,
    );

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls.every((call) => call.compositeOperation === "source-over")).toBe(
      true,
    );
  });

  it("지우개 획은 globalCompositeOperation을 destination-out으로 설정하고 fill을 호출한다", () => {
    render(
      <HandwritingCanvas strokes={[ERASER_STROKE]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} />,
    );

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls.every((call) => call.compositeOperation === "destination-out")).toBe(
      true,
    );
  });

  it("펜 획 다음 지우개 획을 그리면 각각 올바른 compositeOperation으로 fill이 호출된다", () => {
    render(
      <HandwritingCanvas
        strokes={[PEN_STROKE, ERASER_STROKE]}
        onStartStroke={vi.fn()}
        onAddPoint={vi.fn()}
      />,
    );

    // 여러 렌더 패스(초기 마운트 + resize)가 있을 수 있으므로 최소 1회 이상 각 조합이
    // 정확한 compositeOperation으로 기록됐는지만 검증한다.
    expect(mockCtx.fillCalls.some((call) => call.compositeOperation === "source-over")).toBe(
      true,
    );
    expect(mockCtx.fillCalls.some((call) => call.compositeOperation === "destination-out")).toBe(
      true,
    );
  });

  it("렌더링 이후 globalCompositeOperation을 항상 source-over로 되돌린다(다음 프레임 오염 방지)", () => {
    render(
      <HandwritingCanvas strokes={[ERASER_STROKE]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} />,
    );

    expect(mockCtx.globalCompositeOperation).toBe("source-over");
  });

  it("점 1개뿐인 짧은 지우개 획도 fill이 호출된다(짧은 획 방어 처리)", () => {
    const tapStroke: Stroke = { tool: "eraser", points: [{ x: 3, y: 3, pressure: 0.5 }] };
    render(<HandwritingCanvas strokes={[tapStroke]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} />);

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls[0]?.compositeOperation).toBe("destination-out");
  });
});

describe("HandwritingCanvas 포인터 이벤트", () => {
  it("pointerdown은 onStartStroke를, 이어지는 pointermove는 onAddPoint를 호출한다", () => {
    const onStartStroke = vi.fn();
    const onAddPoint = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={onStartStroke} onAddPoint={onAddPoint} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) {
      throw new Error("canvas element not found");
    }

    // pressure는 float32로 정확히 표현 가능한 값(0.5)을 사용해 jsdom PointerEvent의
    // float32 저장으로 인한 반올림 오차 없이 정확히 비교한다.
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 10,
      clientY: 20,
      pressure: 0.5,
    });
    expect(onStartStroke).toHaveBeenCalledTimes(1);
    expect(onStartStroke).toHaveBeenCalledWith({ x: 10, y: 20, pressure: 0.5 });
    expect(onAddPoint).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 12,
      clientY: 22,
      pressure: 0.5,
    });
    expect(onAddPoint).toHaveBeenCalledTimes(1);
    expect(onAddPoint).toHaveBeenCalledWith({ x: 12, y: 22, pressure: 0.5 });
  });

  it("touch pointerType은 무시한다(팜/오터치 방지)", () => {
    const onStartStroke = vi.fn();
    const onAddPoint = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={onStartStroke} onAddPoint={onAddPoint} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) {
      throw new Error("canvas element not found");
    }

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "touch", clientX: 1, clientY: 1 });
    expect(onStartStroke).not.toHaveBeenCalled();
  });

  it("pointerup 이후의 pointermove는 무시한다(획 종료 후 이어그리기 방지)", () => {
    const onStartStroke = vi.fn();
    const onAddPoint = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={onStartStroke} onAddPoint={onAddPoint} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) {
      throw new Error("canvas element not found");
    }

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 1, clientY: 1 });

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 2,
      clientY: 2,
      pressure: 0.5,
    });
    expect(onAddPoint).not.toHaveBeenCalled();
  });
});
