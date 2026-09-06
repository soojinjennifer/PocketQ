import type { Diagnosis, WorkLine } from "shared-types";

/**
 * `features/ai-solution/WorkLineList`의 로컬 `WorkLine`(`lineNo`/`latex`/`isValid`)과 구조적으로
 * 동일하다 — TypeScript 구조적 타이핑으로 호환되므로 `shared/`가 `features/`를 참조하지 않는다는
 * 원칙(`.claude/rules/frontend.md` §1)을 지키기 위해 import 대신 이 파일에서 별도로 정의한다.
 */
interface WorkLineJudgment {
  lineNo: number;
  latex: string;
  isValid: boolean | null;
}

/**
 * `WorkLine[]`(WORK-2, 진단 전 인식 결과)와 `Diagnosis`(DIAG)를 조합해 `features/ai-solution/
 * WorkLineList`가 그대로 렌더링할 수 있는 줄 단위 판정(`isValid`)을 계산하는 순수함수.
 * `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §1.3.1 4b 단계 지시를 따른다.
 *
 * - `lineNo <= diagnosis.lastValidLine`이면 `true`("확인").
 * - `lineNo === diagnosis.stallLine`이면 `false`("막힌 지점").
 * - 그 외에는 `null`(배지 없음 — 아직 검증 대상이 아닌 줄, 예: 막힌 지점 이후의 줄).
 */
export function deriveWorkLineJudgments(workLines: WorkLine[], diagnosis: Diagnosis): WorkLineJudgment[] {
  return workLines.map((line) => ({
    lineNo: line.lineNo,
    latex: line.latex,
    isValid:
      line.lineNo <= diagnosis.lastValidLine ? true : line.lineNo === diagnosis.stallLine ? false : null,
  }));
}
