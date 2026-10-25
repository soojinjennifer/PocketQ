import { useMemo } from "react";
import type { FigureSpec } from "shared-types";
import { SolutionFigures } from "./SolutionFigures";
import { parseFigureSpec } from "./useFigureSpec";

export interface SavedSolutionFiguresProps {
  /** 상세 응답의 `figures`(서버가 재파싱해 보낸 값, 웹 스키마상 `unknown[]`). */
  figures: readonly unknown[];
  solutionMd: string | null;
  step: number | null;
  onStepChange: (step: number | null) => void;
}

/** 서버 상한과 같다(`MAX_FIGURES`). 넘는 도형은 그리지 않는다. */
const MAX_SAVED_FIGURES = 3;

/**
 * 마이페이지 재조회용 그림(Stage 5, `docs/FIGURE_DESIGN.md` §18.5). 저장된 도형은 상세 응답과 함께 한 번에 오므로 `received`로 그린다.
 * 상세 스키마는 도형 원소를 검사하지 않으므로(관대) 여기서 렌더러와 같은 규칙(`parseFigureSpec`: 구조 스키마 → 의미 검증)으로 한 번 더
 * 확인하고 같은 figureId는 앞의 것만 남긴다. `validation`의 `parseSolutionFigures`를 쓰지 않는 이유: 그 함수는 메인 번들도 쓰는 모듈에
 * 정의돼 있어 지연 청크에서 부르면 번들러가 검증 커널을 메인이 정적으로 불러오는 공통 청크로 옮긴다(on 빌드에서 확인, 장부 §8).
 * 이 파일은 `lazyEntry`를 통해서만 지연 로딩된다. 통과 도형이 0이면 아무것도 그리지 않는다.
 */
export function SavedSolutionFigures({ figures, solutionMd, step, onStepChange }: SavedSolutionFiguresProps) {
  const accepted = useMemo(() => {
    const out: FigureSpec[] = [];
    const seen = new Set<string>();
    for (const raw of figures) {
      if (out.length >= MAX_SAVED_FIGURES) break;
      const result = parseFigureSpec(raw);
      if (!result.ok || seen.has(result.spec.figureId)) continue;
      seen.add(result.spec.figureId);
      out.push(result.spec);
    }
    return out;
  }, [figures]);
  if (accepted.length === 0) return null;
  return <SolutionFigures phase="received" figures={accepted} solutionMd={solutionMd} step={step} onStepChange={onStepChange} />;
}
