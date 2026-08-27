import { describe, expect, it } from "vitest";
import { CURRICULUM_SOURCE_PATHS, loadCurriculumSource } from "./loadCurriculumSource";

/**
 * `data/math-curriculum/*.v1.json` 실제 데이터 파일을 로드해서 스키마 파싱과
 * 그래프 검증(validateCurriculumGraph)을 모두 통과하는지 확인하는 회귀 테스트.
 * 콘텐츠 자체(오너가 채운 노드/선수관계)가 깨지지 않았는지 지켜주는 역할이다.
 */
describe("loadCurriculumSource", () => {
  it.each([
    ["algebra", CURRICULUM_SOURCE_PATHS.algebra, "ALG"],
    ["calculus1", CURRICULUM_SOURCE_PATHS.calculus1, "CALC1"],
  ])("%s 소스는 스키마+그래프 검증을 통과한다", (_label, relativePath, expectedSubject) => {
    const { source, validation } = loadCurriculumSource(relativePath);

    expect(source.subject).toBe(expectedSubject);
    expect(source.sourceId).toBeNull();
    expect(source.nodes.length).toBeGreaterThan(0);
    expect(validation.errors).toEqual([]);
  });

  it("algebra 소스에는 SUBJECT/UNIT/SUBUNIT/CONCEPT가 최소 하나씩 존재한다", () => {
    const { source } = loadCurriculumSource(CURRICULUM_SOURCE_PATHS.algebra);
    const nodeTypes = new Set(source.nodes.map((node) => node.nodeType));

    expect(nodeTypes.has("SUBJECT")).toBe(true);
    expect(nodeTypes.has("UNIT")).toBe(true);
    expect(nodeTypes.has("SUBUNIT")).toBe(true);
    expect(nodeTypes.has("CONCEPT")).toBe(true);
  });

  it("calculus1 소스에는 SUBJECT/UNIT/SUBUNIT/CONCEPT가 최소 하나씩 존재한다", () => {
    const { source } = loadCurriculumSource(CURRICULUM_SOURCE_PATHS.calculus1);
    const nodeTypes = new Set(source.nodes.map((node) => node.nodeType));

    expect(nodeTypes.has("SUBJECT")).toBe(true);
    expect(nodeTypes.has("UNIT")).toBe(true);
    expect(nodeTypes.has("SUBUNIT")).toBe(true);
    expect(nodeTypes.has("CONCEPT")).toBe(true);
  });
});
