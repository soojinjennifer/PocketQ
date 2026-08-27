import type { CalculationLoad, ReferenceDifficulty } from "./referenceItemFeatureSchema";

/**
 * 로컬 휴리스틱 기반 "참고용" 난이도 추정. LLM에게 난이도를 직접 묻지 않는다 — 큐레이터가
 * 직접 판단한 concept_load/reasoning_step_count/condition_count/calculation_load 등의
 * 입력값을 고정 가중치로 합산해 D1~D5 구간에 매핑할 뿐이다.
 *
 * 중요: 이 결과는 항상 REFERENCE_ESTIMATE(참고용 추정치)일 뿐, 실제로 교정(calibration)된
 * 수능/모의고사 난이도가 아니다. 가중치와 구간 컷오프는 초안이며 추후(실제 정답률 데이터
 * 등이 쌓이면) 조정될 수 있다.
 */
export interface DifficultyEstimateInput {
  conceptLoad: number | null;
  reasoningStepCount: number | null;
  conditionCount: number | null;
  calculationLoad: CalculationLoad | null;
  /** 케이스 분류(경우의 수 나누기)가 필요한 문항인지. */
  caseSplitRequired: boolean;
  /** 자명하지 않은 변환(치환, 그래프 해석 등)이 필요한 문항인지. */
  nontrivialTransformationRequired: boolean;
}

const CALCULATION_LOAD_SCORE: Record<CalculationLoad, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

/** 가중치(초안, 조정 가능). */
const WEIGHTS = {
  conceptLoad: 1.0,
  reasoningStepCount: 1.2,
  conditionCount: 0.8,
  calculationLoad: 1.5,
  caseSplitRequired: 2,
  nontrivialTransformationRequired: 2,
} as const;

/** 합성 점수 → D1~D5 구간 컷오프(초안, 조정 가능). 점수가 낮을수록 쉬운 문항으로 본다. */
const DIFFICULTY_CUTOFFS: Array<{ maxScore: number; difficulty: ReferenceDifficulty }> = [
  { maxScore: 4, difficulty: "D1" },
  { maxScore: 7, difficulty: "D2" },
  { maxScore: 10, difficulty: "D3" },
  { maxScore: 13, difficulty: "D4" },
];

export interface DifficultyEstimateResult {
  difficulty: ReferenceDifficulty;
  /** 디버깅/리포트용 합성 점수. UNKNOWN이면 null. */
  score: number | null;
}

/**
 * 필수 입력 중 하나라도 null이면 결과도 'UNKNOWN'이다(추정 근거가 부족하다는 뜻).
 * 같은 입력엔 항상 같은 결과를 돌려주는 순수 함수.
 */
export function estimateReferenceDifficulty(input: DifficultyEstimateInput): DifficultyEstimateResult {
  const { conceptLoad, reasoningStepCount, conditionCount, calculationLoad } = input;

  if (conceptLoad === null || reasoningStepCount === null || conditionCount === null || calculationLoad === null) {
    return { difficulty: "UNKNOWN", score: null };
  }

  const score =
    conceptLoad * WEIGHTS.conceptLoad +
    reasoningStepCount * WEIGHTS.reasoningStepCount +
    conditionCount * WEIGHTS.conditionCount +
    CALCULATION_LOAD_SCORE[calculationLoad] * WEIGHTS.calculationLoad +
    (input.caseSplitRequired ? WEIGHTS.caseSplitRequired : 0) +
    (input.nontrivialTransformationRequired ? WEIGHTS.nontrivialTransformationRequired : 0);

  const matchedCutoff = DIFFICULTY_CUTOFFS.find((cutoff) => score <= cutoff.maxScore);
  return { difficulty: matchedCutoff?.difficulty ?? "D5", score };
}
