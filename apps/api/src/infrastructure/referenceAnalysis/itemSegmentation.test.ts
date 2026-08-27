import { describe, expect, it } from "vitest";
import { buildLocalItemKey, LOW_CONFIDENCE_THRESHOLD, segmentPageIntoItems } from "./itemSegmentation";

describe("segmentPageIntoItems", () => {
  it("숫자+마침표 패턴(DOT_NUMBERED)을 문항 경계로 인식한다", () => {
    // 합성 문장(자체 제작) — 실제 참고자료 원문이 아니다.
    const candidates = segmentPageIntoItems({
      pageNumber: 1,
      text: "1. 2x+3=7 equation. Solve for x. 2. Solve for y: 3y-5=10",
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      pageNumber: 1,
      sequenceInPage: 1,
      itemNumberLabel: "1",
      matchedPattern: "DOT_NUMBERED",
    });
    expect(candidates[1]).toMatchObject({
      sequenceInPage: 2,
      itemNumberLabel: "2",
      matchedPattern: "DOT_NUMBERED",
    });
    expect(candidates.every((c) => c.confidence >= LOW_CONFIDENCE_THRESHOLD)).toBe(true);
    expect(candidates.every((c) => c.needsReview === false)).toBe(true);
  });

  it("숫자+별점 마커 패턴(STAR_RATED_NUMBERED)을 문항 경계로 인식한다", () => {
    // 합성 문장(자체 제작, MathJK류 문서 구조를 흉내낸 것일 뿐 원문이 아니다).
    const candidates = segmentPageIntoItems({
      pageNumber: 5,
      text: "unit title 1 ★☆☆ note 12 p body text question mark 2 ★★☆ note 13 p body text",
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      pageNumber: 5,
      sequenceInPage: 1,
      itemNumberLabel: "1",
      matchedPattern: "STAR_RATED_NUMBERED",
    });
    expect(candidates[0]!.confidence).toBeGreaterThanOrEqual(LOW_CONFIDENCE_THRESHOLD);
    expect(candidates[1]).toMatchObject({
      sequenceInPage: 2,
      itemNumberLabel: "2",
      matchedPattern: "STAR_RATED_NUMBERED",
    });
  });

  it("원문자(①②③...) 보기 번호는 문항 경계로 인식하지 않는다", () => {
    const candidates = segmentPageIntoItems({
      pageNumber: 2,
      text: "1. what is x ① 1 ② 2 ③ 3 ④ 4 ⑤ 5",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({ itemNumberLabel: "1", matchedPattern: "DOT_NUMBERED" });
  });

  it("숫자 뒤에 별점 마커가 없으면 STAR_RATED_NUMBERED로 인식하지 않는다(오탐 방지)", () => {
    const candidates = segmentPageIntoItems({
      pageNumber: 3,
      text: "there are 12 apples and 3 oranges in total",
    });

    expect(candidates).toHaveLength(0);
  });

  it("빈 텍스트는 빈 배열을 반환한다", () => {
    expect(segmentPageIntoItems({ pageNumber: 1, text: "" })).toEqual([]);
  });
});

describe("buildLocalItemKey", () => {
  it("{document_key}#p{페이지3자리}-i{순번2자리} 형식으로 만든다", () => {
    expect(buildLocalItemKey("mathjk-alg-explog-01", 2, 1)).toBe("mathjk-alg-explog-01#p002-i01");
    expect(buildLocalItemKey("mathjk-alg-explog-01", 131, 12)).toBe("mathjk-alg-explog-01#p131-i12");
  });
});
