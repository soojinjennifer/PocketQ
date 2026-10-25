import { useEffect, useRef, useState, type RefObject } from "react";
import type { FigureSpec } from "shared-types";
import type { ResolvedFigure } from "validation";
import type { FigureTextClasses } from "./applySceneToBoard";
import { buildBoardScene } from "./buildBoardScene";
import { readFigurePalette } from "./figureStyle";
import { loadJsxGraph } from "./jsxgraphAdapter";
import { mountFigureBoard, sceneOptionsFor, type LiveFigureBoard } from "./mountFigureBoard";
import type { FigureStepState } from "./resolveStepState";
import type { FigureViewport } from "./viewport";

export type FigureBoardStatus = "loading" | "ready" | "error";

/**
 * 요소 폭을 우리 ResizeObserver 하나로 추적한다(프레임당 최대 1회 갱신). 첫 측정도 rAF로 비동기.
 * 폭 0(display:none, 세로 회전 가드 뒤 등)이면 0을 돌려준다 → 보드를 만들지 않고 기다린다.
 *
 * `minWidth`(Stage 4 §17.9): 측정 폭이 이보다 작으면 값을 바꾸지 않는다 — 이미 받은 폭이 있으면 직전 폭을 유지하고
 * (보드 재생성·리사이즈 0), 아직 없으면 0 그대로라 보드를 만들지 않는다. 기본 0이면 기존 동작과 같다.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>, minWidth = 0): number {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    let frame: number | null = null;
    const measure = (): void => {
      frame = null;
      const measured = Math.max(0, Math.floor(element.clientWidth));
      if (minWidth > 0 && measured < minWidth) return;
      setWidth(measured);
    };
    const schedule = (): void => {
      if (frame === null) frame = requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    schedule();
    return () => {
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [ref, minWidth]);
  return width;
}

interface UseJsxGraphBoardParams {
  containerRef: RefObject<HTMLDivElement | null>;
  spec: FigureSpec;
  resolved: ResolvedFigure;
  viewport: FigureViewport | null;
  stepState: FigureStepState;
  classes: FigureTextClasses;
}

/**
 * 보드 수명주기.
 * - 폭이 처음 0보다 커지면 JSXGraph를 지연 로딩해 보드를 만든다. 로딩 중 언마운트되면 만들지 않는다.
 * - StrictMode의 effect 이중 실행에서도 첫 실행은 로딩 완료 전에 취소되므로 살아 있는 보드는 1개뿐이다.
 * - 폭이 바뀌면 보드를 다시 만들지 않고 `resize`, 단계가 바뀌면 `applyStepState`만 한다.
 * - 언마운트 시 `freeBoard`.
 * - 리사이즈·단계 적용 중 예외는 effect에서 던져 도형 단위 ErrorBoundary가 대체 표시로 바꾼다.
 */
export function useJsxGraphBoard({
  containerRef,
  spec,
  resolved,
  viewport,
  stepState,
  classes,
}: UseJsxGraphBoardParams): FigureBoardStatus {
  const [status, setStatus] = useState<FigureBoardStatus>("loading");
  const liveRef = useRef<LiveFigureBoard | null>(null);
  const latestRef = useRef({ viewport, stepState });

  useEffect(() => {
    latestRef.current = { viewport, stepState };
  });

  const hasViewport = viewport !== null;

  useEffect(() => {
    const container = containerRef.current;
    if (!hasViewport || container === null) return;
    let cancelled = false;
    let live: LiveFigureBoard | null = null;

    loadJsxGraph()
      .then((api) => {
        if (cancelled) return;
        const current = latestRef.current;
        if (current.viewport === null) return;
        const palette = readFigurePalette(container);
        if (palette === null) throw new Error("도형 색 토큰을 읽지 못했습니다.");
        const scene = buildBoardScene(spec, resolved, sceneOptionsFor(current.viewport));
        live = mountFigureBoard(api, container, spec, scene, current.viewport, palette, classes, current.stepState);
        liveRef.current = live;
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      live?.destroy();
      if (liveRef.current === live) liveRef.current = null;
      live = null;
    };
  }, [containerRef, hasViewport, spec, resolved, classes]);

  useEffect(() => {
    if (viewport !== null) liveRef.current?.resize(viewport);
  }, [viewport]);

  useEffect(() => {
    liveRef.current?.applyStepState(stepState);
  }, [stepState]);

  return status;
}
