import { splitSolutionSteps } from "validation";

/**
 * 풀이 섹션이 줄 맨 앞 `**N단계**` 표지로 분할되는가(`SolutionStepList`와 같은 기준, 데이터 기준 §17.12).
 * 페이지가 도형 슬롯 래퍼를 미리 둘지 정할 때 쓴다(재작업 1 P2-1: 표지가 없으면 래퍼 없음 → 기존 DOM 유지).
 */
export function hasSolutionSteps(solutionMd: string | null | undefined): boolean {
  return splitSolutionSteps(solutionMd).ok;
}
