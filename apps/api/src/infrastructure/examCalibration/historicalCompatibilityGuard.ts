import type { CurriculumCompatibility } from "./examItemFeatureSchema";

/**
 * `curriculum_compatibility='INCOMPATIBLE'`인 시험 문항을 점수/승인/난이도 계산 경로에서
 * 하드 필터링하는 단일 지점. Stage 2 `extract-reference-pilot.ts`의
 * `selectInScopeItems()`와 동일한 패턴("한 곳에서만 걸러서 나머지 파이프라인은 이미 걸러진
 * 것만 본다")이다.
 *
 * `curriculumCompatibility`가 `null`인 항목(예: `subject_mapping='OUT_OF_CURRENT_SCOPE'`)은
 * "호환 불가로 확정된 것"이 아니라 "판정 대상이 아닌 것"이므로 이 가드에서는 통과시킨다 —
 * OUT_OF_CURRENT_SCOPE 배제는 이 가드의 책임이 아니라 호출부(subject_mapping 필터)의 책임이다.
 */
export interface HistoricalCompatibilityGuardInput {
  curriculumCompatibility: CurriculumCompatibility | null;
}

/** `INCOMPATIBLE`인 항목만 걸러낸다(순수 함수, 원본 배열 순서 보존). */
export function selectCompatibleExamItems<T extends HistoricalCompatibilityGuardInput>(items: readonly T[]): T[] {
  return items.filter((item) => item.curriculumCompatibility !== "INCOMPATIBLE");
}

/** `INCOMPATIBLE`이면 true. 단일 항목 판정이 필요한 호출부(리포트 등)에서 사용한다. */
export function isIncompatibleWithCurrentCurriculum(
  curriculumCompatibility: CurriculumCompatibility | null,
): boolean {
  return curriculumCompatibility === "INCOMPATIBLE";
}
