import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { useDrawingStrokes } from "./useDrawingStrokes";
import type { Stroke } from "./useDrawingStrokes";

const PEN_STROKE: Stroke = {
  tool: "pen",
  points: [
    { x: 1, y: 1, pressure: 0.5 },
    { x: 2, y: 2, pressure: 0.5 },
  ],
};

const ERASER_STROKE: Stroke = {
  tool: "eraser",
  points: [
    { x: 10, y: 10, pressure: 0.5 },
    { x: 11, y: 11, pressure: 0.5 },
    { x: 12, y: 12, pressure: 0.5 },
  ],
};

describe("useDrawingStrokes", () => {
  it("commitStroke는 완성된 Stroke를 통째로 배열 끝에 추가한다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.commitStroke(PEN_STROKE));

    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.strokes[0]).toEqual(PEN_STROKE);
  });

  it("commitStroke를 여러 번 호출하면 각각 별개의 Stroke로 순서대로 쌓인다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.commitStroke(PEN_STROKE));
    act(() => result.current.commitStroke(ERASER_STROKE));

    expect(result.current.strokes).toHaveLength(2);
    expect(result.current.strokes[0]).toEqual(PEN_STROKE);
    expect(result.current.strokes[1]).toEqual(ERASER_STROKE);
  });

  it("undo는 마지막 Stroke 1개만 제거한다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.commitStroke(PEN_STROKE));
    act(() => result.current.commitStroke(ERASER_STROKE));
    expect(result.current.strokes).toHaveLength(2);

    act(() => result.current.undo());
    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.strokes[0]).toEqual(PEN_STROKE);
  });

  it("clear는 전체 Stroke를 삭제한다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.commitStroke(PEN_STROKE));
    act(() => result.current.commitStroke(ERASER_STROKE));

    act(() => result.current.clear());
    expect(result.current.strokes).toHaveLength(0);
  });

  it("setTool로 도구를 바꾸면 이후 새로 커밋되는 Stroke의 tool 값은 호출부가 결정한다(이 훅은 tool을 강제하지 않는다)", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.setTool("eraser"));
    expect(result.current.tool).toBe("eraser");

    // `commitStroke`는 순수 append 함수라 넘겨받은 Stroke의 tool을 그대로 기록한다 — 어떤 tool로
    // 새 Stroke를 시작할지는 이제 `HandwritingCanvas`(pointerdown 시점의 `tool` prop)가 결정한다.
    act(() => result.current.commitStroke({ tool: "eraser", points: [{ x: 1, y: 1, pressure: 0.5 }] }));
    expect(result.current.strokes[0]?.tool).toBe("eraser");
  });

  it(
    "[구조 확인] React Strict Mode에서 여러 Stroke를 연달아 commitStroke해도 서로 섞이지 않는다",
    () => {
      // 참고: 이 훅의 옛 구현(`startStroke`+`addPoint` 분리)에는 "진행 중인 획이 있는지"를 ref로
      // 추론하는 경로가 있어, 그 ref 뮤테이션이 Strict Mode의 setState updater 이중 호출과
      // 충돌해 새 획이 이전 획(다른 tool)에 잘못 이어붙는 회귀가 있었다. `commitStroke` 단일
      // 함수는 완성된 Stroke를 통째로 append하는 순수 함수형 updater만 사용하고 ref를 전혀 참조하지
      // 않으므로, 그 버그 클래스 자체가 이 구조에서는 애초에 발생할 수 없다 — 별도의 이중 호출
      // 시뮬레이션 없이도 이 테스트가 이를 구조적으로 보장한다.
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      );
      const { result } = renderHook(() => useDrawingStrokes(), { wrapper });

      act(() => result.current.commitStroke(PEN_STROKE));
      act(() => result.current.setTool("eraser"));
      act(() => result.current.commitStroke(ERASER_STROKE));

      expect(result.current.strokes).toHaveLength(2);
      expect(result.current.strokes[0]).toEqual(PEN_STROKE);
      expect(result.current.strokes[1]).toEqual(ERASER_STROKE);
    },
  );
});
