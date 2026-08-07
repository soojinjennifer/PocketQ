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
  /** 새 제스처(포인터 다운)가 시작될 때 호출한다 — 항상 현재 `tool`로 새 Stroke를 만든다. */
  startStroke: (point: StrokePoint) => void;
  /** 진행 중인 제스처(포인터 무브)에서 호출한다 — 마지막 Stroke에 좌표를 이어붙인다. */
  addPoint: (point: StrokePoint) => void;
  undo: () => void;
  clear: () => void;
}

/**
 * `/solve/pencilcanvas`, `/solve/landscape` 필기 캔버스 상태 훅.
 *
 * "새 획 시작"과 "이어그리기"를 `startStroke`/`addPoint`로 명시적으로 분리한다(호출 시점은
 * `HandwritingCanvas`의 `pointerdown`/`pointermove`가 결정한다). 이전에는 "진행 중인 획이 있는지"를
 * ref로 추론해 하나의 `addPoint` 함수 안에서 분기했는데, 이 ref 뮤테이션이 `setState` 함수형
 * updater 내부에서 일어나 React Strict Mode의 updater 이중 호출(개발 모드에서 impure updater를
 * 잡아내기 위한 의도된 동작)과 충돌해 새 획이 이전 획(다른 tool)에 잘못 이어붙는 버그가 있었다.
 * `startStroke`/`addPoint` 모두 ref를 전혀 사용하지 않는 순수 함수형 updater이므로 이 문제 자체가
 * 구조적으로 발생할 수 없다.
 *
 * `undo`는 마지막 Stroke 1개만 pop하고, `clear`는 전체를 비운다.
 */
export function useDrawingStrokes(): UseDrawingStrokesResult {
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [tool, setTool] = useState<DrawingTool>("pen");

  const startStroke = useCallback(
    (point: StrokePoint) => {
      setStrokes((prev) => [...prev, { tool, points: [point] }]);
    },
    [tool],
  );

  const addPoint = useCallback((point: StrokePoint) => {
    setStrokes((prev) => {
      const lastStroke = prev[prev.length - 1];
      if (!lastStroke) {
        // startStroke 없이 addPoint가 먼저 호출된 경우(예: 방어적 상황) — 조용히 무시한다.
        return prev;
      }

      const updatedStroke: Stroke = {
        tool: lastStroke.tool,
        points: [...lastStroke.points, point],
      };
      return [...prev.slice(0, -1), updatedStroke];
    });
  }, []);

  const undo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const clear = useCallback(() => {
    setStrokes([]);
  }, []);

  return { strokes, tool, setTool, startStroke, addPoint, undo, clear };
}
