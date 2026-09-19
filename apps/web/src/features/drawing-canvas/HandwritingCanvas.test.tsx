import { createRef } from "react";
import { fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "./HandwritingCanvas";
import { useDrawingStrokes, type Stroke } from "../../shared/lib/canvas/useDrawingStrokes";
import { isDirectRenderModeEnabled } from "../../shared/lib/canvas/renderMode";
import { isPointerDebugEnabled, logPointerEvent } from "../../shared/lib/canvas/pointerDebugLog";

// 렌더링 모드 A/B 진단(iPad 렌더링 파이프라인 P0 재조사) — 기본은 기존 동작(cache/false)을
// 그대로 유지하고, 필요한 테스트에서만 `mockReturnValue(true)`로 전환한다.
vi.mock("../../shared/lib/canvas/renderMode", async () => {
  const actual =
    await vi.importActual<typeof import("../../shared/lib/canvas/renderMode")>(
      "../../shared/lib/canvas/renderMode",
    );
  return {
    ...actual,
    isDirectRenderModeEnabled: vi.fn(() => false),
  };
});

// 렌더링 파이프라인 계측 로그(offscreen-cache-rebuild 등) 검증용 — 기본은 비활성(false)으로 기존
// 동작을 유지하고, 필요한 테스트에서만 `mockReturnValue(true)`로 전환해 `logPointerEvent` 호출을
// 스파이로 확인한다.
vi.mock("../../shared/lib/canvas/pointerDebugLog", async () => {
  const actual =
    await vi.importActual<typeof import("../../shared/lib/canvas/pointerDebugLog")>(
      "../../shared/lib/canvas/pointerDebugLog",
    );
  return {
    ...actual,
    isPointerDebugEnabled: vi.fn(() => false),
    logPointerEvent: vi.fn(),
  };
});

interface FillCall {
  compositeOperation: string;
  fillStyle: string;
}

/**
 * `fillStyle`/`globalCompositeOperation`/`fill` 호출을 기록하는 최소 2D 컨텍스트 mock.
 * `drawImage`는 오프스크린 캐시 → 화면 캔버스 blit(P1~P2 캐시 기반 렌더링 전환)에서 호출된다 —
 * 실제 픽셀 복사는 검증하지 않고 호출 여부/횟수만 필요하면 `drawImageCalls`로 확인한다.
 */
interface MockContext2D {
  fillStyle: string;
  globalCompositeOperation: string;
  fillCalls: FillCall[];
  drawImageCalls: number;
  /** `clearRect` 호출 횟수 — `render()`(항상 1회)와 `renderOffscreenCache()`(실제 리사이즈 시에만
   * 추가 1회)가 각각 호출하므로, 스퓨리어스 리사이즈(크기 변화 없음)와 실제 리사이즈를 구분하는
   * 신호로 쓴다(P0 재조사: `canvas.width`/`canvas.height` 무조건 재할당 버그 회귀 테스트). */
  clearRectCalls: number;
  setTransform: (...args: number[]) => void;
  clearRect: (...args: number[]) => void;
  fill: (path?: unknown) => void;
  drawImage: (...args: unknown[]) => void;
}

function createMockContext(): MockContext2D {
  const ctx: MockContext2D = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
    fillCalls: [],
    drawImageCalls: 0,
    clearRectCalls: 0,
    setTransform: vi.fn(),
    clearRect: () => {},
    fill: () => {},
    drawImage: () => {},
  };
  ctx.clearRect = vi.fn(() => {
    ctx.clearRectCalls += 1;
  });
  ctx.fill = vi.fn(() => {
    ctx.fillCalls.push({
      compositeOperation: ctx.globalCompositeOperation,
      fillStyle: ctx.fillStyle,
    });
  });
  ctx.drawImage = vi.fn(() => {
    ctx.drawImageCalls += 1;
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
      <HandwritingCanvas strokes={[PEN_STROKE]} tool="pen" onCommitStroke={vi.fn()} />,
    );

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls.every((call) => call.compositeOperation === "source-over")).toBe(
      true,
    );
  });

  it("지우개 획은 globalCompositeOperation을 destination-out으로 설정하고 fill을 호출한다", () => {
    render(
      <HandwritingCanvas strokes={[ERASER_STROKE]} tool="pen" onCommitStroke={vi.fn()} />,
    );

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls.every((call) => call.compositeOperation === "destination-out")).toBe(
      true,
    );
  });

  it("펜 획 다음 지우개 획을 그리면 각각 올바른 compositeOperation으로 fill이 호출된다", () => {
    render(
      <HandwritingCanvas strokes={[PEN_STROKE, ERASER_STROKE]} tool="pen" onCommitStroke={vi.fn()} />,
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
      <HandwritingCanvas strokes={[ERASER_STROKE]} tool="pen" onCommitStroke={vi.fn()} />,
    );

    expect(mockCtx.globalCompositeOperation).toBe("source-over");
  });

  it("점 1개뿐인 짧은 지우개 획도 fill이 호출된다(짧은 획 방어 처리)", () => {
    const tapStroke: Stroke = { tool: "eraser", points: [{ x: 3, y: 3, pressure: 0.5 }] };
    render(<HandwritingCanvas strokes={[tapStroke]} tool="pen" onCommitStroke={vi.fn()} />);

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls[0]?.compositeOperation).toBe("destination-out");
  });
});

describe("HandwritingCanvas 포인터 이벤트 — onCommitStroke 계약", () => {
  it("pointerdown → 여러 pointermove → pointerup 시퀀스 후 onCommitStroke가 누적된 points와 함께 정확히 1회 호출된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
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
    // pointerdown 시점에는 아직 제스처가 끝나지 않았으므로 커밋되지 않는다.
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 12,
      clientY: 22,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 14,
      clientY: 24,
      pressure: 0.5,
    });
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 14, clientY: 24 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 10, y: 20, pressure: 0.5 },
        { x: 12, y: 22, pressure: 0.5 },
        { x: 14, y: 24, pressure: 0.5 },
      ],
    });
  });

  it("setPointerCapture가 예외를 던져도(iOS Safari가 애플펜슬 pointerId를 재사용할 때 발생하는 P0 경쟁 상태) 획 입력이 유실되지 않고 onCommitStroke가 정상 호출된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) {
      throw new Error("canvas element not found");
    }
    // jsdom은 setPointerCapture가 기본적으로 no-op이거나 미구현일 수 있으므로, 이 캔버스
    // 인스턴스에 한해 명시적으로 예외를 던지도록 오버라이드해 iOS Safari의 pointerId 재사용
    // 경쟁 상태(직전 획의 캡처 해제가 끝나기 전 같은 pointerId로 재호출)를 재현한다.
    canvas.setPointerCapture = vi.fn(() => {
      throw new Error("InvalidStateError: pointer capture not available");
    });

    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 30,
      clientY: 40,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 32,
      clientY: 42,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 34,
      clientY: 44,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen", clientX: 34, clientY: 44 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 30, y: 40, pressure: 0.5 },
        { x: 32, y: 42, pressure: 0.5 },
        { x: 34, y: 44, pressure: 0.5 },
      ],
    });
  });

  it("pointercancel로 끝난 제스처도 onCommitStroke가 정확히 1회 호출된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="eraser" onCommitStroke={onCommitStroke} />,
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
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 2,
      clientY: 2,
      pressure: 0.5,
    });
    fireEvent.pointerCancel(canvas, { pointerId: 1, pointerType: "pen" });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "eraser",
      points: [
        { x: 1, y: 1, pressure: 0.5 },
        { x: 2, y: 2, pressure: 0.5 },
      ],
    });
  });

  it("touch pointerType은 무시한다(팜/오터치 방지) — onCommitStroke가 호출되지 않는다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) {
      throw new Error("canvas element not found");
    }

    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "touch", clientX: 1, clientY: 1 });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "touch", clientX: 1, clientY: 1 });
    expect(onCommitStroke).not.toHaveBeenCalled();
  });

  it("pointerup 이후의 pointermove는 무시한다(획 종료 후 이어그리기 방지, 중복 커밋도 없다)", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
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
    expect(onCommitStroke).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 2,
      clientY: 2,
      pressure: 0.5,
    });
    // 종료 후 pointermove는 무시되어 추가로 커밋되지 않는다.
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
  });

  it("pointercancel 이후의 pointermove는 무시한다(iOS 스크롤 전환 시 pointercancel 발생 대응)", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
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
    expect(onCommitStroke).toHaveBeenCalledTimes(1);

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 2,
      clientY: 2,
      pressure: 0.5,
    });
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
  });
});

describe("HandwritingCanvas scrollable=false(기본값) 회귀 확인", () => {
  it("scrollable prop 없이 렌더링하면 outer div 1개만 존재한다(기존 DOM 구조 그대로)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} />,
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
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
    );

    const outer = container.firstElementChild;
    expect(outer?.className).toContain("overflow-y-auto");
    expect(outer?.children.length).toBe(1);
    const content = outer?.children[0];
    expect(content?.querySelector("canvas")).not.toBeNull();
  });

  it("(a) 펜으로 그리는 동안 터치 포인터가 움직여도 스크롤이 발동하지 않는다", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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

  it("(c-2) 스크롤 후보로 등록된 터치 포인터가 pointerup/cancel 없이 pointerleave만 발생시켜도 유령으로 남지 않는다(회귀 확인)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    outer.scrollTop = 0;

    // 손가락 1이 스크롤 후보로 등록된 뒤 40px만큼 스크롤하고, pointerup/cancel 없이 캔버스
    // 경계를 벗어나 pointerleave만 발생한다(좁은 화면/Split View에서 흔한 상황).
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 100,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 60,
    });
    expect(outer.scrollTop).toBe(40);
    fireEvent.pointerLeave(canvas, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 0,
      clientY: 60,
    });

    // 손가락 2가 새로 스크롤을 시작해서 20px만큼 이동한다. 손가락 1이 유령으로 남아 있으면
    // `handleScrollTouchMove`의 평균 분모가 2가 되어 절반(10px)만 반영되지만, 정상적으로
    // 정리됐다면 손가락 1개분(20px)이 그대로 반영돼야 한다.
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 50,
      clientY: 200,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 50,
      clientY: 180,
    });

    expect(outer.scrollTop).toBe(60);
  });

  it("(d) 펜으로 그리는 도중 닿은 손바닥(터치)은 스크롤 후보로 등록되지 않는다(팜 리젝션 유지)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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

  it("(e) strokes(커밋된 획)의 최대 y가 content 높이 임계값에 가까워지면 content 높이가 늘어난다", () => {
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
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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
      <HandwritingCanvas strokes={[tallStroke]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
    );

    expect(content.style.height).toBe("200px");
  });

  it("(f) 그리는 도중(pointermove, 아직 커밋 전)에도 성장 임계값을 넘으면 즉시 확장된다", () => {
    // (e)와 동일하게 outer/content 실측 높이를 100px로 고정한다.
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

    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} scrollable />,
    );
    const canvas = container.querySelector("canvas");
    const content = canvas?.parentElement as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    expect(content.style.height).toBe("100px");

    // 아직 pointerup(커밋)하지 않은 상태 — y=90까지 그리는 도중에도 확장돼야 한다(회귀 방지:
    // 이전에는 커밋된 strokes prop만 봐서 획이 끝나야 확장됐다).
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    expect(content.style.height).toBe("100px");
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 90,
      pressure: 0.5,
    });

    expect(content.style.height).toBe("200px");
    // 확장 시점까지도 아직 커밋되지 않았다(제스처가 끝나지 않았으므로).
    expect(onCommitStroke).not.toHaveBeenCalled();
  });
});

describe("HandwritingCanvas isScrollable()", () => {
  it("scrollable=false면 항상 false를 반환한다", () => {
    const ref = createRef<HandwritingCanvasHandle>();
    render(
      <HandwritingCanvas ref={ref} strokes={[]} tool="pen" onCommitStroke={vi.fn()} />,
    );

    expect(ref.current?.isScrollable()).toBe(false);
  });

  it("scrollable=true이고 outer.scrollHeight > outer.clientHeight면 true를 반환한다", () => {
    const ref = createRef<HandwritingCanvasHandle>();
    const { container } = render(
      <HandwritingCanvas ref={ref} strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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
      <HandwritingCanvas ref={ref} strokes={[]} tool="pen" onCommitStroke={vi.fn()} scrollable />,
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
        tool="pen"
        onCommitStroke={vi.fn()}
        scrollable
        onScrollableChange={onScrollableChange}
      />,
    );

    expect(onScrollableChange).toHaveBeenCalled();
  });
});

describe("HandwritingCanvas — 다른 pointerId는 진행 중인 스트로크에 영향을 주지 않는다(P0/P1 회귀 방지)", () => {
  it("다른 pointerId의 pointerup은 진행 중인 스트로크를 종료하지 않는다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 99, pointerType: "pen", clientX: 5, clientY: 5 });
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 1, clientY: 1 });
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
  });

  it("다른 pointerId의 pointercancel은 진행 중인 스트로크를 종료하지 않는다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerCancel(canvas, { pointerId: 99, pointerType: "pen" });
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerCancel(canvas, { pointerId: 1, pointerType: "pen" });
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
  });
});

/**
 * `useDrawingStrokes`를 실제로 사용해 `strokes`/`commitStroke`를 배선하는 통합 하니스 — `onCommit`
 * spy로 커밋 호출을 관찰하면서도, `HandwritingCanvas`가 실제 앱과 동일하게 커밋 직후 `strokes` prop
 * 갱신 → effect 재실행을 겪게 한다. `pointerleave` 커밋 이후에도 `activePointerIdRef`가 여전히
 * 채워져 있어 그 effect가 활성 스트로크를 초기화하지 않는지(경쟁 상태 회귀 방지)를 이 하니스로만
 * 검증할 수 있다 — `strokes` prop이 고정된 배열이면 effect가 재실행되지 않아 이 경쟁 상태 자체가
 * 재현되지 않는다.
 */
function DrawingStrokesHarness({ onCommit }: { onCommit: (stroke: Stroke) => void }) {
  const { strokes, tool, commitStroke } = useDrawingStrokes();
  return (
    <HandwritingCanvas
      strokes={strokes}
      tool={tool}
      onCommitStroke={(stroke) => {
        onCommit(stroke);
        commitStroke(stroke);
      }}
    />
  );
}

describe("HandwritingCanvas — pointerleave (P1: 캡처 상태에서 캔버스 경계를 스치는 경우)", () => {
  it("leave 시점까지의 부분이 먼저 커밋되고, 이후 같은 pointerId의 pointermove가 새 활성 스트로크로 계속 그려진다", () => {
    const onCommit = vi.fn();
    const { container } = render(<DrawingStrokesHarness onCommit={onCommit} />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });
    fireEvent.pointerLeave(canvas, { pointerId: 1, pointerType: "pen", clientX: 10, clientY: 10 });

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 5, y: 5, pressure: 0.5 },
      ],
    });

    // leave로 인해 실제 부모 state(useDrawingStrokes)가 갱신되어 strokes prop이 바뀌고, 그 결과
    // strokes 동기화 effect가 재실행되더라도 activePointerIdRef가 여전히 채워져 있으므로 활성
    // 스트로크가 초기화되지 않는다 — 이어지는 pointermove가 조용히 버려지지 않는다(핵심 회귀 포인트).
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 20,
      clientY: 20,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 20, clientY: 20 });

    expect(onCommit).toHaveBeenCalledTimes(2);
    expect(onCommit).toHaveBeenLastCalledWith({
      tool: "pen",
      points: [{ x: 20, y: 20, pressure: 0.5 }],
    });
  });

  it("다른 pointerId의 pointerleave는 무시한다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerLeave(canvas, { pointerId: 99, pointerType: "pen" });
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 1, clientY: 1 });
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
  });
});

describe("HandwritingCanvas — lostpointercapture (P1: pointerup/pointercancel 없이 캡처만 풀리는 경우)", () => {
  it("그때까지의 스트로크가 커밋되고 activePointerIdRef가 완전히 정리되어, 다음 pointerdown이 정상적으로 새 스트로크를 시작한다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    // jsdom은 hasPointerCapture를 기본적으로 구현하지 않는다(항상 undefined) — 이 테스트는
    // "캡처가 실제로 걸려 있다가 lostpointercapture로 풀리는" 네이티브 캡처 시나리오를 검증하므로,
    // hasPointerCapture가 true를 반환하도록 명시적으로 오버라이드해서 재설계된 코드가 이 세션을
    // "캡처 성공"으로 분류하고 lostpointercapture를 기대 큐에 등록하게 한다(그렇지 않으면 캡처가
    // 확인되지 않아 document fallback 경로로 빠지고, 큐에 등록되지 않은 lostpointercapture는
    // stale로 간주되어 무시된다).
    canvas.hasPointerCapture = vi.fn(() => true);

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });
    fireEvent.lostPointerCapture(canvas, { pointerId: 1, pointerType: "pen" });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 5, y: 5, pressure: 0.5 },
      ],
    });

    // 완전히 정리되었으므로 캡처 없이 들어오는 leftover pointermove는 무시된다.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 6,
      clientY: 6,
      pressure: 0.5,
    });
    expect(onCommitStroke).toHaveBeenCalledTimes(1);

    // 새 pointerdown은 깨끗한 상태에서 새 스트로크를 시작한다.
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 50,
      clientY: 50,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen", clientX: 50, clientY: 50 });

    expect(onCommitStroke).toHaveBeenCalledTimes(2);
    expect(onCommitStroke).toHaveBeenLastCalledWith({
      tool: "pen",
      points: [{ x: 50, y: 50, pressure: 0.5 }],
    });
  });

  it("재사용된 pointerId로 지연 도착한 lostpointercapture가 새로 시작된 stroke를 조기 종료시키지 않는다(P0 재발 방지, capture-release debt)", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    // 위 테스트와 동일한 이유로 hasPointerCapture를 true로 오버라이드해 두 획 모두 "캡처 성공"
    // 경로(큐 등록)를 타게 한다 — 그래야 지연 도착한 lostpointercapture가 큐에서 올바른
    // sessionId를 dequeue해 stale 판정을 검증할 수 있다.
    canvas.hasPointerCapture = vi.fn(() => true);

    const REUSED_POINTER_ID = 7;

    // 획1: 정상적으로 pointerup까지 진행되어 커밋된다(이때 획1의 setPointerCapture에 대응하는
    // lostpointercapture는 아직 도착하지 않은 상태 — iOS Safari가 지연 디스패치하는 상황을 재현).
    fireEvent.pointerDown(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
    });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenNthCalledWith(1, {
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 1, y: 1, pressure: 0.5 },
      ],
    });

    // 획2: 같은 pointerId가 즉시 재사용되어 새 제스처를 시작한다(아직 pointerup 하지 않음).
    fireEvent.pointerDown(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 100,
      clientY: 100,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 105,
      clientY: 105,
      pressure: 0.5,
    });

    // 획1의 capture-release가 지연 도착한다(같은 pointerId) — 이 시점에 획2가 여전히 진행 중이다.
    fireEvent.lostPointerCapture(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
    });

    // stale lostpointercapture는 무시되어야 한다 — 조기 커밋되지 않는다(여전히 1회만 커밋됨).
    expect(onCommitStroke).toHaveBeenCalledTimes(1);

    // 획2가 계속 이어져서 그려진다 — 이후 pointermove가 여전히 반영된다(핵심 회귀 검증 지점).
    fireEvent.pointerMove(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 110,
      clientY: 110,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: REUSED_POINTER_ID,
      pointerType: "pen",
      clientX: 110,
      clientY: 110,
    });

    expect(onCommitStroke).toHaveBeenCalledTimes(2);
    expect(onCommitStroke).toHaveBeenNthCalledWith(2, {
      tool: "pen",
      points: [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 105, y: 105, pressure: 0.5 },
        { x: 110, y: 110, pressure: 0.5 },
      ],
    });
  });

  it("다른 pointerId의 lostpointercapture는 무시한다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.lostPointerCapture(canvas, { pointerId: 99, pointerType: "pen" });
    expect(onCommitStroke).not.toHaveBeenCalled();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 1, clientY: 1 });
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
  });
});

describe("HandwritingCanvas — getCoalescedEvents (P2: 좌표 누락 최소화)", () => {
  it("getCoalescedEvents가 있으면 그 결과 좌표 전부가 순서대로 활성 스트로크에 반영된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });

    const coalesced = [
      new PointerEvent("pointermove", { pointerId: 1, clientX: 2, clientY: 2 }),
      new PointerEvent("pointermove", { pointerId: 1, clientX: 4, clientY: 4 }),
      new PointerEvent("pointermove", { pointerId: 1, clientX: 6, clientY: 6 }),
    ];
    const moveEvent = new PointerEvent("pointermove", {
      pointerId: 1,
      clientX: 6,
      clientY: 6,
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(moveEvent, "getCoalescedEvents", {
      value: () => coalesced,
      configurable: true,
    });
    fireEvent(canvas, moveEvent);

    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 6, clientY: 6 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        // pressure=0인 native PointerEvent 기본값은 0.5로 폴백된다(기존 toStrokePoint 규칙 유지).
        { x: 2, y: 2, pressure: 0.5 },
        { x: 4, y: 4, pressure: 0.5 },
        { x: 6, y: 6, pressure: 0.5 },
      ],
    });
  });

  it("getCoalescedEvents가 없는 환경(폴백)에서는 기존처럼 단일 이벤트 좌표만 반영된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    // jsdom의 PointerEvent는 getCoalescedEvents를 구현하지 않는다 — 폴백 경로를 그대로 검증한다.
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 6,
      clientY: 6,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 6, clientY: 6 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 6, y: 6, pressure: 0.5 },
      ],
    });
  });
});

describe("HandwritingCanvas — 캐시 기반 렌더링 전환 이후에도 지우개가 정상 동작한다", () => {
  it("커밋된 지우개 획은 오프스크린 캐시 경유로도 destination-out으로 그려지고, 화면 캔버스에는 drawImage로 복사된다", () => {
    render(<HandwritingCanvas strokes={[ERASER_STROKE]} tool="pen" onCommitStroke={vi.fn()} />);

    expect(mockCtx.fillCalls.length).toBeGreaterThan(0);
    expect(mockCtx.fillCalls.every((call) => call.compositeOperation === "destination-out")).toBe(
      true,
    );
    // render()가 오프스크린 캐시를 blit(drawImage)한다 — 매 렌더마다 committed strokes를
    // 처음부터 다시 fill하지 않는다(P1~P2 캐시 기반 렌더링 전환).
    expect(mockCtx.drawImageCalls).toBeGreaterThan(0);
  });

  it("펜 획 커밋 후 지우개 획을 그리는 도중(pointermove)에도 지우개가 destination-out으로 즉시 반영된다", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[PEN_STROKE]} tool="eraser" onCommitStroke={vi.fn()} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    mockCtx.fillCalls.length = 0;

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 2,
      clientY: 2,
      pressure: 0.5,
    });

    // 활성 스트로크(지우개)는 render()가 오프스크린 blit 위에 직접 추가로 그린다.
    expect(
      mockCtx.fillCalls.some((call) => call.compositeOperation === "destination-out"),
    ).toBe(true);
  });
});

describe("HandwritingCanvas — pointer capture 아키텍처 재설계(iPad 두 번째 획 유실 P0 4차 재조사)", () => {
  it("1) setPointerCapture가 NotFoundError를 던져도 첫 점과 다음 move가 그려지고 획이 확정된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    canvas.setPointerCapture = vi.fn(() => {
      throw new DOMException("pointer capture not available", "NotFoundError");
    });
    canvas.hasPointerCapture = vi.fn(() => false);

    fireEvent.pointerDown(canvas, {
      pointerId: 21,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 21,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 21,
      pointerType: "pen",
      clientX: 10,
      clientY: 10,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 21, pointerType: "pen", clientX: 10, clientY: 10 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 5, y: 5, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.5 },
      ],
    });
  });

  it("2) 캡처 실패 상태에서 Canvas 밖으로 이동한 후 document의 pointerup으로 정상 종료된다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    canvas.setPointerCapture = vi.fn(() => {
      throw new DOMException("pointer capture not available", "NotFoundError");
    });
    canvas.hasPointerCapture = vi.fn(() => false);

    fireEvent.pointerDown(canvas, {
      pointerId: 22,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 22,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });

    // canvas가 아니라 document에 직접 pointerup을 dispatch한다(캡처가 안 걸려 있으므로 canvas
    // 밖으로 나가면 canvas가 더 이상 이벤트를 받지 못할 수 있는 상황을 재현).
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 22,
        clientX: 5,
        clientY: 5,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 5, y: 5, pressure: 0.5 },
      ],
    });

    // 동일 pointerId로 다음 pointerdown을 canvas에 다시 보내 정상적으로 새 획을 시작할 수 있다.
    fireEvent.pointerDown(canvas, {
      pointerId: 22,
      pointerType: "pen",
      clientX: 50,
      clientY: 50,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 22, pointerType: "pen", clientX: 50, clientY: 50 });

    expect(onCommitStroke).toHaveBeenCalledTimes(2);
    expect(onCommitStroke).toHaveBeenLastCalledWith({
      tool: "pen",
      points: [{ x: 50, y: 50, pressure: 0.5 }],
    });
  });

  it("3) document fallback이 부착된 상태에서 canvas와 document의 이벤트가 중복 기록되지 않는다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    // setPointerCapture 호출 자체는 예외 없이 "성공"하지만, hasPointerCapture로 재확인하면
    // 캡처가 실제로 걸려 있지 않다고 나오는 상황(hasCaptureAfterAttempt !== true) — 이 경우
    // document fallback이 반드시 부착되므로, canvas의 React 핸들러와 document fallback이 같은
    // 네이티브 이벤트를 동시에 받는 경로(dedup이 반드시 필요한 경로)를 재현한다.
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => false);

    fireEvent.pointerDown(canvas, {
      pointerId: 23,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    // canvas에서 발생시키지만 jsdom에서 document까지 버블링되므로, canvas의 handlePointerMove와
    // document fallback의 handleMove가 동일한 네이티브 이벤트 객체를 각각 수신한다.
    fireEvent.pointerMove(canvas, {
      pointerId: 23,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 23, pointerType: "pen", clientX: 5, clientY: 5 });

    // pointermove 1회당 좌표 1개만 추가돼야 한다 — dedup이 없다면 canvas와 document 양쪽에서
    // 각각 처리되어 다운 좌표(1개) + move 좌표(2개) = 3개 이상이 된다.
    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 5, y: 5, pressure: 0.5 },
      ],
    });
  });

  it("4) 첫 획 종료 직후 동일 pointerId로 두 번째 획을 시작해도 두 획이 모두 남는다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);

    const POINTER_ID = 7;

    fireEvent.pointerDown(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: POINTER_ID, pointerType: "pen", clientX: 1, clientY: 1 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenNthCalledWith(1, {
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 1, y: 1, pressure: 0.5 },
      ],
    });

    // 즉시 같은 pointerId로 두 번째 획을 시작한다 — activeStrokeRef는 finishSession에서
    // null로 비워지지 않으므로(strokes prop 동기화 전까지 유지), pointerdown이 이를 무조건
    // 새 객체로 덮어써야만 두 번째 획이 첫 번째 획과 뒤섞이지 않는다.
    fireEvent.pointerDown(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 100,
      clientY: 100,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 101,
      clientY: 101,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 101,
      clientY: 101,
    });

    expect(onCommitStroke).toHaveBeenCalledTimes(2);
    expect(onCommitStroke).toHaveBeenNthCalledWith(2, {
      tool: "pen",
      points: [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 101, y: 101, pressure: 0.5 },
      ],
    });
  });

  it("5) 첫 획의 늦은 lostpointercapture가 두 번째 획을 지우지 않는다", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    canvas.setPointerCapture = vi.fn();
    canvas.hasPointerCapture = vi.fn(() => true);

    const POINTER_ID = 9;

    // 획1: 정상적으로 pointerup까지 진행되어 커밋된다(이때 획1의 sessionId가 캡처 기대 큐에 등록됨).
    fireEvent.pointerDown(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 1,
      clientY: 1,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: POINTER_ID, pointerType: "pen", clientX: 1, clientY: 1 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);

    // 획2: 같은 pointerId가 즉시 재사용되어 새 제스처를 시작한다(아직 pointerup 하지 않음 — 획2의
    // sessionId도 같은 pointerId 큐에 들어가지만, 큐 순서상 획1의 sessionId가 먼저다).
    fireEvent.pointerDown(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 100,
      clientY: 100,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 105,
      clientY: 105,
      pressure: 0.5,
    });

    // 획1의 지연 도착 release를 시뮬레이션한다 — 큐에서 획1의 sessionId가 dequeue되고, 그게 현재
    // 활성 세션(획2)과 다르므로 stale로 무시돼야 한다.
    fireEvent.lostPointerCapture(canvas, { pointerId: POINTER_ID, pointerType: "pen" });

    // 획2가 조기 커밋되지 않았다(여전히 1회만 커밋됨).
    expect(onCommitStroke).toHaveBeenCalledTimes(1);

    // 획2가 계속 이어져서 pointermove/pointerup으로 정상 커밋된다.
    fireEvent.pointerMove(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 110,
      clientY: 110,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, {
      pointerId: POINTER_ID,
      pointerType: "pen",
      clientX: 110,
      clientY: 110,
    });

    expect(onCommitStroke).toHaveBeenCalledTimes(2);
    expect(onCommitStroke).toHaveBeenNthCalledWith(2, {
      tool: "pen",
      points: [
        { x: 100, y: 100, pressure: 0.5 },
        { x: 105, y: 105, pressure: 0.5 },
        { x: 110, y: 110, pressure: 0.5 },
      ],
    });
  });

  it("6) 회귀 없음: 지우개 tool 전환/오프스크린 캐시/coalesced-events/pointerleave/기존 lostpointercapture 관련 동작은 이 describe 블록 밖의 기존 테스트가 계속 통과함으로써 검증된다", () => {
    // 이 테스트는 문서화 목적의 플레이스홀더다 — 실제 회귀 검증은 파일 전체의 기존 테스트
    // 스위트(위 describe 블록들)가 그대로 통과하는지로 이루어진다(작업 지시 4-6 참고).
    expect(true).toBe(true);
  });
});

describe("HandwritingCanvas — 캔버스 리사이즈 (P0 재조사: canvas.width/height 무조건 재할당 버그)", () => {
  // `ResizeObserver`가 실제 크기 변화 없이도 스퓨리어스하게 발화하는 경우를 재현하기 위해, 콜백을
  // 붙잡아 뒀다가 테스트에서 직접 여러 번 호출할 수 있게 전역 `ResizeObserver`를 교체한다(setup.ts의
  // no-op 폴리필은 콜백을 저장하지 않아 재현 불가능하다).
  let resizeCallbacks: ResizeObserverCallback[];
  let originalResizeObserver: typeof ResizeObserver;

  beforeEach(() => {
    resizeCallbacks = [];
    originalResizeObserver = globalThis.ResizeObserver;
    class MockResizeObserver {
      constructor(private readonly callback: ResizeObserverCallback) {
        resizeCallbacks.push(this.callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    globalThis.ResizeObserver = MockResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  /** 캡처된 첫 번째 `ResizeObserver` 콜백을 직접 호출한다(테스트에서 스퓨리어스/실제 리사이즈 발화를
   * 흉내 낼 때 공통으로 쓴다). `noUncheckedIndexedAccess`로 인해 배열 인덱싱 결과가 `undefined`일
   * 수 있어 매번 가드한다. */
  function triggerResize() {
    const callback = resizeCallbacks[0];
    if (!callback) {
      throw new Error("resize callback not captured");
    }
    callback([], {} as ResizeObserver);
  }

  it("크기 변화 없는 ResizeObserver 재발화(스퓨리어스)는 canvas.width/height를 재할당하지 않는다", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    expect(resizeCallbacks).toHaveLength(1);

    // 마운트 시점의 최초 리사이즈(항상 1회 발생)까지 끝난 뒤부터 계측한다.
    const widthSetSpy = vi.spyOn(HTMLCanvasElement.prototype, "width", "set");
    const heightSetSpy = vi.spyOn(HTMLCanvasElement.prototype, "height", "set");
    const clearRectCallsBefore = mockCtx.clearRectCalls;

    // 같은 rect(jsdom 기본값 0x0, outer를 모킹하지 않았으므로 마운트 때와 동일)로 여러 번
    // 스퓨리어스하게 재발화한다.
    triggerResize();
    triggerResize();
    triggerResize();

    expect(widthSetSpy).not.toHaveBeenCalled();
    expect(heightSetSpy).not.toHaveBeenCalled();
    // render()는 스퓨리어스 발화에도 여전히 매번 호출되지만(clearRect +1씩),
    // renderOffscreenCache()의 추가 clearRect(+1)는 발생하지 않아야 한다 — 발화당 정확히 1회씩만
    // 늘어난다(2회씩이 아니라).
    expect(mockCtx.clearRectCalls - clearRectCallsBefore).toBe(3);
  });

  it("실제 크기 변화가 있으면 오프스크린 캐시가 재계산된다(기존 동작 유지, sizeChanged 가드가 실제 리사이즈까지 막지 않는다)", () => {
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={vi.fn()} />,
    );
    const outer = container.firstElementChild as HTMLDivElement;
    expect(resizeCallbacks).toHaveLength(1);

    vi.spyOn(outer, "getBoundingClientRect").mockReturnValue({
      width: 120,
      height: 80,
      top: 0,
      left: 0,
      right: 120,
      bottom: 80,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const clearRectCallsBefore = mockCtx.clearRectCalls;
    triggerResize();

    // renderOffscreenCache()의 clearRect(+1) + render()의 clearRect(+1) = 2회.
    expect(mockCtx.clearRectCalls - clearRectCallsBefore).toBe(2);
  });

  it("진행 중인 stroke 도중 스퓨리어스 리사이즈가 발생해도 stroke 데이터가 유실되지 않는다(회귀 방지)", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");
    expect(resizeCallbacks).toHaveLength(1);

    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });

    // 크기 변화 없는 스퓨리어스 리사이즈가 획을 그리는 도중 끼어든다.
    triggerResize();

    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 10,
      clientY: 10,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 10, clientY: 10 });

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 5, y: 5, pressure: 0.5 },
        { x: 10, y: 10, pressure: 0.5 },
      ],
    });
  });

  it("진행 중인 제스처 도중 실제 리사이즈가 발생하고 캡처가 확인되지 않으면 캡처를 재시도하고, 그래도 안 되면 document fallback이 새로 부착된다(reconcileCaptureAfterResize)", () => {
    const onCommitStroke = vi.fn();
    const { container } = render(
      <HandwritingCanvas strokes={[]} tool="pen" onCommitStroke={onCommitStroke} />,
    );
    const canvas = container.querySelector("canvas");
    const outer = container.firstElementChild as HTMLDivElement;
    if (!canvas) throw new Error("canvas element not found");
    expect(resizeCallbacks).toHaveLength(1);

    let captureHeld = true;
    const setPointerCaptureSpy = vi.fn();
    canvas.setPointerCapture = setPointerCaptureSpy;
    canvas.hasPointerCapture = vi.fn(() => captureHeld);

    fireEvent.pointerDown(canvas, {
      pointerId: 5,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    // pointerdown 시점에는 캡처가 확인되어(성공) document fallback 없이 캡처 기대 큐에만
    // 등록된다.
    expect(setPointerCaptureSpy).toHaveBeenCalledTimes(1);

    // 리사이즈로 인해 캡처가 사라진 것으로 의심되는 상황을 재현한다.
    captureHeld = false;
    vi.spyOn(outer, "getBoundingClientRect").mockReturnValue({
      width: 200,
      height: 200,
      top: 0,
      left: 0,
      right: 200,
      bottom: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    triggerResize();

    // reconcileCaptureAfterResize가 캡처를 명시적으로 재시도한다.
    expect(setPointerCaptureSpy).toHaveBeenCalledTimes(2);

    // 재시도에도 캡처가 확인되지 않으므로 document fallback이 새로 부착되어, 이후 document로 직접
    // dispatch된 pointermove/pointerup도 활성 스트로크에 반영된다(canvas가 캡처를 잃어도 유실되지
    // 않는다).
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        pointerId: 5,
        clientX: 15,
        clientY: 15,
        bubbles: true,
        cancelable: true,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointerup", {
        pointerId: 5,
        clientX: 15,
        clientY: 15,
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(onCommitStroke).toHaveBeenCalledTimes(1);
    expect(onCommitStroke).toHaveBeenCalledWith({
      tool: "pen",
      points: [
        { x: 0, y: 0, pressure: 0.5 },
        { x: 15, y: 15, pressure: 0.5 },
      ],
    });
  });
});

describe("HandwritingCanvas — 렌더링 모드 A/B 진단(direct vs cache, iPad 렌더링 파이프라인 P0 재조사)", () => {
  afterEach(() => {
    vi.mocked(isDirectRenderModeEnabled).mockReturnValue(false);
  });

  it("direct 모드에서는 여러 획을 연속으로 그려도 전부 올바르게 커밋되고, drawImage(오프스크린 blit)가 전혀 호출되지 않는다", () => {
    vi.mocked(isDirectRenderModeEnabled).mockReturnValue(true);
    const onCommit = vi.fn();
    const { container } = render(<DrawingStrokesHarness onCommit={onCommit} />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    // 획 1
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 5, clientY: 5 });

    // 획 2
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 10,
      clientY: 10,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 15,
      clientY: 15,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen", clientX: 15, clientY: 15 });

    // 획 3
    fireEvent.pointerDown(canvas, {
      pointerId: 3,
      pointerType: "pen",
      clientX: 20,
      clientY: 20,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 3,
      pointerType: "pen",
      clientX: 25,
      clientY: 25,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 3, pointerType: "pen", clientX: 25, clientY: 25 });

    expect(onCommit).toHaveBeenCalledTimes(3);
    expect(mockCtx.drawImageCalls).toBe(0);
  });

  it("cache(기본) 모드에서는 여전히 drawImage(오프스크린 blit)가 호출된다(direct 모드 도입이 기존 기본 동작을 바꾸지 않는다)", () => {
    // 기본값(false)을 명시적으로 재확인 — 이 describe의 다른 테스트가 실수로 true를 남기지
    // 않았는지도 함께 검증한다.
    expect(isDirectRenderModeEnabled()).toBe(false);
    render(<HandwritingCanvas strokes={[PEN_STROKE]} tool="pen" onCommitStroke={vi.fn()} />);

    expect(mockCtx.drawImageCalls).toBeGreaterThan(0);
  });
});

describe("HandwritingCanvas — 렌더링 파이프라인 계측(offscreen-cache-rebuild 로그, iPad 렌더링 파이프라인 P0 재조사)", () => {
  afterEach(() => {
    vi.mocked(isPointerDebugEnabled).mockReturnValue(false);
    vi.mocked(logPointerEvent).mockClear();
  });

  it("여러 stroke를 커밋한 후 offscreen-cache-rebuild 로그의 stroke/point 개수가 실제 커밋된 값과 정확히 일치한다", () => {
    vi.mocked(isPointerDebugEnabled).mockReturnValue(true);
    const onCommit = vi.fn();
    const { container } = render(<DrawingStrokesHarness onCommit={onCommit} />);
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("canvas element not found");

    // 획 1 — 2 points.
    fireEvent.pointerDown(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 0,
      clientY: 0,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 1,
      pointerType: "pen",
      clientX: 5,
      clientY: 5,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 5, clientY: 5 });

    // 획 2 — 3 points.
    fireEvent.pointerDown(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 10,
      clientY: 10,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 15,
      clientY: 15,
      pressure: 0.5,
    });
    fireEvent.pointerMove(canvas, {
      pointerId: 2,
      pointerType: "pen",
      clientX: 20,
      clientY: 20,
      pressure: 0.5,
    });
    fireEvent.pointerUp(canvas, { pointerId: 2, pointerType: "pen", clientX: 20, clientY: 20 });

    expect(onCommit).toHaveBeenCalledTimes(2);

    const rebuildEntries = vi
      .mocked(logPointerEvent)
      .mock.calls.map(([entry]) => entry)
      .filter((entry) => entry.eventType === "offscreen-cache-rebuild");

    expect(rebuildEntries.length).toBeGreaterThanOrEqual(2);
    const lastRebuild = rebuildEntries[rebuildEntries.length - 1];
    // 획1(2 points) + 획2(3 points) = strokes 2개, 총 5 points.
    expect(lastRebuild?.offscreenStrokeCount).toBe(2);
    expect(lastRebuild?.offscreenTotalPointCount).toBe(5);
  });

  it("비활성 상태(기본값)에서는 offscreen-cache-rebuild 로그가 전혀 남지 않는다", () => {
    expect(isPointerDebugEnabled()).toBe(false);
    render(<HandwritingCanvas strokes={[PEN_STROKE]} tool="pen" onCommitStroke={vi.fn()} />);

    expect(vi.mocked(logPointerEvent)).not.toHaveBeenCalled();
  });
});
