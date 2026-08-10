import { act, renderHook } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it } from "vitest";
import { useDrawingStrokes } from "./useDrawingStrokes";

const POINT = { x: 1, y: 1, pressure: 0.5 };

describe("useDrawingStrokes", () => {
  it("startStroke는 새 Stroke를 시작하고 이어지는 addPoint는 같은 Stroke에 좌표를 추가한다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.startStroke(POINT));
    act(() => result.current.addPoint({ x: 2, y: 2, pressure: 0.5 }));

    expect(result.current.strokes).toHaveLength(1);
    expect(result.current.strokes[0]?.points).toHaveLength(2);
  });

  it("startStroke를 다시 호출하면 이전 Stroke와 별개로 새 Stroke가 시작된다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.startStroke(POINT));
    act(() => result.current.startStroke(POINT));

    expect(result.current.strokes).toHaveLength(2);
  });

  it("undo는 마지막 Stroke 1개만 제거한다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.startStroke(POINT));
    act(() => result.current.startStroke(POINT));
    expect(result.current.strokes).toHaveLength(2);

    act(() => result.current.undo());
    expect(result.current.strokes).toHaveLength(1);
  });

  it("clear는 전체 Stroke를 삭제한다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.startStroke(POINT));
    act(() => result.current.startStroke(POINT));

    act(() => result.current.clear());
    expect(result.current.strokes).toHaveLength(0);
  });

  it("setTool로 도구를 바꾸면 이후 새 Stroke는 바뀐 도구로 기록된다", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.setTool("eraser"));
    act(() => result.current.startStroke(POINT));

    expect(result.current.tool).toBe("eraser");
    expect(result.current.strokes[0]?.tool).toBe("eraser");
  });

  it("addPoint만 호출되고 startStroke가 없었으면 아무 Stroke도 생기지 않는다(방어)", () => {
    const { result } = renderHook(() => useDrawingStrokes());

    act(() => result.current.addPoint(POINT));

    expect(result.current.strokes).toHaveLength(0);
  });

  it(
    "[회귀] React Strict Mode에서 펜 획을 그은 뒤 지우개로 전환해서 새 획을 그으면 " +
      "이전 펜 획에 이어붙지 않고 tool: eraser인 새 Stroke로 정확히 기록된다",
    () => {
      // Strict Mode는 개발 모드에서 setState 함수형 updater를 의도적으로 2번 호출해
      // impure updater를 잡아낸다. 과거 구현은 "진행 중인 획이 있는지"를 ref 뮤테이션으로
      // 추론했는데, 이 뮤테이션이 updater 내부에서 일어나 이중 호출과 충돌하면서 새 획(지우개)이
      // 이전 획(펜)에 잘못 이어붙는 버그가 있었다. startStroke/addPoint 분리로 이 문제 자체가
      // 발생할 수 없음을 검증한다.
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <StrictMode>{children}</StrictMode>
      );
      const { result } = renderHook(() => useDrawingStrokes(), { wrapper });

      act(() => result.current.startStroke({ x: 1, y: 1, pressure: 0.5 }));
      act(() => result.current.addPoint({ x: 2, y: 2, pressure: 0.5 }));

      act(() => result.current.setTool("eraser"));

      act(() => result.current.startStroke({ x: 10, y: 10, pressure: 0.5 }));
      act(() => result.current.addPoint({ x: 11, y: 11, pressure: 0.5 }));
      act(() => result.current.addPoint({ x: 12, y: 12, pressure: 0.5 }));

      expect(result.current.strokes).toHaveLength(2);
      expect(result.current.strokes[0]).toMatchObject({
        tool: "pen",
        points: [
          { x: 1, y: 1, pressure: 0.5 },
          { x: 2, y: 2, pressure: 0.5 },
        ],
      });
      expect(result.current.strokes[1]).toMatchObject({
        tool: "eraser",
        points: [
          { x: 10, y: 10, pressure: 0.5 },
          { x: 11, y: 11, pressure: 0.5 },
          { x: 12, y: 12, pressure: 0.5 },
        ],
      });
    },
  );
});
