import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DiagnosisCard, type Diagnosis } from "./DiagnosisCard";

const BASE_DIAGNOSIS: Diagnosis = {
  lastValidLine: 2,
  stallLine: 3,
  errorTypeLabel: "부호 오류",
  errorDetail: "부등호 방향이 반대로 적용되었습니다.",
  relatedConcepts: ["이차함수 최대·최소"],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
};

describe("DiagnosisCard", () => {
  it("오류형(DIAG-4): 유효 구간과 막힌 지점, 오류 유형 배지를 보여준다", () => {
    render(<DiagnosisCard diagnosis={BASE_DIAGNOSIS} />);

    expect(screen.getByText("부호 오류")).toBeInTheDocument();
    expect(screen.getByText(/2번째 줄까지 정확합니다/)).toBeInTheDocument();
    expect(screen.getByText(/3번째 줄에서 막혔어요/)).toBeInTheDocument();
    expect(screen.getByText(/부등호 방향이 반대로 적용되었습니다/)).toBeInTheDocument();
    expect(screen.getByText("이차함수 최대·최소")).toBeInTheDocument();
  });

  it("중단형(DIAG-4): 오류 없이 멈춘 경우 다른 문구를 보여주고 오류 유형 배지는 없다", () => {
    render(
      <DiagnosisCard
        diagnosis={{ ...BASE_DIAGNOSIS, stallLine: null, errorTypeLabel: null, errorDetail: null }}
      />,
    );

    expect(screen.getByText(/다음 단계를 함께 볼까요/)).toBeInTheDocument();
    expect(screen.queryByText("부호 오류")).not.toBeInTheDocument();
  });

  it("DIAG-5: 신뢰도가 낮으면 완화 표현이 앞에 붙는다", () => {
    render(<DiagnosisCard diagnosis={{ ...BASE_DIAGNOSIS, isLowConfidence: true }} />);

    expect(screen.getByText(/이 부분을 다시 확인해 볼까요/)).toBeInTheDocument();
  });

  it("DIAG-6: 정답에 도달했지만 개선점이 있으면 정답임을 먼저 인정한다", () => {
    render(<DiagnosisCard diagnosis={{ ...BASE_DIAGNOSIS, reachedAnswerWithNotes: true }} />);

    expect(screen.getByText(/정답입니다/)).toBeInTheDocument();
  });
});
