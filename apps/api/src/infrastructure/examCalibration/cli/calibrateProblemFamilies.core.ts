import type { ReferenceDifficulty } from "../../referenceAnalysis/referenceItemFeatureSchema";
import type { ProblemFamilyCandidateInput } from "../../referenceAnalysis/problemFamilyCandidateSchema";
import {
  classifyRelevanceLevel,
  scoreFamilyCsatRelevance,
  type CsatRelevanceScoreResult,
} from "../csatRelevanceScoring";
import { estimateExamDifficulty, type ExamDifficultyEstimateInput } from "../examDifficultyEstimate";
import {
  matchFamilyToExamItem,
  type EvidenceMatchResult,
  type EvidenceMatchingExamItemInput,
} from "../examEvidenceMatching";
import { evaluateFamilyApproval, type FamilyApprovalResult } from "../familyApprovalWorkflow";
import { selectCompatibleExamItems } from "../historicalCompatibilityGuard";
import {
  detectMergeProposals,
  detectSplitProposals,
  type FamilyDirectMatchRecord,
  type FamilyInternalEvidenceRecord,
  type MergeProposal,
  type SplitProposal,
} from "../familyTaxonomyReview";
import type { CurriculumCompatibility } from "../examItemFeatureSchema";
import type { EvidenceTier } from "../examReferenceSetSchema";

/**
 * Stage 3 오케스트레이션(`calibrate-problem-families.ts`)의 순수 계산 핵심.
 *
 * 이 파일은 DB/파일시스템/네트워크에 전혀 접근하지 않는다 — CLI 본체(`calibrate-problem-families.ts`)가
 * PDF/JSON을 읽어 아래 입력 shape으로 변환해 넘겨주면, 이 모듈은 순수 함수로만 계산한다.
 * 합성 fixture만으로 전체 테스트가 가능해야 한다는 요구사항을 만족하기 위한 구조다.
 */
export interface CalibrationExamItemInput {
  examItemId: string;
  itemNumber: number;
  evidenceTier: EvidenceTier;
  curriculumNodeCodes: string[];
  requiredSkills: string[];
  reasoningSignature: string | null;
  representationType: string | null;
  curriculumCompatibility: CurriculumCompatibility | null;
  conceptLoad: number | null;
  reasoningStepCount: number | null;
  conditionInterpretationLoad: ExamDifficultyEstimateInput["conditionInterpretationLoad"];
  calculationLoad: ExamDifficultyEstimateInput["calculationLoad"];
  caseSplitRequired: boolean;
  representationConversion: boolean;
  nonObviousTransformation: boolean;
}

export interface FamilyDifficultyBand {
  min: ReferenceDifficulty;
  max: ReferenceDifficulty;
  center: ReferenceDifficulty;
}

const DIFFICULTY_ORDER: Record<ReferenceDifficulty, number> = { UNKNOWN: -1, D1: 0, D2: 1, D3: 2, D4: 3, D5: 4 };
const DIFFICULTY_BY_ORDER: ReferenceDifficulty[] = ["D1", "D2", "D3", "D4", "D5"];

/**
 * 결정사항 9(난이도 밴드 병합): Gold DIRECT/PARTIAL 매치가 있으면 그 항목들의 난이도로 Stage 2
 * REFERENCE_ESTIMATE 밴드를 확장/보정한다. "충돌 시 Gold가 이긴다"는, Stage 2 밴드가 Gold
 * 증거 범위를 전혀 포함하지 못하는 경우 Gold 쪽 범위를 우선시해 최종 밴드에 반드시 포함시킨다는
 * 뜻으로 구현한다(Stage 2 밴드만으로 Gold 증거를 무시하지 않음). Gold 증거가 없으면 Stage 2
 * 밴드를 그대로 쓴다. 둘 다 없으면 UNKNOWN.
 */
export function mergeDifficultyBand(
  stage2Min: ReferenceDifficulty | null,
  stage2Max: ReferenceDifficulty | null,
  goldDifficulties: readonly ReferenceDifficulty[],
): FamilyDifficultyBand {
  const knownStage2 = [stage2Min, stage2Max].filter(
    (value): value is ReferenceDifficulty => value !== null && value !== "UNKNOWN",
  );
  const knownGold = goldDifficulties.filter((value) => value !== "UNKNOWN");

  const allKnown = [...knownStage2, ...knownGold];
  if (allKnown.length === 0) {
    return { min: "UNKNOWN", max: "UNKNOWN", center: "UNKNOWN" };
  }

  const orders = allKnown.map((value) => DIFFICULTY_ORDER[value]);
  const minOrder = Math.min(...orders);
  const maxOrder = Math.max(...orders);

  // Gold 증거가 있으면 중심값은 Gold 쪽 값들의 평균에 가깝게(반올림) 잡는다 — "충돌 시 Gold가
  // 이긴다"를 중심값 산정에 반영. Gold가 없으면 Stage 2 범위의 중간값을 쓴다.
  const centerOrder =
    knownGold.length > 0
      ? Math.round(knownGold.reduce((sum, value) => sum + DIFFICULTY_ORDER[value], 0) / knownGold.length)
      : Math.round((minOrder + maxOrder) / 2);

  return {
    min: DIFFICULTY_BY_ORDER[minOrder]!,
    max: DIFFICULTY_BY_ORDER[maxOrder]!,
    center: DIFFICULTY_BY_ORDER[Math.min(Math.max(centerOrder, minOrder), maxOrder)]!,
  };
}

export interface FamilyCalibrationComputation {
  candidateCode: string;
  evidence: Array<{
    examItemId: string;
    result: EvidenceMatchResult;
    evidenceTier: EvidenceTier;
    representationType: string | null;
  }>;
  goldEvidenceCount: number;
  /** GOLD 증거 중 matchType이 WEAK가 아닌(DIRECT/PARTIAL/COMPOSITE) 것의 개수. */
  goldMeaningfulEvidenceCount: number;
  silverEvidenceCount: number;
  csat: CsatRelevanceScoreResult;
  difficultyBand: FamilyDifficultyBand;
  approval: FamilyApprovalResult;
  /** MATHEMATICAL_CONSISTENCY 게이트에 실제로 사용된 판정값(리포트/디버깅용으로 노출). */
  hasConflictingRepresentationTypes: boolean;
}

export interface ComputeFamilyCalibrationOptions {
  curriculumNodesValid: boolean;
  duplicateOfAnotherFamilyCode: string | null;
  curriculumCentrality: number;
  referenceCoverageRatio: number;
  hasAnySilverEvidenceInCorpus: boolean;
  /** 결정사항: cross-node combinability 신호가 아직 없어 reasoning 차원은 0가중치로
   * 재분배함(호출부가 현재 항상 false로 전달). 향후 신호가 생기면 true로 전환. */
  hasReliableReasoningReusabilitySignal: boolean;
}

/**
 * `representationType` 값들을 "완전히 다른 문제 표현 방식" 그룹으로 나눈다(주석에 근거 명시).
 *
 * - SYMBOLIC(expression/equation/inequality): 그래프나 서술형 문맥 해석 없이 순수 기호 조작만으로
 *   풀리는 표현형.
 * - VISUAL(graph): 그래프를 직접 읽고 해석해야 풀리는 표현형.
 * - CONTEXTUAL(word_situation): 실생활 문맥을 수식으로 번역해야 풀리는 표현형.
 * - function_relation/mixed는 의도적으로 제외한다 — function_relation은 기호식·그래프 어느
 *   쪽으로도 나타날 수 있는 중립적 표현형이고, mixed는 이미 여러 표현형의 결합임을 스스로
 *   명시하므로 그 자체로 "모순 신호"가 아니다.
 */
const CONFLICT_GROUPS: ReadonlyArray<ReadonlySet<string>> = [
  new Set(["expression", "equation", "inequality"]),
  new Set(["graph"]),
  new Set(["word_situation"]),
];

/**
 * 같은 family에 증거로 매칭된 exam item들의 representationType이 서로 명백히 다른(위
 * `CONFLICT_GROUPS` 중 2개 이상에 걸치는) 경우 "수학적으로 모순되는 표현형이 섞였다"고
 * 판정하는 순수 함수. 하나의 family(동일한 추론 구조를 공유해야 함)가 그래프 판독형 문항과
 * 순수 기호 조작형 문항을 동시에 "같은 유형의 증거"로 갖는 것은 매칭 로직이 과도하게 넓게
 * 묶였다는 신호로 본다(단, 이 함수 자체는 매칭을 다시 하지 않고 이미 매칭된 representationType
 * 목록만 비교하는 순수 함수다).
 */
export function detectConflictingRepresentationTypes(representationTypes: readonly (string | null)[]): boolean {
  const groupsPresent = new Set<number>();
  for (const value of representationTypes) {
    if (value === null) continue;
    const groupIndex = CONFLICT_GROUPS.findIndex((group) => group.has(value));
    if (groupIndex !== -1) groupsPresent.add(groupIndex);
  }
  return groupsPresent.size >= 2;
}

/**
 * family 하나를 exam item 코퍼스(Gold + Silver, 있으면) 전체와 대조해 증거 매칭 →
 * 커리큘럼 호환성 가드 → CSAT 관련도 스코어링 → 난이도 병합 → 승인 게이트까지 한 번에
 * 계산한다. 순수 함수(DB/네트워크 접근 없음).
 */
export function computeFamilyCalibration(
  family: ProblemFamilyCandidateInput,
  examItems: readonly CalibrationExamItemInput[],
  options: ComputeFamilyCalibrationOptions,
): FamilyCalibrationComputation {
  // 커리큘럼 호환성 하드 가드: INCOMPATIBLE인 exam item은 증거 매칭 후보에서 아예 제외한다
  // (historicalCompatibilityGuard.ts의 단일 필터링 지점을 재사용).
  const compatibleItems = selectCompatibleExamItems(examItems);

  const evidence = compatibleItems
    .map((item) => ({
      examItemId: item.examItemId,
      evidenceTier: item.evidenceTier,
      representationType: item.representationType,
      result: matchFamilyToExamItem(
        {
          curriculumNodeCodes: family.curriculumNodeCodes ?? [],
          requiredSkills: family.requiredSkills ?? [],
          reasoningSignature: family.reasoningSignature,
          representationTypes: family.representationTypes ?? [],
        },
        {
          curriculumNodeCodes: item.curriculumNodeCodes,
          requiredSkills: item.requiredSkills,
          reasoningSignature: item.reasoningSignature,
          representationType: item.representationType,
          evidenceTier: item.evidenceTier,
        } satisfies EvidenceMatchingExamItemInput,
      ),
    }))
    .filter((entry) => entry.result.matchType !== "NONE");

  // MATHEMATICAL_CONSISTENCY 게이트 입력: 이 family에 실제로 매칭된(NONE이 아닌) 증거들의
  // representationType이 서로 명백히 모순되는 표현형 그룹에 걸쳐 있는지 실제로 계산한다
  // (이전에는 이 값이 항상 false로 하드코딩되어 있어 게이트가 절대 FAIL을 낼 수 없었다).
  const matchedRepresentationTypes = evidence.map((entry) => entry.representationType);
  const hasConflictingRepresentationTypes = detectConflictingRepresentationTypes(matchedRepresentationTypes);

  const goldEvidenceCount = evidence.filter((entry) => entry.evidenceTier === "GOLD_2028_SAMPLE").length;
  const goldMeaningfulEvidenceCount = evidence.filter(
    (entry) => entry.evidenceTier === "GOLD_2028_SAMPLE" && entry.result.matchType !== "WEAK",
  ).length;
  const silverEvidenceCount = evidence.filter((entry) => entry.evidenceTier === "SILVER_KICE").length;

  const goldEvidenceWeights = evidence
    .filter((entry) => entry.evidenceTier === "GOLD_2028_SAMPLE")
    .map((entry) => entry.result.evidenceWeight);
  const silverEvidenceWeights = evidence
    .filter((entry) => entry.evidenceTier === "SILVER_KICE")
    .map((entry) => entry.result.evidenceWeight);

  const csat = scoreFamilyCsatRelevance(
    {
      goldEvidenceWeights,
      silverEvidenceWeights,
      curriculumCentrality: options.curriculumCentrality,
      stage2Confidence: family.confidence,
      referenceCoverageRatio: options.referenceCoverageRatio,
    },
    {
      hasAnySilverEvidenceInCorpus: options.hasAnySilverEvidenceInCorpus,
      hasReliableReasoningReusabilitySignal: options.hasReliableReasoningReusabilitySignal,
    },
  );

  const goldDifficulties = compatibleItems
    .filter((item) =>
      evidence.some(
        (entry) =>
          entry.examItemId === item.examItemId &&
          entry.evidenceTier === "GOLD_2028_SAMPLE" &&
          (entry.result.matchType === "DIRECT" || entry.result.matchType === "PARTIAL"),
      ),
    )
    .map((item) =>
      estimateExamDifficulty({
        conceptLoad: item.conceptLoad,
        reasoningStepCount: item.reasoningStepCount,
        conditionInterpretationLoad: item.conditionInterpretationLoad,
        calculationLoad: item.calculationLoad,
        caseSplitRequired: item.caseSplitRequired,
        representationConversion: item.representationConversion,
        nonObviousTransformation: item.nonObviousTransformation,
      }).difficulty,
    );

  const difficultyBand = mergeDifficultyBand(
    family.approximateDifficultyMin,
    family.approximateDifficultyMax,
    goldDifficulties,
  );

  const approval = evaluateFamilyApproval({
    curriculumNodesValid: options.curriculumNodesValid,
    hasConflictingRepresentationTypes,
    duplicateOfAnotherFamilyCode: options.duplicateOfAnotherFamilyCode,
    goldEvidenceCount,
    goldMeaningfulEvidenceCount,
    silverEvidenceCount,
    stage2Confidence: family.confidence,
    stage2SourceItemCount: family.sourceItemCount,
    csatRelevanceLevel: csat.level,
    reasoningSignature: family.reasoningSignature,
    difficultyMin: difficultyBand.min,
    difficultyMax: difficultyBand.max,
  });

  return {
    candidateCode: family.candidateCode,
    evidence,
    goldEvidenceCount,
    goldMeaningfulEvidenceCount,
    silverEvidenceCount,
    csat,
    difficultyBand,
    approval,
    hasConflictingRepresentationTypes,
  };
}

export interface CoverageMetrics {
  /** Gold(in-scope) 문항 중 최소 하나 이상의 family와 매칭된 비율. */
  goldFamilyCoveragePercent: number;
  /** family의 requiredSkills 합집합 중 Gold 증거로 실제 확인된 스킬 비율. */
  goldSkillCoveragePercent: number;
  /** 어떤 family와도 매칭되지 않은 Gold(in-scope) 문항 수. */
  familyGapCount: number;
  /** 증거(Gold+Silver)가 하나도 없는 family 비율. */
  unsupportedFamilyRatePercent: number;
}

export function computeCoverageMetrics(
  families: readonly ProblemFamilyCandidateInput[],
  calibrations: readonly FamilyCalibrationComputation[],
  goldInScopeItems: readonly CalibrationExamItemInput[],
): CoverageMetrics {
  const matchedGoldItemIds = new Set(
    calibrations.flatMap((calibration) =>
      calibration.evidence.filter((e) => e.evidenceTier === "GOLD_2028_SAMPLE").map((e) => e.examItemId),
    ),
  );
  const goldFamilyCoveragePercent =
    goldInScopeItems.length === 0
      ? 0
      : Math.round((matchedGoldItemIds.size / goldInScopeItems.length) * 10_000) / 100;

  const allFamilySkills = new Set(families.flatMap((family) => family.requiredSkills ?? []));
  const evidencedSkills = new Set<string>();
  for (const calibration of calibrations) {
    if (calibration.goldEvidenceCount > 0) {
      const family = families.find((f) => f.candidateCode === calibration.candidateCode);
      for (const skill of family?.requiredSkills ?? []) evidencedSkills.add(skill);
    }
  }
  const goldSkillCoveragePercent =
    allFamilySkills.size === 0 ? 0 : Math.round((evidencedSkills.size / allFamilySkills.size) * 10_000) / 100;

  const familyGapCount = goldInScopeItems.filter((item) => !matchedGoldItemIds.has(item.examItemId)).length;

  const unsupportedCount = calibrations.filter((c) => c.goldEvidenceCount + c.silverEvidenceCount === 0).length;
  const unsupportedFamilyRatePercent =
    calibrations.length === 0 ? 0 : Math.round((unsupportedCount / calibrations.length) * 10_000) / 100;

  return { goldFamilyCoveragePercent, goldSkillCoveragePercent, familyGapCount, unsupportedFamilyRatePercent };
}

export function buildMergeProposalInputs(
  families: readonly ProblemFamilyCandidateInput[],
  calibrations: readonly FamilyCalibrationComputation[],
): FamilyDirectMatchRecord[] {
  const records: FamilyDirectMatchRecord[] = [];
  for (const calibration of calibrations) {
    const family = families.find((f) => f.candidateCode === calibration.candidateCode);
    if (!family) continue;
    for (const entry of calibration.evidence) {
      if (entry.result.matchType === "DIRECT") {
        records.push({
          familyCode: family.candidateCode,
          examItemId: entry.examItemId,
          requiredSkills: family.requiredSkills ?? [],
        });
      }
    }
  }
  return records;
}

export function buildSplitProposalInputs(
  families: readonly ProblemFamilyCandidateInput[],
  calibrations: readonly FamilyCalibrationComputation[],
  examItemsById: ReadonlyMap<string, CalibrationExamItemInput>,
): FamilyInternalEvidenceRecord[] {
  const records: FamilyInternalEvidenceRecord[] = [];
  for (const calibration of calibrations) {
    const family = families.find((f) => f.candidateCode === calibration.candidateCode);
    if (!family) continue;
    for (const entry of calibration.evidence) {
      const item = examItemsById.get(entry.examItemId);
      if (!item) continue;
      records.push({
        familyCode: family.candidateCode,
        examItemId: entry.examItemId,
        curriculumNodeCodes: item.curriculumNodeCodes,
        caseSplitRequired: item.caseSplitRequired,
      });
    }
  }
  return records;
}

export { detectMergeProposals, detectSplitProposals, classifyRelevanceLevel };
export type { MergeProposal, SplitProposal };
