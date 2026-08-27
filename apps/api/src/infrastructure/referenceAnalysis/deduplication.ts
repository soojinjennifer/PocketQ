/**
 * 두 문항의 추상화된 특징(feature)만 비교해 중복 여부를 분류하는 순수 함수 모듈.
 *
 * 중요: 임베딩/텍스트 유사도만으로 자동 병합하지 않는다 — 이 함수는 판단 "근거"를 만들 뿐,
 * 실제로 문항을 합치거나 DB 행을 지우는 어떤 동작도 하지 않는다(호출부도 delete를 하지 않음).
 * `contentFingerprint`(선택)는 로컬 캐시 텍스트에서만 계산하는 해시로, DB 컬럼에는
 * 저장하지 않는 임시 비교용 값이다(원문 자체가 아니므로 저장해도 저작권 문제는 없지만,
 * Stage 2 스키마에 이 필드가 없으므로 애초에 영속화하지 않는다).
 */
export type DedupClassification =
  | "EXACT_DUP"
  | "APPROX_DUP"
  | "SAME_REASONING_DIFFERENT_SURFACE"
  | "SIMILAR_SURFACE_DIFFERENT_REASONING";

export interface DedupItemInput {
  localItemKey: string;
  primaryConcept: string | null;
  reasoningPattern: string | null;
  representationType: string | null;
  requiredSkills: string[] | null;
  conditionCount: number | null;
  answerFormat: string | null;
  transformationPattern: string[] | null;
  /** 로컬 전용 비교용 fingerprint. DB에는 절대 저장하지 않는다. */
  contentFingerprint?: string | null;
}

export interface DedupResult {
  classification: DedupClassification;
  evidence: string;
}

function normalize(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

function sortedEqual(a: string[] | null, b: string[] | null): boolean {
  const left = [...(a ?? [])].map(normalize).sort();
  const right = [...(b ?? [])].map(normalize).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * 두 문항 feature를 비교해 4분류 중 하나로 판정하고, 사람이 검토할 수 있는 근거 문자열을
 * 함께 돌려준다. 같은 입력엔 항상 같은 결과(순수 함수, DB/네트워크 접근 없음).
 */
export function classifyItemPair(a: DedupItemInput, b: DedupItemInput): DedupResult {
  if (a.contentFingerprint != null && a.contentFingerprint === b.contentFingerprint) {
    return {
      classification: "EXACT_DUP",
      evidence: `로컬 fingerprint가 동일합니다(${a.localItemKey} ≡ ${b.localItemKey}). 같은 원문일 가능성이 매우 높습니다.`,
    };
  }

  const sameConcept = normalize(a.primaryConcept) === normalize(b.primaryConcept);
  const sameReasoningPattern = normalize(a.reasoningPattern) === normalize(b.reasoningPattern);
  const sameReasoning = sameConcept && sameReasoningPattern;
  const sameRepresentation = normalize(a.representationType) === normalize(b.representationType);
  const sameSkills = sortedEqual(a.requiredSkills, b.requiredSkills);
  const sameConditionCount = a.conditionCount === b.conditionCount;
  const sameAnswerFormat = normalize(a.answerFormat) === normalize(b.answerFormat);
  const sameTransformation = sortedEqual(a.transformationPattern, b.transformationPattern);

  if (
    sameReasoning &&
    sameRepresentation &&
    sameSkills &&
    sameConditionCount &&
    sameAnswerFormat &&
    sameTransformation
  ) {
    return {
      classification: "APPROX_DUP",
      evidence:
        "개념/추론 패턴/표현 형태/필요 스킬/조건 개수/정답 형식/변환 패턴이 모두 동일합니다 " +
        "(표면 문구(구체적 수치 등)만 다를 가능성이 높습니다).",
    };
  }

  if (sameReasoning) {
    return {
      classification: "SAME_REASONING_DIFFERENT_SURFACE",
      evidence: "핵심 개념과 추론 패턴은 같지만 표현 형태/조건 등 표면 요소가 다릅니다.",
    };
  }

  if (sameRepresentation && sameAnswerFormat) {
    return {
      classification: "SIMILAR_SURFACE_DIFFERENT_REASONING",
      evidence: "표현 형태/정답 형식은 비슷하지만 핵심 개념 또는 추론 패턴이 다릅니다.",
    };
  }

  return {
    classification: "SIMILAR_SURFACE_DIFFERENT_REASONING",
    evidence: "뚜렷한 공통 추론 구조가 확인되지 않아 보수적으로 분류합니다(자동 병합 금지).",
  };
}
