import type {
  CurriculumNodeInput,
  CurriculumNodeType,
  CurriculumPrerequisiteInput,
} from "./curriculumSourceSchema";

export interface CurriculumGraphInput {
  subject: string;
  nodes: CurriculumNodeInput[];
  prerequisites: CurriculumPrerequisiteInput[];
}

export interface CurriculumGraphValidationResult {
  errors: string[];
  warnings: string[];
}

/**
 * SUBJECT(0) < UNIT(1) < SUBUNIT(2) < CONCEPT(3) < SKILL(4).
 * 부모는 자식보다 정확히 한 단계 위 타입이어야 한다(단계 건너뛰기 금지).
 */
const NODE_TYPE_ORDER: Record<CurriculumNodeType, number> = {
  SUBJECT: 0,
  UNIT: 1,
  SUBUNIT: 2,
  CONCEPT: 3,
  SKILL: 4,
};

/**
 * 교육과정 JSON 소스 하나(과목 하나)의 노드/선수관계 그래프 정합성을 검사하는 순수 함수.
 * DB나 파일시스템에 접근하지 않으며 같은 입력엔 항상 같은 결과를 돌려준다.
 *
 * 검사 항목: 중복 code / 부모 누락 / orphan(루트에서 도달 불가) / 계층 순서 위반 /
 * 과목 경계 불일치 / 선수관계의 자기참조·중복·정의되지 않은 노드 참조·순환(DFS) /
 * 범위 밖 값(1~5) / 필수 필드 누락.
 */
export function validateCurriculumGraph(input: CurriculumGraphInput): CurriculumGraphValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { nodes, prerequisites } = input;

  // 1. 필수 필드 누락 + 범위 밖 값
  for (const node of nodes) {
    if (!node.code || !node.name || !node.nodeType || !node.curriculumVersion || !node.subject) {
      errors.push(`필수 필드 누락: code=${node.code || "(빈 값)"}`);
    }
    if (node.csatImportance !== null && (node.csatImportance < 1 || node.csatImportance > 5)) {
      errors.push(`범위 밖 값: ${node.code}.csatImportance=${node.csatImportance} (1~5 허용)`);
    }
    if (node.difficultyBase !== null && (node.difficultyBase < 1 || node.difficultyBase > 5)) {
      errors.push(`범위 밖 값: ${node.code}.difficultyBase=${node.difficultyBase} (1~5 허용)`);
    }
  }

  // 2. 중복 code
  const seenCodes = new Set<string>();
  const duplicateCodes = new Set<string>();
  for (const node of nodes) {
    if (seenCodes.has(node.code)) {
      duplicateCodes.add(node.code);
      errors.push(`중복 code: ${node.code}`);
    }
    seenCodes.add(node.code);
  }

  const nodeByCode = new Map<string, CurriculumNodeInput>();
  for (const node of nodes) {
    if (!duplicateCodes.has(node.code)) {
      nodeByCode.set(node.code, node);
    }
  }

  // 3. 부모 누락 / 계층 순서 위반 / 과목 경계 불일치 / SUBJECT 루트 개수
  const subjectRoots: CurriculumNodeInput[] = [];
  for (const node of nodes) {
    if (duplicateCodes.has(node.code)) continue;

    if (node.nodeType === "SUBJECT") {
      subjectRoots.push(node);
      if (node.parentCode !== null) {
        errors.push(`계층 순서 위반: SUBJECT 노드(${node.code})는 부모를 가질 수 없습니다.`);
      }
      continue;
    }

    if (node.parentCode === null) {
      errors.push(`부모 누락: ${node.code}는 SUBJECT가 아니지만 parentCode가 없습니다.`);
      continue;
    }

    const parent = nodeByCode.get(node.parentCode);
    if (!parent) {
      errors.push(`부모 누락: ${node.code}의 parentCode(${node.parentCode})에 해당하는 노드가 없습니다.`);
      continue;
    }

    const expectedParentOrder = NODE_TYPE_ORDER[node.nodeType] - 1;
    if (NODE_TYPE_ORDER[parent.nodeType] !== expectedParentOrder) {
      errors.push(
        `계층 순서 위반: ${node.code}(${node.nodeType})의 부모 ${parent.code}(${parent.nodeType})는 한 단계 위 노드타입이어야 합니다.`,
      );
    }

    if (parent.subject !== node.subject) {
      errors.push(
        `과목 경계 불일치: ${node.code}(subject=${node.subject})의 부모 ${parent.code}(subject=${parent.subject})와 과목이 다릅니다.`,
      );
    }
  }

  if (subjectRoots.length === 0) {
    errors.push("SUBJECT 루트 노드가 없습니다.");
  } else if (subjectRoots.length > 1) {
    errors.push(`SUBJECT 루트 노드가 ${subjectRoots.length}개입니다(1개여야 합니다).`);
  }

  // 4. orphan: SUBJECT 루트에서 도달 불가능한 노드(부모는 존재하지만 체인이 결국
  //    루트에 닿지 않는 경우, 예: 서로를 부모로 참조하는 순환 구조).
  const firstSubjectRoot = subjectRoots[0];
  if (subjectRoots.length === 1 && firstSubjectRoot) {
    const root = firstSubjectRoot;
    const childrenByParent = new Map<string, CurriculumNodeInput[]>();
    for (const node of nodeByCode.values()) {
      if (node.parentCode === null) continue;
      const list = childrenByParent.get(node.parentCode) ?? [];
      list.push(node);
      childrenByParent.set(node.parentCode, list);
    }

    const reachable = new Set<string>();
    const queue: string[] = [root.code];
    while (queue.length > 0) {
      const code = queue.shift();
      if (code === undefined || reachable.has(code)) continue;
      reachable.add(code);
      for (const child of childrenByParent.get(code) ?? []) {
        queue.push(child.code);
      }
    }

    for (const node of nodeByCode.values()) {
      if (!reachable.has(node.code)) {
        errors.push(`orphan 노드: ${node.code}는 SUBJECT 루트(${root.code})에서 도달할 수 없습니다.`);
      }
    }
  }

  // 5. 선수관계: 자기참조 / 중복 / 정의되지 않은 노드 참조 / 순환(DFS)
  const seenPrerequisitePairs = new Set<string>();
  const adjacency = new Map<string, string[]>();

  for (const prerequisite of prerequisites) {
    if (!prerequisite.nodeCode || !prerequisite.prerequisiteNodeCode) {
      errors.push("필수 필드 누락: 선수관계에 nodeCode 또는 prerequisiteNodeCode가 없습니다.");
      continue;
    }

    if (prerequisite.nodeCode === prerequisite.prerequisiteNodeCode) {
      errors.push(`자기참조 선수관계: ${prerequisite.nodeCode}`);
      continue;
    }

    const pairKey = `${prerequisite.nodeCode}::${prerequisite.prerequisiteNodeCode}`;
    if (seenPrerequisitePairs.has(pairKey)) {
      errors.push(`중복 선수관계: ${prerequisite.nodeCode} -> ${prerequisite.prerequisiteNodeCode}`);
      continue;
    }
    seenPrerequisitePairs.add(pairKey);

    if (!nodeByCode.has(prerequisite.nodeCode) || !nodeByCode.has(prerequisite.prerequisiteNodeCode)) {
      errors.push(
        `정의되지 않은 노드 참조: ${prerequisite.nodeCode} -> ${prerequisite.prerequisiteNodeCode}`,
      );
      continue;
    }

    const list = adjacency.get(prerequisite.nodeCode) ?? [];
    list.push(prerequisite.prerequisiteNodeCode);
    adjacency.set(prerequisite.nodeCode, list);
  }

  const cycle = findCycle(adjacency);
  if (cycle) {
    errors.push(`순환 선수관계: ${cycle.join(" -> ")}`);
  }

  return { errors, warnings };
}

/** DFS + 재귀 스택으로 사이클을 찾는다. 찾으면 사이클 경로(코드 배열)를, 없으면 null을 반환한다. */
function findCycle(adjacency: Map<string, string[]>): string[] | null {
  const visited = new Set<string>();
  const stack: string[] = [];
  const onStack = new Set<string>();

  function dfs(code: string): string[] | null {
    visited.add(code);
    onStack.add(code);
    stack.push(code);

    for (const next of adjacency.get(code) ?? []) {
      if (!visited.has(next)) {
        const found = dfs(next);
        if (found) return found;
      } else if (onStack.has(next)) {
        const cycleStart = stack.indexOf(next);
        return [...stack.slice(cycleStart), next];
      }
    }

    stack.pop();
    onStack.delete(code);
    return null;
  }

  for (const code of adjacency.keys()) {
    if (!visited.has(code)) {
      const found = dfs(code);
      if (found) return found;
    }
  }

  return null;
}
