import { describe, expect, it } from "vitest";
import { stubResumeCasCheck } from "./stubResumeCasCheck";

describe("stubResumeCasCheck", () => {
  it("어떤 ResumeSolution 내용이든 관계없이 항상 verified: true를 반환한다", () => {
    const result = stubResumeCasCheck({
      mode: "own",
      methodName: "완전제곱식",
      solutionMd: "다음 단계는...",
      answerMd: "최솟값은 -1입니다.",
      verified: false,
    });

    expect(result).toEqual({ verified: true });
  });

  it("mode가 alternative여도 동일하게 verified: true를 반환한다", () => {
    const result = stubResumeCasCheck({
      mode: "alternative",
      methodName: "판별식",
      solutionMd: "다른 방법으로...",
      answerMd: "최솟값은 -1입니다.",
      verified: false,
    });

    expect(result).toEqual({ verified: true });
  });
});
