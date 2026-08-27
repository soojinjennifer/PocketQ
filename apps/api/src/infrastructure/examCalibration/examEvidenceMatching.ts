import type { EvidenceTier } from "./examReferenceSetSchema";
import type { EvidenceMatchType } from "./problemFamilyEvidenceSchema";

/**
 * family(problem_family_candidates)와 exam item(exam_item_features) 사이의 증거 매칭을
 * 판정하는 순수 함수 모듈.
 *
 * 중요: 텍스트 유사도 단독으로 매치 판정을 하지 않는다 — 커리큘럼 노드 겹침(하드 게이트),
 * 필요 스킬 Jaccard, 추론 서명 토큰 Jaccard, 표현 형태 일치 등 "구조화된 증거"만 사용한다.
 * family/exam item 어느 쪽도 문항 원문을 담지 않으므로 애초에 원문 비교가 불가능한 구조다.
 */
export interface EvidenceMatchingFamilyInput {
  curriculumNodeCodes: string[];
  requiredSkills: string[];
  /** Stage 2 `family_signature`(예: "개념|추론패턴|표현형태|skill+skill|cond:0-1"). */
  reasoningSignature: string;
  representationTypes: string[];
}

export interface EvidenceMatchingExamItemInput {
  curriculumNodeCodes: string[];
  requiredSkills: string[];
  reasoningSignature: string | null;
  representationType: string | null;
  evidenceTier: EvidenceTier;
}

export interface EvidenceMatchResult {
  matchType: EvidenceMatchType;
  structuralSimilarity: number;
  skillOverlap: number;
  reasoningOverlap: number;
  /** (matchType, evidenceTier) 조합의 고정 함수. matchType이 NONE이면 항상 0. */
  evidenceWeight: number;
}

/** 콤보 스코어 → matchType 컷오프(초안, 조정 가능). */
const DIRECT_CUTOFF = 0.75;
const PARTIAL_CUTOFF = 0.5;
const COMPOSITE_CUTOFF = 0.3;

/** 콤보 스코어 가중치(초안, 조정 가능). 세 축을 골고루 반영하되 추론 서명에 가장 큰 비중. */
const COMBO_WEIGHTS = { skillOverlap: 0.35, reasoningOverlap: 0.45, structuralSimilarity: 0.2 } as const;

/** matchType별 기본 가중치(초안, 조정 가능). NONE은 항상 0. */
const MATCH_TYPE_BASE_WEIGHT: Record<EvidenceMatchType, number> = {
  DIRECT: 1.0,
  PARTIAL: 0.7,
  COMPOSITE: 0.5,
  WEAK: 0.25,
  NONE: 0,
};

/**
 * 증거 등급(tier) 배율. GOLD가 SILVER/REFERENCE_OTHER보다 가중치 상한이 항상 높도록
 * (동일 matchType 기준) 배율 자체를 더 크게 둔다.
 */
const EVIDENCE_TIER_MULTIPLIER: Record<EvidenceTier, number> = {
  GOLD_2028_SAMPLE: 1.0,
  SILVER_KICE: 0.7,
  REFERENCE_OTHER: 0.4,
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function tokenize(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[^a-z0-9가-힣]+/i)
    .map(normalizeToken)
    .filter((token) => token.length > 0);
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a.map(normalizeToken));
  const setB = new Set(b.map(normalizeToken));
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * `subset`이 `supersetCandidate`에 얼마나 포함되는지(방향성 있는 겹침 비율).
 * exam item의 짧은 reasoningSignature 토큰이 family의 넓은 합성 signature(개념/스킬/조건
 * 구간까지 포함하는 문자열)에 얼마나 실려 있는지를 재는 데 쓴다 — 대칭 Jaccard로는 family
 * signature에 섞인 다른 서술어들이 분모를 부풀려 매치를 과소평가하게 되기 때문이다.
 */
function containmentRatio(subset: readonly string[], supersetCandidate: readonly string[]): number {
  const subsetSet = new Set(subset.map(normalizeToken));
  if (subsetSet.size === 0) return 0;
  const supersetSet = new Set(supersetCandidate.map(normalizeToken));

  let contained = 0;
  for (const value of subsetSet) {
    if (supersetSet.has(value)) contained += 1;
  }
  return contained / subsetSet.size;
}

/**
 * 커리큘럼 노드가 최소 1개도 안 겹치면 무조건 통과 실패(하드 게이트). 이 게이트를 통과하지
 * 못하면 다른 어떤 유사도 점수도 계산하지 않고 바로 NONE으로 분류해야 한다.
 */
export function passesCurriculumOverlapGate(
  familyNodeCodes: readonly string[],
  examItemNodeCodes: readonly string[],
): boolean {
  const itemSet = new Set(examItemNodeCodes.map(normalizeToken));
  return familyNodeCodes.some((code) => itemSet.has(normalizeToken(code)));
}

/**
 * family 하나와 exam item 하나 사이의 증거 매칭을 판정한다. 같은 입력엔 항상 같은 결과를
 * 돌려주는 순수 함수(DB/네트워크 접근 없음).
 */
export function matchFamilyToExamItem(
  family: EvidenceMatchingFamilyInput,
  examItem: EvidenceMatchingExamItemInput,
): EvidenceMatchResult {
  if (!passesCurriculumOverlapGate(family.curriculumNodeCodes, examItem.curriculumNodeCodes)) {
    return { matchType: "NONE", structuralSimilarity: 0, skillOverlap: 0, reasoningOverlap: 0, evidenceWeight: 0 };
  }

  const skillOverlap = jaccard(family.requiredSkills, examItem.requiredSkills);
  const reasoningOverlap = containmentRatio(tokenize(examItem.reasoningSignature), tokenize(family.reasoningSignature));
  const representationMatch =
    examItem.representationType !== null && family.representationTypes.includes(examItem.representationType) ? 1 : 0;
  // 결정사항: 커리큘럼 노드 겹침(nodeOverlapRatio)은 커리큘럼 하드 게이트에서 이미 사용된
  // 신호이므로 structuralSimilarity에서 다시 반영하지 않는다(하드 게이트 통과 자체가 실질적인
  // 스킬/추론 겹침 없이 WEAK 매치로 이어지는 것을 막기 위함). representationMatch만 남긴다.
  const structuralSimilarity = representationMatch;

  const comboScore =
    skillOverlap * COMBO_WEIGHTS.skillOverlap +
    reasoningOverlap * COMBO_WEIGHTS.reasoningOverlap +
    structuralSimilarity * COMBO_WEIGHTS.structuralSimilarity;

  const matchType = classifyComboScore(comboScore, skillOverlap, reasoningOverlap);
  const evidenceWeight = computeEvidenceWeight(matchType, examItem.evidenceTier);

  return { matchType, structuralSimilarity, skillOverlap, reasoningOverlap, evidenceWeight };
}

function classifyComboScore(comboScore: number, skillOverlap: number, reasoningOverlap: number): EvidenceMatchType {
  // 하드 규칙: 스킬/추론 겹침이 둘 다 0이면(구조적 유사성만 있는 경우) comboScore/임계값과
  // 무관하게 무조건 NONE이다 — 커리큘럼 노드만 겹치는 exam item이 실질적 근거 없이 WEAK로
  // 잡히는 것을 막기 위한 결함 수정.
  const hasRealSkillOrReasoningSignal = skillOverlap > 0 || reasoningOverlap > 0;
  if (!hasRealSkillOrReasoningSignal) return "NONE";

  if (comboScore >= DIRECT_CUTOFF) return "DIRECT";
  if (comboScore >= PARTIAL_CUTOFF) return "PARTIAL";
  if (comboScore >= COMPOSITE_CUTOFF) return "COMPOSITE";
  if (comboScore > 0) return "WEAK";
  return "NONE";
}

/** (matchType, evidenceTier) 조합의 고정 함수. GOLD가 SILVER보다 가중치 상한이 항상 높다. */
export function computeEvidenceWeight(matchType: EvidenceMatchType, evidenceTier: EvidenceTier): number {
  if (matchType === "NONE") return 0;
  const weight = MATCH_TYPE_BASE_WEIGHT[matchType] * EVIDENCE_TIER_MULTIPLIER[evidenceTier];
  return Math.round(weight * 100) / 100;
}
