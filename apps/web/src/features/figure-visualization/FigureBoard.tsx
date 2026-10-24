import { useEffect, useId, useMemo, useRef } from "react";
import type { FigureSpec } from "shared-types";
import type { ResolvedFigure } from "validation";
import { Spinner } from "../../shared/ui/spinner/Spinner";
import type { FigureTextClasses } from "./applySceneToBoard";
import { FigureFallback } from "./FigureFallback";
import styles from "./FigureView.module.css";
import { resolveStepState } from "./resolveStepState";
import { useElementWidth, useJsxGraphBoard, type FigureBoardStatus } from "./useJsxGraphBoard";
import { PLACEHOLDER_BOARD_WIDTH, VIEWPORT_MIN_HEIGHT, computeViewport } from "./viewport";

const TEXT_CLASSES: FigureTextClasses = {
  element: styles.element ?? "",
  measure: styles.measure ?? "",
  tick: styles.tick ?? "",
  axisName: styles.axisName ?? "",
};

/** 보드 상자 테두리(위·아래 1px씩) — 보드 높이에 더해 상자 높이를 잡는다. */
const BOX_BORDER_PX = 2;

interface FigureBoardProps {
  spec: FigureSpec;
  resolved: ResolvedFigure;
  stepId?: string | null;
  onStatusChange?: (status: FigureBoardStatus) => void;
}

/**
 * 보드 상자(`docs/FIGURE_DESIGN.md` §7.2) + JSXGraph 전용 컨테이너.
 * 컨테이너 div에는 React 자식을 두지 않는다(`initBoard`가 자식을 모두 지운다). 로딩 표시는 형제로 겹친다.
 */
export function FigureBoard({ spec, resolved, stepId, onStatusChange }: FigureBoardProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const boardId = `figboard${useId().replace(/[^A-Za-z0-9]/g, "")}`;

  const width = useElementWidth(boxRef);
  const viewport = useMemo(() => computeViewport(spec, resolved, width), [spec, resolved, width]);
  const placeholder = useMemo(() => computeViewport(spec, resolved, PLACEHOLDER_BOARD_WIDTH), [spec, resolved]);
  const stepState = useMemo(() => resolveStepState(spec, stepId), [spec, stepId]);

  const status = useJsxGraphBoard({
    containerRef: boardRef,
    spec,
    resolved,
    viewport,
    stepState,
    classes: TEXT_CLASSES,
  });

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  if (status === "error") return <FigureFallback />;

  const boardHeight = (viewport ?? placeholder)?.height ?? VIEWPORT_MIN_HEIGHT;
  return (
    <div
      ref={boxRef}
      className="bg-bg-canvas border-separator relative overflow-hidden rounded-[10px] border"
      style={{ height: boardHeight + BOX_BORDER_PX }}
    >
      <div ref={boardRef} id={boardId} aria-hidden="true" className={`h-full w-full ${styles.board ?? ""}`} />
      {status === "loading" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner label="그림을 준비하는 중" />
        </div>
      ) : null}
    </div>
  );
}
