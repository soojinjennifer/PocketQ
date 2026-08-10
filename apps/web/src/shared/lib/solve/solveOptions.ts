import type { SolveOptions } from "shared-types";

/**
 * `Action Bar`(Figma node `38:48`) 개념설명/풀이 체크박스 옵션의 단일 기준.
 * `features/solve-session/ActionBar`(UI)와 `features/problem-input`(제출 시 `SolveOptions` 변환) 양쪽이
 * 이 상수를 재사용해서 옵션 id 문자열이 두 곳에서 따로 하드코딩되지 않게 한다.
 */
export const SOLVE_OPTION_EXPLAIN = "explain";
export const SOLVE_OPTION_SOLVE = "solve";

export interface SolveActionOption {
  id: string;
  label: string;
}

export const SOLVE_ACTION_OPTIONS: SolveActionOption[] = [
  { id: SOLVE_OPTION_EXPLAIN, label: "개념설명해주기" },
  { id: SOLVE_OPTION_SOLVE, label: "풀이해주기" },
];

/** 선택된 옵션 id 집합을 `POST /api/problems/:problemId/solve` 요청의 `options`로 변환한다. */
export function toSolveOptions(selectedIds: ReadonlySet<string>): SolveOptions {
  return {
    concept: selectedIds.has(SOLVE_OPTION_EXPLAIN),
    solution: selectedIds.has(SOLVE_OPTION_SOLVE),
  };
}
