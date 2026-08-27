import { describe, expect, it } from "vitest";
import { classifyItemPair, type DedupItemInput } from "./deduplication";

function buildItem(overrides: Partial<DedupItemInput> & Pick<DedupItemInput, "localItemKey">): DedupItemInput {
  return {
    primaryConcept: "합성 개념 A",
    reasoningPattern: "case_split_then_sum",
    representationType: "equation",
    requiredSkills: ["skill-a", "skill-b"],
    conditionCount: 2,
    answerFormat: "multiple_choice_5",
    transformationPattern: ["quadratic-to-sign-analysis"],
    contentFingerprint: null,
    ...overrides,
  };
}

describe("classifyItemPair", () => {
  it("contentFingerprint가 같으면 EXACT_DUP이다", () => {
    const a = buildItem({ localItemKey: "k1", contentFingerprint: "abc" });
    const b = buildItem({ localItemKey: "k2", contentFingerprint: "abc", reasoningPattern: "다른 패턴" });

    expect(classifyItemPair(a, b).classification).toBe("EXACT_DUP");
  });

  it("모든 feature가 동일하면(fingerprint 없이도) APPROX_DUP이다", () => {
    const a = buildItem({ localItemKey: "k1" });
    const b = buildItem({ localItemKey: "k2", requiredSkills: ["skill-b", "skill-a"] });

    expect(classifyItemPair(a, b).classification).toBe("APPROX_DUP");
  });

  it("개념+추론패턴은 같지만 표현형태가 다르면 SAME_REASONING_DIFFERENT_SURFACE다", () => {
    const a = buildItem({ localItemKey: "k1" });
    const b = buildItem({ localItemKey: "k2", representationType: "word_situation", conditionCount: 3 });

    expect(classifyItemPair(a, b).classification).toBe("SAME_REASONING_DIFFERENT_SURFACE");
  });

  it("표현형태/정답형식은 같지만 추론패턴이 다르면 SIMILAR_SURFACE_DIFFERENT_REASONING이다", () => {
    const a = buildItem({ localItemKey: "k1" });
    const b = buildItem({
      localItemKey: "k2",
      primaryConcept: "완전히 다른 개념",
      reasoningPattern: "direct_substitution",
    });

    expect(classifyItemPair(a, b).classification).toBe("SIMILAR_SURFACE_DIFFERENT_REASONING");
  });

  it("공통점이 거의 없으면 보수적으로 SIMILAR_SURFACE_DIFFERENT_REASONING으로 분류한다", () => {
    const a = buildItem({ localItemKey: "k1" });
    const b = buildItem({
      localItemKey: "k2",
      primaryConcept: "완전히 다른 개념",
      reasoningPattern: "direct_substitution",
      representationType: "graph",
      answerFormat: "short_answer_integer",
    });

    const result = classifyItemPair(a, b);
    expect(result.classification).toBe("SIMILAR_SURFACE_DIFFERENT_REASONING");
    expect(result.evidence).toContain("자동 병합 금지");
  });
});
