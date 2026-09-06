import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResumeSolution } from "shared-types";
import { ResumeResultCard } from "./ResumeResultCard";

const MOCK_SOLUTION: ResumeSolution = {
  mode: "own",
  // `methodName`은 필드명은 유지하되 "이어가는 지점 요약" 의미로 재정의됐다(`shared-types` 참고).
  methodName: "3번째 줄부터 이어가기",
  solutionMd: "3번째 줄부터 부등호 방향을 바로잡아 이어서 풀면...",
  answerMd: "x \\le 1 \\text{ 또는 } x \\ge 3",
  verified: true,
};

describe("ResumeResultCard", () => {
  it("'이어풀기 · {모드 라벨}' 상단 라벨과 이어가는 지점 요약, 본문을 보여준다", () => {
    render(<ResumeResultCard solution={MOCK_SOLUTION} />);

    expect(screen.getByText("이어풀기 · 내 방법으로 계속")).toBeInTheDocument();
    expect(screen.getByText(/3번째 줄부터 이어가기/)).toBeInTheDocument();
    expect(screen.getByText(/3번째 줄부터 부등호 방향을 바로잡아/)).toBeInTheDocument();
  });

  it("'검증됨' 배지를 보여주지 않는다(Figma엔 배지 자체가 없음)", () => {
    render(<ResumeResultCard solution={MOCK_SOLUTION} />);

    expect(screen.queryByText("검증됨")).not.toBeInTheDocument();
  });

  it("verified가 false여도 동일하게(배지 없이) 렌더링한다", () => {
    render(<ResumeResultCard solution={{ ...MOCK_SOLUTION, verified: false }} />);

    expect(screen.queryByText("검증됨")).not.toBeInTheDocument();
    expect(screen.getByText(/3번째 줄부터 이어가기/)).toBeInTheDocument();
  });

  it("최종 답(AnswerBox, tone=resume)을 렌더링한다", () => {
    render(<ResumeResultCard solution={MOCK_SOLUTION} />);

    expect(screen.getByText("최종 답 ·", { exact: false })).toBeInTheDocument();
  });

  it("alternative 모드에서는 '다른 방법으로' 라벨을 보여준다", () => {
    render(<ResumeResultCard solution={{ ...MOCK_SOLUTION, mode: "alternative" }} />);

    expect(screen.getByText("이어풀기 · 다른 방법으로")).toBeInTheDocument();
  });
});
