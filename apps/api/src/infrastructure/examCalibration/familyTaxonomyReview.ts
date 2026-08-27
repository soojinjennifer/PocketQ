/**
 * family taxonomy(패밀리 분류 체계) 검토 — 순수 함수 모듈.
 *
 * 여기서 만든 어떤 함수도 `problem_family_candidates` 행을 자동으로 병합/분할/재작성하지
 * 않는다 — 오직 사람이 검토할 "제안"(리포트용 데이터)만 만든다.
 */

/** Merge 후보 판단에 쓰는 매치 정보(같은 Gold 항목에 대한 family별 DIRECT 매치 여부). */
export interface FamilyDirectMatchRecord {
  familyCode: string;
  examItemId: string;
  requiredSkills: string[];
}

export interface MergeProposal {
  familyCodeA: string;
  familyCodeB: string;
  sharedExamItemIds: string[];
  skillOverlap: number;
  reason: string;
}

/** Merge 제안 컷오프(초안, 조정 가능): 스킬 Jaccard가 이 값 이상이면 병합 후보로 본다. */
const MERGE_SKILL_OVERLAP_THRESHOLD = 0.5;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function jaccard(a: readonly string[], b: readonly string[]): number {
  const setA = new Set(a.map(normalize));
  const setB = new Set(b.map(normalize));
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const value of setA) {
    if (setB.has(value)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * 같은 Gold 항목에 서로 다른 family 둘 다 DIRECT 매치되고, 두 family의 필요 스킬 집합이
 * 충분히 겹치면(Jaccard ≥ 컷오프) MergeProposal을 만든다. 입력은 이미 "DIRECT 매치인
 * 레코드만" 걸러서 전달해야 한다(호출부 책임 — 이 함수는 matchType을 직접 필터링하지 않는다).
 */
export function detectMergeProposals(directMatchRecords: readonly FamilyDirectMatchRecord[]): MergeProposal[] {
  const recordsByExamItem = new Map<string, FamilyDirectMatchRecord[]>();
  for (const record of directMatchRecords) {
    const bucket = recordsByExamItem.get(record.examItemId);
    if (bucket) {
      bucket.push(record);
    } else {
      recordsByExamItem.set(record.examItemId, [record]);
    }
  }

  const sharedItemsByPair = new Map<string, { familyCodeA: string; familyCodeB: string; examItemIds: Set<string> }>();

  for (const [examItemId, records] of recordsByExamItem) {
    const distinctFamilies = new Map<string, FamilyDirectMatchRecord>();
    for (const record of records) {
      // 같은 family가 같은 examItemId에 중복 기록되는 경우를 방지한다.
      distinctFamilies.set(record.familyCode, record);
    }
    const familyCodes = Array.from(distinctFamilies.keys()).sort();

    for (let i = 0; i < familyCodes.length; i += 1) {
      for (let j = i + 1; j < familyCodes.length; j += 1) {
        const pairKey = `${familyCodes[i]}::${familyCodes[j]}`;
        const existing = sharedItemsByPair.get(pairKey);
        if (existing) {
          existing.examItemIds.add(examItemId);
        } else {
          sharedItemsByPair.set(pairKey, {
            familyCodeA: familyCodes[i]!,
            familyCodeB: familyCodes[j]!,
            examItemIds: new Set([examItemId]),
          });
        }
      }
    }
  }

  const proposals: MergeProposal[] = [];
  for (const { familyCodeA, familyCodeB, examItemIds } of sharedItemsByPair.values()) {
    const recordA = directMatchRecords.find((record) => record.familyCode === familyCodeA);
    const recordB = directMatchRecords.find((record) => record.familyCode === familyCodeB);
    const skillOverlap = jaccard(recordA?.requiredSkills ?? [], recordB?.requiredSkills ?? []);

    if (skillOverlap >= MERGE_SKILL_OVERLAP_THRESHOLD) {
      proposals.push({
        familyCodeA,
        familyCodeB,
        sharedExamItemIds: Array.from(examItemIds).sort(),
        skillOverlap,
        reason: `두 family가 같은 Gold 항목 ${examItemIds.size}건에 모두 DIRECT 매치되고 필요 스킬 겹침(${skillOverlap})이 컷오프(${MERGE_SKILL_OVERLAP_THRESHOLD}) 이상입니다.`,
      });
    }
  }

  return proposals;
}

/** Split 후보 판단에 쓰는 family 내부 evidence 항목 하나. */
export interface FamilyInternalEvidenceRecord {
  familyCode: string;
  examItemId: string;
  curriculumNodeCodes: string[];
  caseSplitRequired: boolean;
}

export interface SplitProposal {
  familyCode: string;
  groups: Array<{ groupKey: string; examItemIds: string[] }>;
  reason: string;
}

/** Split 제안 시 각 그룹이 최소 이 개수 이상이어야 한다(초안, 조정 가능). */
const MIN_SPLIT_GROUP_SIZE = 2;

function buildGroupKey(record: FamilyInternalEvidenceRecord): string {
  const sortedNodes = [...record.curriculumNodeCodes].sort().join("+");
  return `nodes:${sortedNodes || "unknown"}|case_split:${record.caseSplitRequired}`;
}

/**
 * family 하나의 내부 evidence가 커리큘럼 노드 조합/케이스 분류 요구 여부로 뚜렷이 갈리면
 * SplitProposal을 만든다. 그룹이 2개 미만이거나 어느 그룹이든 최소 크기 미만이면 제안하지
 * 않는다(우연한 소수 사례로 분할을 제안하지 않기 위함).
 */
export function detectSplitProposals(evidenceRecords: readonly FamilyInternalEvidenceRecord[]): SplitProposal[] {
  const byFamily = new Map<string, FamilyInternalEvidenceRecord[]>();
  for (const record of evidenceRecords) {
    const bucket = byFamily.get(record.familyCode);
    if (bucket) {
      bucket.push(record);
    } else {
      byFamily.set(record.familyCode, [record]);
    }
  }

  const proposals: SplitProposal[] = [];

  for (const [familyCode, records] of byFamily) {
    const groupsByKey = new Map<string, string[]>();
    for (const record of records) {
      const key = buildGroupKey(record);
      const bucket = groupsByKey.get(key);
      if (bucket) {
        bucket.push(record.examItemId);
      } else {
        groupsByKey.set(key, [record.examItemId]);
      }
    }

    const groups = Array.from(groupsByKey.entries()).map(([groupKey, examItemIds]) => ({ groupKey, examItemIds }));
    const allGroupsMeetMinSize = groups.every((group) => group.examItemIds.length >= MIN_SPLIT_GROUP_SIZE);

    if (groups.length >= 2 && allGroupsMeetMinSize) {
      proposals.push({
        familyCode,
        groups,
        reason: `family 내부 evidence가 커리큘럼 노드 조합/케이스 분류 요구 여부에 따라 ${groups.length}개 그룹으로 뚜렷이 갈립니다.`,
      });
    }
  }

  return proposals;
}
