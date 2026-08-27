import type { CsatRelevanceLevel } from "./problemFamilyCalibrationSchema";

/**
 * CSAT(수능) 관련도 스코어링 — 순수 함수 모듈.
 *
 * 5차원 가중합: Gold Evidence / Curriculum Centrality / Historical KICE Evidence /
 * Reasoning Reusability / Reference Coverage. **LLM에게 점수를 직접 묻는 코드는 여기에 없다** —
 * 전부 이미 저장된 증거(evidence_weight, curriculum_prerequisites 유래 중심성, Stage 2
 * confidence 등)로부터 결정적으로 계산한다.
 *
 * SILVER_KICE 타입 exam_reference_sets가 코퍼스에 1건도 없으면(현재 상태 — 2022 개정이
 * 2028학년도부터 처음 적용되는 새 체제라 완전 호환되는 과거 기출이 사실상 없음) Historical
 * 차원(20%)의 가중치를, cross-node combinability 등 reasoning reusability에 대한 신뢰할 수
 * 있는 신호가 없으면 Reasoning 차원(10%)의 가중치를 각각 나머지 차원들에 비례 재분배한다.
 * `redistributeWeights`를 반드시 거쳐야 하며, 원안 가중치를 하드코딩해서 그대로 쓰면 안 된다.
 */
export interface CsatRelevanceWeights {
  gold: number;
  curriculum: number;
  historical: number;
  reasoning: number;
  reference: number;
}

/** `redistributeWeights`/`scoreFamilyCsatRelevance`에 전달하는, 각 차원의 가중치를 0으로
 * 재분배할지 결정하는 플래그. */
export interface WeightAvailabilityFlags {
  /** SILVER_KICE 증거가 코퍼스에 1건이라도 있으면 true. false면 historical 차원 가중치를 0으로. */
  hasAnySilverEvidenceInCorpus: boolean;
  /** cross-node combinability 등 reasoning reusability에 대한 신뢰할 수 있는 신호가 있으면
   * true. false면 reasoning 차원 가중치를 0으로. */
  hasReliableReasoningReusabilitySignal: boolean;
}

/** 원안 가중치(초안, 조정 가능): Gold 40% / Curriculum 25% / Historical 20% / Reasoning 10% / Reference 5%. */
const BASE_WEIGHTS: CsatRelevanceWeights = {
  gold: 0.4,
  curriculum: 0.25,
  historical: 0.2,
  reasoning: 0.1,
  reference: 0.05,
};

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * `flags`에 따라 historical/reasoning 차원의 가중치를 0으로 만들고, 그 합을 나머지(0이 되지
 * 않은) 차원들에 "원래 가중치 비중에 비례"해 재분배한다(원안 그대로 두면 신호가 없는 차원 때문에
 * family가 구조적으로 100% 미만까지만 도달 가능해지는 문제를 막기 위함). 어느 쪽도 0이 되지
 * 않으면(둘 다 신호가 있으면) 원안 가중치를 그대로 돌려준다.
 *
 * SILVER 증거만 없으면(historical만 0) 결과: Gold 50% / Curriculum 31.25% / Reasoning 12.5% /
 * Reference 6.25% / Historical 0%.
 * SILVER 증거도 없고 reasoning reusability 신호도 없으면(historical+reasoning 모두 0) 결과:
 * Gold ≈57.14% / Curriculum ≈35.71% / Reference ≈7.14% / Historical 0% / Reasoning 0%.
 */
export function redistributeWeights(flags: WeightAvailabilityFlags): CsatRelevanceWeights {
  const zeroedKeys: Array<keyof CsatRelevanceWeights> = [];
  if (!flags.hasAnySilverEvidenceInCorpus) zeroedKeys.push("historical");
  if (!flags.hasReliableReasoningReusabilitySignal) zeroedKeys.push("reasoning");

  if (zeroedKeys.length === 0) {
    return { ...BASE_WEIGHTS };
  }

  const zeroedTotal = zeroedKeys.reduce((sum, key) => sum + BASE_WEIGHTS[key], 0);
  const remainingKeys = (Object.keys(BASE_WEIGHTS) as Array<keyof CsatRelevanceWeights>).filter(
    (key) => !zeroedKeys.includes(key),
  );
  const remainingTotal = remainingKeys.reduce((sum, key) => sum + BASE_WEIGHTS[key], 0);

  const result: CsatRelevanceWeights = { ...BASE_WEIGHTS };
  for (const key of zeroedKeys) result[key] = 0;
  if (remainingTotal > 0) {
    for (const key of remainingKeys) {
      result[key] = round4(BASE_WEIGHTS[key] + zeroedTotal * (BASE_WEIGHTS[key] / remainingTotal));
    }
  }
  return result;
}

/** CORE≥0.75 / HIGH≥0.55 / MEDIUM≥0.35 / LOW≥0.15 / REJECT<0.15 (초안, 조정 가능). */
const RELEVANCE_LEVEL_CUTOFFS: Array<{ minScore: number; level: CsatRelevanceLevel }> = [
  { minScore: 0.75, level: "CORE" },
  { minScore: 0.55, level: "HIGH" },
  { minScore: 0.35, level: "MEDIUM" },
  { minScore: 0.15, level: "LOW" },
];

export function classifyRelevanceLevel(score: number): CsatRelevanceLevel {
  const matched = RELEVANCE_LEVEL_CUTOFFS.find((cutoff) => score >= cutoff.minScore);
  return matched?.level ?? "REJECT";
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** 여러 evidence_weight를 하나의 0~1 차원 점수로 합산한다(초안 캡, 조정 가능). */
function aggregateEvidenceWeights(weights: readonly number[]): number {
  if (weights.length === 0) return 0;
  const sum = weights.reduce((total, weight) => total + weight, 0);
  // 가중치 합이 2(예: DIRECT급 증거 2개)에 도달하면 이미 최대치로 본다.
  return clamp01(sum / 2);
}

export interface CsatRelevanceScoringInput {
  /** family에 매칭된 GOLD_2028_SAMPLE 등급 exam item evidence의 evidence_weight 목록(NONE 제외). */
  goldEvidenceWeights: readonly number[];
  /** family에 매칭된 SILVER_KICE 등급 exam item evidence의 evidence_weight 목록(NONE 제외). */
  silverEvidenceWeights: readonly number[];
  /** 0~1. family의 커리큘럼 노드가 교육과정 그래프에서 얼마나 중심적인지(호출부가 curriculum_nodes.csat_importance 등에서 계산). */
  curriculumCentrality: number;
  /** Stage 2 `problem_family_candidates.confidence`. null이면 재사용 가능성 근거가 없다는 뜻(0으로 취급). */
  stage2Confidence: number | null;
  /** 0~1. family가 참고자료 코퍼스에서 얼마나 폭넓게 재확인되는지(호출부 계산). */
  referenceCoverageRatio: number;
}

export interface CsatRelevanceScoreResult {
  score: number;
  level: CsatRelevanceLevel;
  weightsUsed: CsatRelevanceWeights;
  dimensionScores: {
    gold: number;
    curriculum: number;
    historical: number;
    reasoning: number;
    reference: number;
  };
}

/**
 * family 하나의 CSAT 관련도를 계산한다. 같은 입력엔 항상 같은 결과를 돌려주는 순수 함수
 * (DB/네트워크/LLM 호출 없음).
 *
 * `dimensionScores.reasoning`은 `flags.hasReliableReasoningReusabilitySignal=false`일 때도
 * (리포트에서 볼 수 있도록) 계속 `stage2Confidence`로 채워지지만, 그 경우
 * `weightsUsed.reasoning=0`이라 최종 `score` 계산에는 기여하지 않는다 — Stage2 추출 신뢰도는
 * "이 family가 CSAT에 재사용 가능한 추론 패턴인가"의 근거가 아니므로, 신뢰할 수 있는
 * reasoning reusability 신호(예: cross-node combinability)가 생기기 전까지는 참고용 표시값일
 * 뿐이다.
 */
export function scoreFamilyCsatRelevance(
  input: CsatRelevanceScoringInput,
  flags: WeightAvailabilityFlags,
): CsatRelevanceScoreResult {
  const weightsUsed = redistributeWeights(flags);

  const dimensionScores = {
    gold: aggregateEvidenceWeights(input.goldEvidenceWeights),
    curriculum: clamp01(input.curriculumCentrality),
    historical: aggregateEvidenceWeights(input.silverEvidenceWeights),
    reasoning: clamp01(input.stage2Confidence ?? 0),
    reference: clamp01(input.referenceCoverageRatio),
  };

  const score =
    dimensionScores.gold * weightsUsed.gold +
    dimensionScores.curriculum * weightsUsed.curriculum +
    dimensionScores.historical * weightsUsed.historical +
    dimensionScores.reasoning * weightsUsed.reasoning +
    dimensionScores.reference * weightsUsed.reference;

  return { score: clamp01(round4(score)), level: classifyRelevanceLevel(score), weightsUsed, dimensionScores };
}
