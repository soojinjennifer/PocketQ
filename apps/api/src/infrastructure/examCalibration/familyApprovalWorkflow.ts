import type { ReferenceDifficulty } from "../referenceAnalysis/referenceItemFeatureSchema";
import type { CsatRelevanceLevel } from "./problemFamilyCalibrationSchema";

/**
 * `problem_family_candidates` 하나를 최종 승인(`problem_family_calibration.status`)까지
 * 평가하는 순수 함수 모듈. 7개 게이트를 모두 평가한 뒤:
 * - 하나라도 FAIL이면 REJECTED
 * - FAIL이 없고 전부 PASS면 APPROVED
 * - FAIL은 없지만 하나 이상 UNCERTAIN이면 REVIEW_REQUIRED
 *
 * 중요: SILVER_KICE 증거가 0건이어도 Gold 증거(2028학년도 수능 예시문항) 단독으로 "의미있는
 * 증거" 게이트를 통과해 APPROVED에 도달할 수 있어야 한다(gold_evidence_count≥1이면 그 자체로
 * 충분).
 */
export type FamilyApprovalGateName =
  | "CURRICULUM_VALID"
  | "MATHEMATICAL_CONSISTENCY"
  | "DISTINCT_FROM_OTHER_FAMILIES"
  | "MEANINGFUL_EVIDENCE"
  | "CSAT_USEFULNESS"
  | "EXPLAINABLE_REASONING_SIGNATURE"
  | "VALID_DIFFICULTY_RANGE";

export type FamilyApprovalGateVerdict = "PASS" | "UNCERTAIN" | "FAIL";

export interface FamilyApprovalGateStatus {
  verdict: FamilyApprovalGateVerdict;
  reason: string;
}

export type FamilyApprovalDecisionStatus = "APPROVED" | "REVIEW_REQUIRED" | "REJECTED";

export interface FamilyApprovalInput {
  /** family의 curriculumNodeCodes가 전부 실제 커리큘럼 그래프 노드로 해석되는지(호출부 검증). */
  curriculumNodesValid: boolean;
  /** representationTypes/난이도 범위 등에 명백한 수학적 모순이 있는지(호출부 검증). */
  hasConflictingRepresentationTypes: boolean;
  /** 다른 family와 사실상 동일(중복)하다고 판단된 경우 그 family의 candidateCode, 아니면 null. */
  duplicateOfAnotherFamilyCode: string | null;
  goldEvidenceCount: number;
  /** GOLD 증거 중 matchType이 WEAK가 아닌(DIRECT/PARTIAL/COMPOSITE) 것의 개수. WEAK 매치는
   * 단독으로 "의미있는 증거" 게이트를 통과시키지 못한다. */
  goldMeaningfulEvidenceCount: number;
  silverEvidenceCount: number;
  stage2Confidence: number | null;
  stage2SourceItemCount: number;
  csatRelevanceLevel: CsatRelevanceLevel;
  reasoningSignature: string;
  difficultyMin: ReferenceDifficulty | null;
  difficultyMax: ReferenceDifficulty | null;
}

export interface FamilyApprovalResult {
  status: FamilyApprovalDecisionStatus;
  gates: Record<FamilyApprovalGateName, FamilyApprovalGateStatus>;
}

/** "의미있는 증거" 게이트의 Stage 2 단독 통과 기준(초안, 조정 가능). */
const MEANINGFUL_EVIDENCE_CONFIDENCE_PASS_THRESHOLD = 0.6;
const MEANINGFUL_EVIDENCE_SOURCE_ITEM_PASS_THRESHOLD = 2;
const MEANINGFUL_EVIDENCE_CONFIDENCE_UNCERTAIN_THRESHOLD = 0.4;

function evaluateCurriculumValid(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  return input.curriculumNodesValid
    ? { verdict: "PASS", reason: "커리큘럼 노드 코드가 모두 실제 커리큘럼 그래프에 존재합니다." }
    : { verdict: "FAIL", reason: "커리큘럼 노드 코드 중 커리큘럼 그래프에 존재하지 않는 것이 있습니다." };
}

function evaluateMathematicalConsistency(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  return input.hasConflictingRepresentationTypes
    ? { verdict: "FAIL", reason: "표현 형태/난이도 범위 등에서 명백한 수학적 모순이 발견되었습니다." }
    : { verdict: "PASS", reason: "수학적 모순이 발견되지 않았습니다." };
}

function evaluateDistinctFromOtherFamilies(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  return input.duplicateOfAnotherFamilyCode
    ? {
        verdict: "FAIL",
        reason: `다른 family(${input.duplicateOfAnotherFamilyCode})와 사실상 중복된 것으로 판단되었습니다.`,
      }
    : { verdict: "PASS", reason: "다른 family와 뚜렷이 구분됩니다." };
}

function evaluateMeaningfulEvidence(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  if (input.goldMeaningfulEvidenceCount >= 1) {
    return {
      verdict: "PASS",
      reason: `GOLD 의미있는 증거(DIRECT/PARTIAL/COMPOSITE) ${input.goldMeaningfulEvidenceCount}건으로 의미있는 증거 게이트를 통과합니다(SILVER 무관, WEAK 매치 단독으로는 통과 불가).`,
    };
  }

  const confidence = input.stage2Confidence;
  if (
    confidence !== null &&
    confidence >= MEANINGFUL_EVIDENCE_CONFIDENCE_PASS_THRESHOLD &&
    input.stage2SourceItemCount >= MEANINGFUL_EVIDENCE_SOURCE_ITEM_PASS_THRESHOLD
  ) {
    return {
      verdict: "PASS",
      reason: `GOLD 의미있는 증거는 없지만 Stage 2 confidence(${confidence})와 source_item_count(${input.stage2SourceItemCount})가 충분합니다.`,
    };
  }

  const hasWeakOnlyGoldEvidence = input.goldEvidenceCount > input.goldMeaningfulEvidenceCount;
  const hasSomeSignal =
    hasWeakOnlyGoldEvidence ||
    (confidence !== null && confidence >= MEANINGFUL_EVIDENCE_CONFIDENCE_UNCERTAIN_THRESHOLD) ||
    input.stage2SourceItemCount >= MEANINGFUL_EVIDENCE_SOURCE_ITEM_PASS_THRESHOLD;

  if (hasSomeSignal) {
    return {
      verdict: "UNCERTAIN",
      reason: hasWeakOnlyGoldEvidence
        ? "GOLD 증거는 있지만 전부 WEAK 매치라 단독으로 의미있는 증거로 인정하기 어렵고, Stage 2 근거도 통과 기준에는 못 미칩니다."
        : "GOLD 증거가 없고 Stage 2 근거도 통과 기준에는 못 미치지만 완전히 근거가 없다고 보기도 어렵습니다.",
    };
  }

  return {
    verdict: "FAIL",
    reason: "GOLD 증거가 없고 Stage 2 confidence/source_item_count도 낮아 의미있는 증거가 부족합니다.",
  };
}

function evaluateCsatUsefulness(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  if (input.csatRelevanceLevel === "REJECT") {
    return { verdict: "FAIL", reason: "CSAT 관련도 등급이 REJECT입니다." };
  }
  if (input.csatRelevanceLevel === "LOW") {
    return { verdict: "UNCERTAIN", reason: "CSAT 관련도 등급이 LOW로 낮은 편입니다." };
  }
  return { verdict: "PASS", reason: `CSAT 관련도 등급이 ${input.csatRelevanceLevel}입니다.` };
}

function evaluateExplainableReasoningSignature(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  const trimmed = input.reasoningSignature.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "unknown") {
    return { verdict: "FAIL", reason: "reasoning_signature가 비어있거나 설명 불가능합니다." };
  }
  if (trimmed.length < 5) {
    return { verdict: "UNCERTAIN", reason: "reasoning_signature가 지나치게 짧아 설명력이 불확실합니다." };
  }
  return { verdict: "PASS", reason: "reasoning_signature가 설명 가능한 형태로 존재합니다." };
}

function evaluateValidDifficultyRange(input: FamilyApprovalInput): FamilyApprovalGateStatus {
  const { difficultyMin, difficultyMax } = input;
  if (difficultyMin === null || difficultyMax === null) {
    return { verdict: "FAIL", reason: "난이도 범위(min/max)가 지정되지 않았습니다." };
  }
  if (difficultyMin === "UNKNOWN" && difficultyMax === "UNKNOWN") {
    return { verdict: "FAIL", reason: "난이도 범위가 모두 UNKNOWN입니다." };
  }
  if (difficultyMin === "UNKNOWN" || difficultyMax === "UNKNOWN") {
    return { verdict: "UNCERTAIN", reason: "난이도 범위의 한쪽만 UNKNOWN입니다." };
  }
  return { verdict: "PASS", reason: `난이도 범위(${difficultyMin}~${difficultyMax})가 유효합니다.` };
}

/**
 * family 하나에 7개 게이트를 모두 적용해 최종 승인 상태를 판정한다. 같은 입력엔 항상 같은
 * 결과를 돌려주는 순수 함수(DB/네트워크 접근 없음, `problem_family_candidates` 행을 직접
 * 수정하지 않는다 — 호출부가 결과를 별도로 `problem_family_calibration`에 저장해야 한다).
 */
export function evaluateFamilyApproval(input: FamilyApprovalInput): FamilyApprovalResult {
  const gates: Record<FamilyApprovalGateName, FamilyApprovalGateStatus> = {
    CURRICULUM_VALID: evaluateCurriculumValid(input),
    MATHEMATICAL_CONSISTENCY: evaluateMathematicalConsistency(input),
    DISTINCT_FROM_OTHER_FAMILIES: evaluateDistinctFromOtherFamilies(input),
    MEANINGFUL_EVIDENCE: evaluateMeaningfulEvidence(input),
    CSAT_USEFULNESS: evaluateCsatUsefulness(input),
    EXPLAINABLE_REASONING_SIGNATURE: evaluateExplainableReasoningSignature(input),
    VALID_DIFFICULTY_RANGE: evaluateValidDifficultyRange(input),
  };

  const verdicts = Object.values(gates).map((gate) => gate.verdict);
  const hasFail = verdicts.includes("FAIL");
  const hasUncertain = verdicts.includes("UNCERTAIN");

  const status: FamilyApprovalDecisionStatus = hasFail ? "REJECTED" : hasUncertain ? "REVIEW_REQUIRED" : "APPROVED";

  return { status, gates };
}
