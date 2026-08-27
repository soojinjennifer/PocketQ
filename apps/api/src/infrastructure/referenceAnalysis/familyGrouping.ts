/**
 * `family_signature` 계산 + 문제 패밀리 그룹화를 담당하는 순수 함수 모듈.
 *
 * 그룹화 기준은 항상 "추론 구조"(개념/추론 패턴/표현 형태/필요 스킬/조건 개수 구간)이며,
 * 문항 원문의 표면적 유사성(명사·숫자만 다른 경우)만으로 묶지 않는다 — 애초에 원문 자체를
 * 입력으로 받지 않는 구조라 표면 유사성으로 묶는 것 자체가 불가능하다.
 */
export interface FamilyGroupingItemInput {
  localItemKey: string;
  primaryConcept: string | null;
  reasoningPattern: string | null;
  representationType: string | null;
  requiredSkills: string[] | null;
  conditionCount: number | null;
}

export interface FamilyGroup {
  familySignature: string;
  items: FamilyGroupingItemInput[];
}

function normalizeToken(value: string | null): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, "_");
}

/** 조건 개수를 구간으로 뭉뚱그려, 조건 1개 차이 때문에 같은 패밀리가 갈리지 않게 한다. */
function bucketConditionCount(conditionCount: number | null): string {
  if (conditionCount === null) return "cond:unknown";
  if (conditionCount <= 1) return "cond:0-1";
  if (conditionCount <= 3) return "cond:2-3";
  return "cond:4+";
}

/**
 * `primary_concept + reasoning_pattern + representation_type + 정렬된 required_skills +
 * condition_count 구간`을 정규화한 문자열. 같은 입력엔 항상 같은 결과(순수 함수).
 */
export function buildFamilySignature(item: FamilyGroupingItemInput): string {
  const concept = normalizeToken(item.primaryConcept);
  const reasoning = normalizeToken(item.reasoningPattern);
  const representation = normalizeToken(item.representationType);
  const skills = [...(item.requiredSkills ?? [])].map(normalizeToken).sort().join("+");
  const conditionBucket = bucketConditionCount(item.conditionCount);
  return [concept, reasoning, representation, skills, conditionBucket].join("|");
}

/** `family_signature`가 같은 문항들을 그룹으로 묶는다(순수 함수, 원본 배열 순서 보존). */
export function groupItemsIntoFamilies(items: FamilyGroupingItemInput[]): FamilyGroup[] {
  const order: string[] = [];
  const groups = new Map<string, FamilyGroupingItemInput[]>();

  for (const item of items) {
    const signature = buildFamilySignature(item);
    const existing = groups.get(signature);
    if (existing) {
      existing.push(item);
    } else {
      groups.set(signature, [item]);
      order.push(signature);
    }
  }

  return order.map((signature) => ({ familySignature: signature, items: groups.get(signature)! }));
}
