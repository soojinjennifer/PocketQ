import { useCallback, useState } from "react";

export type DrawingTool = "pen" | "eraser";

export interface StrokePoint {
  x: number;
  y: number;
  pressure: number;
}

/** 펜/지우개 모두 동일하게 Stroke로 기록한다 — 지우개 획도 undo/clear로 되돌릴 수 있어야 하기 때문. */
export interface Stroke {
  tool: DrawingTool;
  points: StrokePoint[];
}

interface UseDrawingStrokesResult {
  strokes: Stroke[];
  tool: DrawingTool;
  setTool: (tool: DrawingTool) => void;
  /**
   * 완성된 Stroke 하나를 통째로 배열에 append한다. 포인터 제스처 전체(pointerdown ~ pointerup/
   * pointercancel)를 `HandwritingCanvas`가 로컬 ref(`activeStrokeRef`)에 모았다가 제스처가 끝난
   * 시점에 정확히 1회만 호출한다 — 이전에는 `pointermove`마다(즉 포인트 단위로) `setStrokes`를
   * 호출해서 빠른 필기 중 React state 갱신 빈도가 과도하게 높아지고, 그 여파로 이 훅을 소비하는
   * `ProblemInputProvider`의 context value(`useMemo`)와 `HandwritingCanvas`의 리사이즈 감시
   * effect까지 매 포인트마다 재실행되어 iPad 9세대+Apple Pencil 1세대에서 입력 유실이 발생했다
   * (plan-agent 4단계 확정안). `commitStroke`로 바뀐 뒤에는 제스처당 정확히 1번만 state가
   * 갱신된다.
   */
  commitStroke: (stroke: Stroke) => void;
  undo: () => void;
  clear: () => void;
}

/**
 * `/solve/pencilcanvas`, `/solve/landscape` 필기 캔버스 상태 훅.
 *
 * 진행 중인 획(포인터 제스처)의 좌표 누적은 더 이상 이 훅이 담당하지 않는다 — `HandwritingCanvas`가
 * 로컬 ref로 누적하고, 제스처가 끝난 시점에 완성된 `Stroke`를 `commitStroke`로 한 번만 전달한다.
 * 이 훅은 "완성된 Stroke 목록"만 순수하게 관리하는 얇은 상태 저장소다.
 *
 * `undo`는 마지막 Stroke 1개만 pop하고, `clear`는 전체를 비운다.
 */
export function useDrawingStrokes(): UseDrawingStrokesResult {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<DrawingTool>("pen");

  const commitStroke = useCallback((stroke: Stroke) => {
    setStrokes((prev) => [...prev, stroke]);
  }, []);

  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStrokes([]);
  }, []);

  return { strokes, tool, setTool, commitStroke, undo, clear };
}
