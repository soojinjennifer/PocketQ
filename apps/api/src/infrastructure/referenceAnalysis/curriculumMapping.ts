import type { CurriculumNodeInput, CurriculumSource } from "../curriculum/curriculumSourceSchema";

/**
 * 참고자료 문항에 큐레이터가 부여한 커리큘럼 노드 후보를, Stage 1 `algebra.v1.json` 등
 * 실제 교육과정 그래프(`loadCurriculumSource` 결과)와 대조해 분류하는 순수 함수 모듈.
 * 매핑이 안 되는 코드는 새 커리큘럼 노드를 만들지 않고 "커리큘럼 갭 후보"로만 보고한다.
 */
export type CurriculumMappingClassification = "EXACT" | "MULTI_NODE" | "UNCERTAIN" | "OUT_OF_SCOPE";

export interface CurriculumMappingResult {
  classification: CurriculumMappingClassification;
  /** 커리큘럼 그래프에 실존이 확인된 코드만. */
  resolvedNodeCodes: string[];
  /** 커리큘럼 그래프에 없는 코드(커리큘럼 갭 후보). */
  unresolvedNodeCodes: string[];
  reason: string;
}

/** `CONCEPT`/`SKILL`처럼 세밀한(leaf에 가까운) 노드 타입만 EXACT 매핑으로 인정한다. */
const PRECISE_NODE_TYPES = new Set(["CONCEPT", "SKILL"]);

export function buildCurriculumNodeIndex(source: CurriculumSource): Map<string, CurriculumNodeInput> {
  return new Map(source.nodes.map((node) => [node.code, node]));
}

/**
 * 문항 하나에 부여된 커리큘럼 노드 코드 후보 목록을 분류한다. 같은 입력엔 항상 같은
 * 결과를 돌려주는 순수 함수(DB/파일시스템 접근 없음).
 */
export function classifyCurriculumMapping(
  candidateNodeCodes: string[],
  nodesByCode: Map<string, CurriculumNodeInput>,
): CurriculumMappingResult {
  if (candidateNodeCodes.length === 0) {
    return {
      classification: "OUT_OF_SCOPE",
      resolvedNodeCodes: [],
      unresolvedNodeCodes: [],
      reason: "커리큘럼 노드 후보가 지정되지 않았습니다.",
    };
  }

  const resolvedNodeCodes = candidateNodeCodes.filter((code) => nodesByCode.has(code));
  const unresolvedNodeCodes = candidateNodeCodes.filter((code) => !nodesByCode.has(code));

  if (resolvedNodeCodes.length === 0) {
    return {
      classification: "OUT_OF_SCOPE",
      resolvedNodeCodes,
      unresolvedNodeCodes,
      reason: `후보 코드가 모두 커리큘럼 그래프에 존재하지 않습니다(커리큘럼 갭 후보): ${unresolvedNodeCodes.join(", ")}`,
    };
  }

  if (resolvedNodeCodes.length >= 2) {
    return {
      classification: "MULTI_NODE",
      resolvedNodeCodes,
      unresolvedNodeCodes,
      reason: `여러 노드에 걸쳐 있습니다: ${resolvedNodeCodes.join(", ")}`,
    };
  }

  const onlyCode = resolvedNodeCodes[0]!;
  const node = nodesByCode.get(onlyCode)!;
  if (PRECISE_NODE_TYPES.has(node.nodeType)) {
    return {
      classification: "EXACT",
      resolvedNodeCodes,
      unresolvedNodeCodes,
      reason: `${onlyCode}(${node.nodeType})에 정확히 매핑됩니다.`,
    };
  }

  return {
    classification: "UNCERTAIN",
    resolvedNodeCodes,
    unresolvedNodeCodes,
    reason:
      `${onlyCode}(${node.nodeType})까지만 매핑되고, 그보다 세밀한 CONCEPT/SKILL 노드가 ` +
      "아직 커리큘럼 그래프에 없습니다(커리큘럼 갭 후보).",
  };
}
