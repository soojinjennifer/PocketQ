import type { ReferenceDifficulty } from "../referenceAnalysis/referenceItemFeatureSchema";
import type { ExamCalculationLoad, ExamConditionInterpretationLoad } from "./examItemFeatureSchema";

/**
 * Stage 2 `difficultyEstimate.ts`(로컬 휴리스틱 기반 "참고용" 난이도 추정)를 exam item
 * 특징(개념 부하/추론 단계 수/조건 해석 부하/케이스 분류/표현 변환/비자명한 변형/계산 부하)으로
 * 확장한 버전. LLM에게 난이도를 직접 묻지 않는다 — 큐레이터가 직접 판단해 저장한 구조적
 * 특징을 고정 가중치로 합산해 D1~D5 구간에 매핑할 뿐이다.
 *
 * 항상 "참고용 추정치"이며 실제로 교정(calibration)된 CSAT 난이도가 아니다. 가중치/컷오프는
 * 초안이며 추후 조정될 수 있다.
 *
 * 중요한 clamp 규칙: **계산 부하(calculation_load)만으로는 D4/D5를 만들지 않는다.** 계산 부하를
 * 제외한 나머지 신호(개념 부하/추론 단계/조건 해석/케이스 분류/표현 변환/비자명한 변형)만으로
 * 계산한 "비-계산 난이도"가 D2 이하인데, 계산 부하까지 포함한 원점수가 D4/D5로 나오면
 * 결과를 D3으로 강제 상한(clamp)한다.
 */
export interface ExamDifficultyEstimateInput {
  conceptLoad: number | null;
  reasoningStepCount: number | null;
  conditionInterpretationLoad: ExamConditionInterpretationLoad | null;
  calculationLoad: ExamCalculationLoad | null;
  caseSplitRequired: boolean;
  representationConversion: boolean;
  nonObviousTransformation: boolean;
}

const LOAD_SCORE: Record<ExamCalculationLoad, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };

/** 가중치(초안, 조정 가능). */
const WEIGHTS = {
  conceptLoad: 1.0,
  reasoningStepCount: 1.2,
  conditionInterpretationLoad: 0.8,
  calculationLoad: 1.5,
  caseSplitRequired: 2,
  representationConversion: 1.5,
  nonObviousTransformation: 2,
} as const;

/** 합성 점수 → D1~D5 구간 컷오프(초안, 조정 가능). 점수가 낮을수록 쉬운 문항으로 본다. */
const DIFFICULTY_CUTOFFS: Array<{ maxScore: number; difficulty: ReferenceDifficulty }> = [
  { maxScore: 5, difficulty: "D1" },
  { maxScore: 9, difficulty: "D2" },
  { maxScore: 13, difficulty: "D3" },
  { maxScore: 17, difficulty: "D4" },
];

/** 계산 부하만으로 D4/D5가 만들어지지 않도록 clamp를 적용할지 판단하는 기준(비-계산 난이도). */
const CLAMP_ELIGIBLE_NON_CALC_DIFFICULTIES: ReadonlySet<ReferenceDifficulty> = new Set(["D1", "D2"]);

function classifyScore(score: number): ReferenceDifficulty {
  const matched = DIFFICULTY_CUTOFFS.find((cutoff) => score <= cutoff.maxScore);
  return matched?.difficulty ?? "D5";
}

export interface ExamDifficultyEstimateResult {
  difficulty: ReferenceDifficulty;
  /** 디버깅/리포트용 합성 점수(clamp 적용 전 원점수). UNKNOWN이면 null. */
  score: number | null;
  /** "계산 부하만으로는 D4/D5를 만들지 않는다" clamp 규칙이 실제로 적용됐는지. */
  clamped: boolean;
}

/**
 * 필수 입력 중 하나라도 null이면 결과도 'UNKNOWN'이다. 같은 입력엔 항상 같은 결과를
 * 돌려주는 순수 함수.
 */
export function estimateExamDifficulty(input: ExamDifficultyEstimateInput): ExamDifficultyEstimateResult {
  const { conceptLoad, reasoningStepCount, conditionInterpretationLoad, calculationLoad } = input;

  if (
    conceptLoad === null ||
    reasoningStepCount === null ||
    conditionInterpretationLoad === null ||
    calculationLoad === null
  ) {
    return { difficulty: "UNKNOWN", score: null, clamped: false };
  }

  const conditionScore = LOAD_SCORE[conditionInterpretationLoad];
  const calculationScore = LOAD_SCORE[calculationLoad];

  const nonCalculationScore =
    conceptLoad * WEIGHTS.conceptLoad +
    reasoningStepCount * WEIGHTS.reasoningStepCount +
    conditionScore * WEIGHTS.conditionInterpretationLoad +
    (input.caseSplitRequired ? WEIGHTS.caseSplitRequired : 0) +
    (input.representationConversion ? WEIGHTS.representationConversion : 0) +
    (input.nonObviousTransformation ? WEIGHTS.nonObviousTransformation : 0);

  const fullScore = nonCalculationScore + calculationScore * WEIGHTS.calculationLoad;

  const rawDifficulty = classifyScore(fullScore);
  const nonCalculationDifficulty = classifyScore(nonCalculationScore);

  const shouldClamp =
    calculationLoad === "HIGH" &&
    CLAMP_ELIGIBLE_NON_CALC_DIFFICULTIES.has(nonCalculationDifficulty) &&
    (rawDifficulty === "D4" || rawDifficulty === "D5");

  return { difficulty: shouldClamp ? "D3" : rawDifficulty, score: fullScore, clamped: shouldClamp };
}
