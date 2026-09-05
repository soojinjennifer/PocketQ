import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResumeResultCard, type ResumeSolution } from "./ResumeResultCard";

const MOCK_SOLUTION: ResumeSolution = {
  mode: "own",
  methodName: "판별식",
  solutionMd: "3번째 줄부터 부등호 방향을 바로잡아 이어서 풀면...",
  answerMd: "x \\le 1 \\text{ 또는 } x \\ge 3",
  verified: true,
};

describe("ResumeResultCard", () => {
  it("모드/해법명과 이어풀기 본문을 보여준다", () => {
    render(<ResumeResultCard solution={MOCK_SOLUTION} />);

    expect(screen.getByText(/내 방법으로 계속/)).toBeInTheDocument();
    expect(screen.getByText(/판별식/)).toBeInTheDocument();
    expect(screen.getByText(/3번째 줄부터 부등호 방향을 바로잡아/)).toBeInTheDocument();
  });

  it("verified가 true면 '검증됨' 배지를 보여준다(RESUME-5)", () => {
    render(<ResumeResultCard solution={MOCK_SOLUTION} />);

    expect(screen.getByText("검증됨")).toBeInTheDocument();
  });

  it("verified가 false면 '검증됨' 배지를 보여주지 않는다", () => {
    render(<ResumeResultCard solution={{ ...MOCK_SOLUTION, verified: false }} />);

    expect(screen.queryByText("검증됨")).not.toBeInTheDocument();
  });

  it("최종 답(AnswerBox)을 렌더링한다", () => {
    render(<ResumeResultCard solution={MOCK_SOLUTION} />);

    expect(screen.getByText("최종 답 ·", { exact: false })).toBeInTheDocument();
  });

  it("alternative 모드에서는 '다른 방법으로' 라벨을 보여준다", () => {
    render(<ResumeResultCard solution={{ ...MOCK_SOLUTION, mode: "alternative" }} />);

    expect(screen.getByText(/다른 방법으로/)).toBeInTheDocument();
  });
});
