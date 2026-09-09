import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "./HandwritingCanvas";
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

  it("pointercancel 이후의 pointermove는 무시한다(iOS 스크롤 전환 시 pointercancel 발생 대응)", () => {
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
    fireEvent.pointerCancel(canvas, { pointerId: 1, pointerType: "pen" });

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

describe("HandwritingCanvas scrollable=false(기본값) 회귀 확인", () => {
  it("scrollable prop 없이 렌더링하면 outer div 1개만 존재한다(기존 DOM 구조 그대로)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} />,
    );

    // 기존 구조: <div class="absolute inset-0 z-0"><canvas/></div> — content 래퍼가 없다.
    const outer = container.firstElementChild;
    expect(outer?.className).toBe("absolute inset-0 z-0");
    expect(outer?.children.length).toBe(1);
    expect(outer?.children[0]?.tagName).toBe("CANVAS");
  });
});

describe("HandwritingCanvas scrollable=true 손가락 스크롤", () => {
  it("scrollable=true여도 outer div 바로 아래에 content 래퍼와 canvas가 추가된다", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );

    const outer = container.firstElementChild;
    expect(outer?.className).toContain("overflow-y-auto");
    expect(outer?.children.length).toBe(1);
    const content = outer?.children[0];
    expect(content?.querySelector("canvas")).not.toBeNull();
  });

  it("(a) 펜으로 그리는 동안 터치 포인터가 움직여도 스크롤이 발동하지 않는다", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    outer.scrollTop = 0;

    // 펜이 먼저 그리기 시작한다(activePointerIdRef가 채워진다).
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });

    // 이어서 터치(예: 손바닥)가 닿아 움직인다.
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 0,
      clientY: 100,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 0,
      clientY: 50,
    });

    expect(outer.scrollTop).toBe(0);
  });

  it("(b) 펜이 그리지 않는 상태에서 터치 포인터 1개의 pointermove로 scrollTop이 바뀐다", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    outer.scrollTop = 0;

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 100,
    });
    // 손가락이 위로 40px 이동(clientY 감소) → 콘텐츠를 아래로 스크롤(scrollTop 증가)한다.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 60,
    });

    expect(outer.scrollTop).toBe(40);
  });

  it("(c) 터치 포인터 2개가 동시에 같은 속도로 움직여도 스크롤 속도가 2배가 되지 않는다(평균 적용)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    outer.scrollTop = 0;

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 100,
    });
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 50,
      clientY: 200,
    });

    // 두 손가락 모두 위로 20px씩 이동(clientY -20)한다.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 80,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 50,
      clientY: 180,
    });

    // 손가락 1개가 20px 이동했을 때와 동일한 총량만큼만 스크롤돼야 한다(더한 값 40이 아니라 20).
    expect(outer.scrollTop).toBe(20);
  });

  it("(d) 펜으로 그리는 도중 닿은 손바닥(터치)은 스크롤 후보로 등록되지 않는다(팜 리젝션 유지)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    outer.scrollTop = 0;

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 0,
      clientY: 100,
    });
    // 펜을 뗀 뒤에 손바닥(터치)이 움직여도, 펜이 그리는 도중 등록되지 않았던 터치이므로 여전히
    // 스크롤 후보가 아니다.
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 0, clientY: 0 });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 0,
      clientY: 30,
    });

    expect(outer.scrollTop).toBe(0);
  });

  it("(d-2) 손바닥(터치)이 펜보다 먼저 닿아 스크롤 후보로 등록된 뒤 펜이 그리기 시작하면, 이후 그 손바닥이 움직여도 스크롤이 발동하지 않는다(등록 순서 역전 케이스)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    outer.scrollTop = 0;

    // 손바닥(터치)이 펜보다 먼저 닿는다 — 이 시점엔 아직 그리는 중이 아니므로 스크롤 후보로
    // 등록된다(handlePointerDown 게이팅 조건 그대로).
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 0,
      clientY: 100,
    });
    // 곧이어 펜이 닿아 그리기 시작한다.
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    // 이미 등록된 손바닥 터치가 그리는 도중 움직인다.
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 0,
      clientY: 50,
    });

    expect(outer.scrollTop).toBe(0);
  });

  it("(e) workStrokes의 최대 y가 content 높이 임계값에 가까워지면 content 높이가 늘어난다", () => {
    // outer/content 실측 높이를 100px로 고정한다(jsdom은 기본적으로 getBoundingClientRect가
    // 전부 0을 반환하므로, 성장 임계값 로직을 검증하려면 실측값을 모킹해야 한다).
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 300,
      height: 100,
      top: 0,
      left: 0,
      right: 300,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const { container, rerender } = render(
      <HandwritingCanvas strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} scrollable />,
    );
    const content = container.querySelector("canvas")?.parentElement as HTMLDivElement;
    expect(content.style.height).toBe("100px");

    // 최대 y=90 → 초기 content 높이 100px의 85% 임계값(85px)을 넘는다 → 100px만큼 확장돼야 한다.
    const tallStroke: Stroke = {
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 0, y: 90, pressure: 0.5 },
      ],
    };
    rerender(
      <HandwritingCanvas
        strokes={[tallStroke]}
        onStartStroke={vi.fn()}
        onAddPoint={vi.fn()}
        scrollable
      />,
    );

    expect(content.style.height).toBe("200px");
  });
});

describe("HandwritingCanvas isScrollable()", () => {
  it("scrollable=false면 항상 false를 반환한다", () => {
    const ref = createRef<HandwritingCanvasHandle>();
    render(
      <HandwritingCanvas ref={ref} strokes={[]} onStartStroke={vi.fn()} onAddPoint={vi.fn()} />,
    );

    expect(ref.current?.isScrollable()).toBe(false);
  });

  it("scrollable=true이고 outer.scrollHeight > outer.clientHeight면 true를 반환한다", () => {
    const ref = createRef<HandwritingCanvasHandle>();
    const { container } = render(
      <HandwritingCanvas
        ref={ref}
        strokes={[]}
        onStartStroke={vi.fn()}
        onAddPoint={vi.fn()}
        scrollable
      />,
    );
    const outer = container.firstElementChild as HTMLDivElement;

    // jsdom은 scrollHeight/clientHeight를 항상 0으로 보고하므로 실측값을 흉내 내도록 주입한다.
    Object.defineProperty(outer, "scrollHeight", { value: 400, configurable: true });
    Object.defineProperty(outer, "clientHeight", { value: 100, configurable: true });

    expect(ref.current?.isScrollable()).toBe(true);
  });

  it("scrollable=true여도 outer.scrollHeight === outer.clientHeight면 false를 반환한다(스크롤 불필요)", () => {
    const ref = createRef<HandwritingCanvasHandle>();
    const { container } = render(
      <HandwritingCanvas
        ref={ref}
        strokes={[]}
        onStartStroke={vi.fn()}
        onAddPoint={vi.fn()}
        scrollable
      />,
    );
    const outer = container.firstElementChild as HTMLDivElement;

    Object.defineProperty(outer, "scrollHeight", { value: 100, configurable: true });
    Object.defineProperty(outer, "clientHeight", { value: 100, configurable: true });

    expect(ref.current?.isScrollable()).toBe(false);
  });

  it("onScrollableChange는 scrollable=true일 때 콘텐츠 높이가 바뀌면 호출된다", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 300,
      height: 100,
      top: 0,
      left: 0,
      right: 300,
      bottom: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const onScrollableChange = vi.fn();
    render(
      <HandwritingCanvas
        strokes={[]}
        onStartStroke={vi.fn()}
        onAddPoint={vi.fn()}
        scrollable
        onScrollableChange={onScrollableChange}
      />,
    );

    expect(onScrollableChange).toHaveBeenCalled();
  });
});
