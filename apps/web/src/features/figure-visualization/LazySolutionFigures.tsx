import { lazy, Suspense, type ReactNode } from "react";
import { splitSolutionSteps } from "validation";
import { FigureErrorBoundary } from "./FigureErrorBoundary";

/**
 * 도형 슬롯 공용 진입점(Stage 5, `docs/FIGURE_DESIGN.md` §18.8) — `SolveLandscapePage`(실시간)와 `MyPage`(재조회)가 함께 쓴다.
 *
 * 빌드 플래그 `VITE_FIGURES_ENABLED === "true"`일 때만 `SolutionFigures`를 지연 로딩한다. Vite가 빌드 시점에 값을 치환하므로
 * off 빌드에서는 이 동적 import가 통째로 빠져 렌더러·검증 커널·JSXGraph 청크가 생기지 않는다(Stage 4에서 페이지에 있던 정의를 옮김).
 * 청크 실패·렌더 실패는 `FigureErrorBoundary`(fallback 없음)가 막아 슬롯만 비게 한다(Stage 4 H-1).
 * 단계 분할 여부는 `validation`의 `splitSolutionSteps`를 직접 쓴다(feature 간 참조 금지 — `ai-solution/hasSolutionSteps`를 쓰지 않는다).
 */
const loadFigureChunk = () => import("./lazyEntry");
const SolutionFigures =
  import.meta.env.VITE_FIGURES_ENABLED === "true"
    ? lazy(() => loadFigureChunk().then((chunk) => ({ default: chunk.SolutionFigures })))
    : null;
/** 재조회용(도형 원소 재확인 포함). 같은 지연 청크(`lazyEntry`)에서 온다. 플래그 off면 null. */
const SavedSolutionFigures =
  import.meta.env.VITE_FIGURES_ENABLED === "true"
    ? lazy(() => loadFigureChunk().then((chunk) => ({ default: chunk.SavedSolutionFigures })))
    : null;

export type FigureSlotPhase = "idle" | "waiting" | "received" | "empty";
export type LazySolutionFiguresComponent = NonNullable<typeof SolutionFigures>;

function wrap(content: ReactNode): ReactNode {
  return (
    <FigureErrorBoundary fallback={null}>
      <Suspense fallback={null}>{content}</Suspense>
    </FigureErrorBoundary>
  );
}

/**
 * 실시간 화면용 슬롯 내용(Stage 4 동작 그대로). 반환값: `undefined` = 슬롯 없음(플래그 off·표지 없고 도형 단계도 아님 → 기존 DOM),
 * `null` = `aria-live="off"` 래퍼만 미리 둠(P2-1), 그 밖 = 지연 로딩 그림.
 */
export function figureSlotContent(
  phase: FigureSlotPhase,
  solutionMd: string | null,
  render: (Slot: LazySolutionFiguresComponent) => ReactNode,
): ReactNode {
  if (SolutionFigures === null) return undefined;
  const active = phase === "waiting" || phase === "received";
  if (!active) return splitSolutionSteps(solutionMd).ok ? null : undefined;
  return wrap(render(SolutionFigures));
}

/**
 * 재조회용 슬롯 내용(§18.5) — 저장된 도형은 한 번에 오므로 늦게 오는 그림을 위한 빈 래퍼(`null`) 규칙을 쓰지 않는다.
 * 플래그 off·도형 없음(키 없음·빈 배열)이면 `undefined`(슬롯·래퍼 없음 → 기존 DOM), 있으면 `received` 그림.
 */
export function savedFigureSlot(
  figures: readonly unknown[] | undefined,
  solutionMd: string | null,
  step: number | null,
  onStepChange: (step: number | null) => void,
): ReactNode | undefined {
  if (SavedSolutionFigures === null || !figures || figures.length === 0) return undefined;
  return wrap(<SavedSolutionFigures figures={figures} solutionMd={solutionMd} step={step} onStepChange={onStepChange} />);
}
