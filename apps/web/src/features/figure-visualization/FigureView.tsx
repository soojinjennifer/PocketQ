import { useCallback, useEffect, useMemo, useState } from "react";
import type { FigureSpec } from "shared-types";
import { validateFigureSemantics } from "validation";
import { FigureBoard } from "./FigureBoard";
import { FigureErrorBoundary } from "./FigureErrorBoundary";
import { FigureFallback } from "./FigureFallback";
import type { FigureStepPosition } from "./resolveStepState";

export type FigureViewStatus = "loading" | "ready" | "error";

export interface FigureViewProps {
  /** 구조 스키마를 통과한 명세(`useFigureSpec`/`parseSolutionFigures` 결과). 의미 검증은 여기서 다시 한다. */
  spec: FigureSpec;
  /** 현재 풀이 단계(`sN`). 없거나 steps에 없으면 최종 상태. 바뀌어도 보드를 다시 만들지 않는다. */
  stepId?: string | null;
  /** 풀이 전역 단계 위치(Stage 4, `resolveStepStateAt`). 주면 `stepId`보다 우선한다. 바뀌어도 보드를 다시 만들지 않는다. */
  step?: FigureStepPosition;
  className?: string;
  onStatusChange?: (status: FigureViewStatus) => void;
}

/**
 * 도형 하나 — `<figure>` + 보드(또는 대체 표시) + 화면에 보이는 `<figcaption>`(description).
 * 표면(카드)은 갖지 않는다. 조립하는 쪽이 감싼다(`docs/FIGURE_DESIGN.md` §7.1).
 * 실패는 이 도형 안에서만 대체 표시로 바뀐다(다른 도형·풀이 화면에 영향 없음).
 */
export function FigureView({ spec, stepId, step, className, onStatusChange }: FigureViewProps) {
  const semantics = useMemo(() => validateFigureSemantics(spec), [spec]);
  const [status, setStatus] = useState<FigureViewStatus>("loading");

  const handleStatus = useCallback(
    (next: FigureViewStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );
  const handleBoundaryError = useCallback(() => handleStatus("error"), [handleStatus]);

  useEffect(() => {
    if (!semantics.ok) onStatusChange?.("error");
  }, [semantics, onStatusChange]);

  const busy = semantics.ok && status === "loading";
  return (
    <figure className={`flex flex-col gap-3 ${className ?? ""}`} aria-busy={busy ? true : undefined}>
      {semantics.ok ? (
        <FigureErrorBoundary fallback={<FigureFallback />} onError={handleBoundaryError}>
          <FigureBoard spec={spec} resolved={semantics.resolved} stepId={stepId} step={step} onStatusChange={handleStatus} />
        </FigureErrorBoundary>
      ) : (
        <FigureFallback />
      )}
      <figcaption className="text-label-primary text-[13px] leading-[18px] wrap-anywhere whitespace-pre-wrap">
        <span className="sr-only">그림 설명: </span>
        {spec.description}
      </figcaption>
    </figure>
  );
}
