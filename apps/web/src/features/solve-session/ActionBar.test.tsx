import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionBar } from "./ActionBar";

describe("ActionBar", () => {
  it("INPUT 단계(problemId=null)에서는 '문제 인식하기'만 활성화된다", () => {
    render(
      <ActionBar
        problemId={null}
        hasProblemInput
        recognizeStatus="idle"
        solveStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("INPUT 단계에서 입력이 없으면(hasProblemInput=false) '문제 인식하기'도 비활성화된다", () => {
    render(
      <ActionBar
        problemId={null}
        hasProblemInput={false}
        recognizeStatus="idle"
        solveStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
  });

  it("recognize 요청이 진행 중이면 '문제 인식하기'가 비활성화된다", () => {
    render(
      <ActionBar
        problemId={null}
        hasProblemInput
        recognizeStatus="loading"
        solveStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
  });

  it("WORK 단계(problemId 있음, 진단 전)에서는 '아직 못 풀겠어요'/'봐 주세요'가 활성화되고 '문제 인식하기'는 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        recognizeStatus="success"
        solveStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).not.toBeDisabled();
  });

  it("WORK 단계에서 진단(solve) 요청이 진행 중이면 '아직 못 풀겠어요'/'봐 주세요' 모두 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        recognizeStatus="success"
        solveStatus="loading"
      />,
    );

    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("RESULT 단계(solveStatus=success)에서는 3개 버튼 모두 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        recognizeStatus="success"
        solveStatus="success"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("onRecognize가 있으면 '문제 인식하기' 클릭 시 호출된다", () => {
    const handleRecognize = vi.fn();
    render(
      <ActionBar
        problemId={null}
        hasProblemInput
        recognizeStatus="idle"
        solveStatus="idle"
        onRecognize={handleRecognize}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
    expect(handleRecognize).toHaveBeenCalledTimes(1);
  });

  it("onGiveUp/onDiagnose가 있으면 WORK 단계에서 각 버튼 클릭 시 호출된다", () => {
    const handleGiveUp = vi.fn();
    const handleDiagnose = vi.fn();
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        recognizeStatus="success"
        solveStatus="idle"
        onGiveUp={handleGiveUp}
        onDiagnose={handleDiagnose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "아직 못 풀겠어요" }));
    fireEvent.click(screen.getByRole("button", { name: "봐 주세요" }));
    expect(handleGiveUp).toHaveBeenCalledTimes(1);
    expect(handleDiagnose).toHaveBeenCalledTimes(1);
  });
});
