import { describe, expect, it } from "vitest";
import {
  classifyRelevanceLevel,
  redistributeWeights,
  scoreFamilyCsatRelevance,
  type CsatRelevanceScoringInput,
  type WeightAvailabilityFlags,
} from "./csatRelevanceScoring";

const BOTH_AVAILABLE: WeightAvailabilityFlags = {
  hasAnySilverEvidenceInCorpus: true,
  hasReliableReasoningReusabilitySignal: true,
};
const ONLY_SILVER_MISSING: WeightAvailabilityFlags = {
  hasAnySilverEvidenceInCorpus: false,
  hasReliableReasoningReusabilitySignal: true,
};
const BOTH_MISSING: WeightAvailabilityFlags = {
  hasAnySilverEvidenceInCorpus: false,
  hasReliableReasoningReusabilitySignal: false,
};

describe("redistributeWeights", () => {
  it("SILVER 증거도 있고 reasoning reusability 신호도 있으면 원안 가중치(40/25/20/10/5%)를 그대로 돌려준다", () => {
    expect(redistributeWeights(BOTH_AVAILABLE)).toEqual({
      gold: 0.4,
      curriculum: 0.25,
      historical: 0.2,
      reasoning: 0.1,
      reference: 0.05,
    });
  });

  it("SILVER 증거가 코퍼스에 전혀 없으면(reasoning 신호는 있음) Historical(20%)만 나머지 4개에 비례 재분배한다", () => {
    const weights = redistributeWeights(ONLY_SILVER_MISSING);
    expect(weights).toEqual({ gold: 0.5, curriculum: 0.3125, historical: 0, reasoning: 0.125, reference: 0.0625 });
  });

  it("SILVER 증거도 없고 reasoning reusability 신호도 없으면(현재 실제 운영 조합) historical+reasoning을 나머지 3개에 비례 재분배한다", () => {
    const weights = redistributeWeights(BOTH_MISSING);

    // 코드로 계산한 정확한 기대값: zeroedTotal=0.2+0.1=0.3, remainingTotal=0.4+0.25+0.05=0.7.
    const zeroedTotal = 0.2 + 0.1;
    const remainingTotal = 0.4 + 0.25 + 0.05;
    const expectedGold = Math.round((0.4 + zeroedTotal * (0.4 / remainingTotal)) * 10_000) / 10_000;
    const expectedCurriculum = Math.round((0.25 + zeroedTotal * (0.25 / remainingTotal)) * 10_000) / 10_000;
    const expectedReference = Math.round((0.05 + zeroedTotal * (0.05 / remainingTotal)) * 10_000) / 10_000;

    expect(expectedGold).toBeCloseTo(0.5714, 4);
    expect(expectedCurriculum).toBeCloseTo(0.3571, 4);
    expect(expectedReference).toBeCloseTo(0.0714, 4);

    expect(weights).toEqual({
      gold: expectedGold,
      curriculum: expectedCurriculum,
      historical: 0,
      reasoning: 0,
      reference: expectedReference,
    });
  });

  it("재분배 후에도 가중치 합은 항상 1에 가깝다", () => {
    for (const flags of [BOTH_AVAILABLE, ONLY_SILVER_MISSING, BOTH_MISSING]) {
      const weights = redistributeWeights(flags);
      const total = weights.gold + weights.curriculum + weights.historical + weights.reasoning + weights.reference;
      expect(total).toBeCloseTo(1, 3);
    }
  });
});

describe("classifyRelevanceLevel", () => {
  it("컷오프(CORE≥0.75/HIGH≥0.55/MEDIUM≥0.35/LOW≥0.15/REJECT<0.15)대로 분류한다", () => {
    expect(classifyRelevanceLevel(0.9)).toBe("CORE");
    expect(classifyRelevanceLevel(0.75)).toBe("CORE");
    expect(classifyRelevanceLevel(0.6)).toBe("HIGH");
    expect(classifyRelevanceLevel(0.55)).toBe("HIGH");
    expect(classifyRelevanceLevel(0.4)).toBe("MEDIUM");
    expect(classifyRelevanceLevel(0.35)).toBe("MEDIUM");
    expect(classifyRelevanceLevel(0.2)).toBe("LOW");
    expect(classifyRelevanceLevel(0.15)).toBe("LOW");
    expect(classifyRelevanceLevel(0.1)).toBe("REJECT");
    expect(classifyRelevanceLevel(0)).toBe("REJECT");
  });
});

describe("scoreFamilyCsatRelevance", () => {
  it("SILVER 없이도 Gold 증거만으로 CORE 등급까지 도달할 수 있다(재분배 반영)", () => {
    const input: CsatRelevanceScoringInput = {
      goldEvidenceWeights: [1, 1],
      silverEvidenceWeights: [],
      curriculumCentrality: 1,
      stage2Confidence: 1,
      referenceCoverageRatio: 1,
    };

    const result = scoreFamilyCsatRelevance(input, ONLY_SILVER_MISSING);

    expect(result.score).toBe(1);
    expect(result.level).toBe("CORE");
    expect(result.dimensionScores.historical).toBe(0);
    expect(result.weightsUsed.historical).toBe(0);
  });

  it("증거가 전혀 없으면 REJECT에 가까운 낮은 점수를 준다", () => {
    const input: CsatRelevanceScoringInput = {
      goldEvidenceWeights: [],
      silverEvidenceWeights: [],
      curriculumCentrality: 0,
      stage2Confidence: null,
      referenceCoverageRatio: 0,
    };

    const result = scoreFamilyCsatRelevance(input, ONLY_SILVER_MISSING);

    expect(result.score).toBe(0);
    expect(result.level).toBe("REJECT");
  });

  it("SILVER 증거가 코퍼스에 있으면 historical 가중치가 0이 아니게 반영된다", () => {
    const input: CsatRelevanceScoringInput = {
      goldEvidenceWeights: [0.5],
      silverEvidenceWeights: [1],
      curriculumCentrality: 0.5,
      stage2Confidence: 0.5,
      referenceCoverageRatio: 0.5,
    };

    const result = scoreFamilyCsatRelevance(input, BOTH_AVAILABLE);

    expect(result.weightsUsed.historical).toBe(0.2);
    expect(result.dimensionScores.historical).toBe(0.5);
  });

  it("SILVER도 없고 reasoning reusability 신호도 없으면 reasoning 가중치가 0이라 stage2Confidence가 높아도 점수에 기여하지 않는다", () => {
    const withHighConfidence: CsatRelevanceScoringInput = {
      goldEvidenceWeights: [0.5],
      silverEvidenceWeights: [],
      curriculumCentrality: 0.5,
      stage2Confidence: 1,
      referenceCoverageRatio: 0.5,
    };
    const withLowConfidence: CsatRelevanceScoringInput = { ...withHighConfidence, stage2Confidence: 0 };

    const resultHigh = scoreFamilyCsatRelevance(withHighConfidence, BOTH_MISSING);
    const resultLow = scoreFamilyCsatRelevance(withLowConfidence, BOTH_MISSING);

    expect(resultHigh.weightsUsed.reasoning).toBe(0);
    expect(resultHigh.dimensionScores.reasoning).toBe(1);
    expect(resultLow.dimensionScores.reasoning).toBe(0);
    // 가중치가 0이라 stage2Confidence 차이가 최종 점수에 영향을 주지 않는다.
    expect(resultHigh.score).toBe(resultLow.score);
  });

  it("같은 입력엔 항상 같은 결과를 돌려준다(순수 함수)", () => {
    const input: CsatRelevanceScoringInput = {
      goldEvidenceWeights: [0.7],
      silverEvidenceWeights: [],
      curriculumCentrality: 0.6,
      stage2Confidence: 0.8,
      referenceCoverageRatio: 0.3,
    };

    expect(scoreFamilyCsatRelevance(input, BOTH_MISSING)).toEqual(scoreFamilyCsatRelevance(input, BOTH_MISSING));
  });
});
