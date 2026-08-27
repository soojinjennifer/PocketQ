import type { CurriculumNodeInput, CurriculumPrerequisiteInput } from "../curriculum/curriculumSourceSchema";

/**
 * family의 커리큘럼 노드가 교육과정 그래프에서 얼마나 "중심적"인지를 순수 함수로 계산한다.
 *
 * 이전 구현은 "커리큘럼 노드 코드가 유효한가"만 보는 이진 플래그(항상 1.0)였다 — 실질적인
 * 중심성 신호가 아니었다. 이 모듈은 다음 우선순위로 실제 신호를 찾는다:
 * 1. `csatImportance`(1~5, `curriculum_nodes` 소스에 수동 큐레이션된 값)가 하나라도 있으면
 *    그 최댓값/5를 쓴다(source: CSAT_IMPORTANCE) — 가장 신뢰도 높은 신호.
 * 2. 없으면 `curriculum_prerequisites` 그래프에서의 degree(해당 노드가 nodeCode 또는
 *    prerequisiteNodeCode로 등장하는 관계 수)를 전체 그래프 최대 degree로 정규화한다
 *    (source: PREREQUISITE_DEGREE). 전체 그래프 최대 degree가 0이면(선수관계 데이터 자체가
 *    없으면) 이 분기도 건너뛴다.
 * 3. 둘 다 없으면 결정사항: 근거 없음에 가점도 감점도 주지 않는 중립값 0.5를 돌려준다
 *    (source: NEUTRAL_FALLBACK).
 */
export type CurriculumCentralitySource = "CSAT_IMPORTANCE" | "PREREQUISITE_DEGREE" | "NEUTRAL_FALLBACK";

export interface CurriculumCentralityResult {
  value: number;
  source: CurriculumCentralitySource;
}

const NEUTRAL_FALLBACK_VALUE = 0.5;
const MAX_CSAT_IMPORTANCE = 5;

function computeDegreeByNodeCode(prerequisites: readonly CurriculumPrerequisiteInput[]): Map<string, number> {
  const degreeByNodeCode = new Map<string, number>();
  const increment = (code: string): void => {
    degreeByNodeCode.set(code, (degreeByNodeCode.get(code) ?? 0) + 1);
  };
  for (const prerequisite of prerequisites) {
    increment(prerequisite.nodeCode);
    increment(prerequisite.prerequisiteNodeCode);
  }
  return degreeByNodeCode;
}

/**
 * `nodeCodes`(family의 curriculumNodeCodes) 하나의 중심성을 계산한다. 같은 입력엔 항상 같은
 * 결과를 돌려주는 순수 함수(DB/네트워크 접근 없음).
 */
export function computeCurriculumCentrality(
  nodeCodes: readonly string[],
  nodesByCode: ReadonlyMap<string, CurriculumNodeInput>,
  prerequisites: readonly CurriculumPrerequisiteInput[],
): CurriculumCentralityResult {
  const csatImportanceValues = nodeCodes
    .map((code) => nodesByCode.get(code)?.csatImportance ?? null)
    .filter((value): value is number => value !== null);

  if (csatImportanceValues.length > 0) {
    const maxImportance = Math.max(...csatImportanceValues);
    return { value: maxImportance / MAX_CSAT_IMPORTANCE, source: "CSAT_IMPORTANCE" };
  }

  const degreeByNodeCode = computeDegreeByNodeCode(prerequisites);
  const maxDegreeInGraph = degreeByNodeCode.size === 0 ? 0 : Math.max(...degreeByNodeCode.values());

  if (maxDegreeInGraph > 0) {
    const degreesForNodes = nodeCodes.map((code) => degreeByNodeCode.get(code) ?? 0);
    const maxDegreeForNodes = degreesForNodes.length === 0 ? 0 : Math.max(...degreesForNodes);
    return { value: maxDegreeForNodes / maxDegreeInGraph, source: "PREREQUISITE_DEGREE" };
  }

  return { value: NEUTRAL_FALLBACK_VALUE, source: "NEUTRAL_FALLBACK" };
}
