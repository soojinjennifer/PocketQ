import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionBar } from "./ActionBar";

describe("ActionBar", () => {
  it("INPUT 단계(problemId=null)에서는 '문제 인식하기'만 활성화되고 강조된다", () => {
    render(
      <ActionBar
        problemId={null}
        hasProblemInput
        hasWorkInput={false}
        recognizeStatus="idle"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
      />,
    );

    const recognizeButton = screen.getByRole("button", { name: "문제 인식하기" });
    expect(recognizeButton).not.toBeDisabled();
    expect(recognizeButton.className).toContain("bg-brand-deep");
    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("INPUT 단계에서 입력이 없으면(hasProblemInput=false) '문제 인식하기'도 비활성화된다", () => {
    render(
      <ActionBar
        problemId={null}
        hasProblemInput={false}
        hasWorkInput={false}
        recognizeStatus="idle"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
  });

  it("recognize 요청이 진행 중이면 '문제 인식하기'가 비활성화된다", () => {
    render(
      <ActionBar
        problemId={null}
        hasProblemInput
        hasWorkInput={false}
        recognizeStatus="loading"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
  });

  it("WORK-풀이전 단계(problemId 있음, hasWorkInput=false)에서는 '아직 못 풀겠어요'만 강조/활성화되고 '봐 주세요'는 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput={false}
        recognizeStatus="success"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
      />,
    );

    const giveUpButton = screen.getByRole("button", { name: "아직 못 풀겠어요" });
    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
    expect(giveUpButton).not.toBeDisabled();
    expect(giveUpButton.className).toContain("bg-brand-deep");
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("WORK-풀이후 단계(problemId 있음, hasWorkInput=true)에서는 '봐 주세요'가 강조/활성화되고 '아직 못 풀겠어요'는 비강조 활성 상태다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput
        recognizeStatus="success"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
      />,
    );

    const giveUpButton = screen.getByRole("button", { name: "아직 못 풀겠어요" });
    const diagnoseButton = screen.getByRole("button", { name: "봐 주세요" });
    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeDisabled();
    expect(giveUpButton).not.toBeDisabled();
    expect(giveUpButton.className).not.toContain("bg-brand-deep");
    expect(diagnoseButton).not.toBeDisabled();
    expect(diagnoseButton.className).toContain("bg-brand-deep");
  });

  it("WORK 단계에서 진단(solve) 요청이 진행 중이면 '아직 못 풀겠어요'/'봐 주세요' 모두 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput
        recognizeStatus="success"
        solveStatus="loading"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("WORK 단계에서 recognizeWork가 진행 중이면 '아직 못 풀겠어요'/'봐 주세요' 모두 비활성화된다(hasWorkInput=false)", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput={false}
        recognizeStatus="success"
        solveStatus="idle"
        recognizeWorkStatus="loading"
        diagnoseStatus="idle"
      />,
    );

    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("WORK 단계에서 diagnose가 진행 중이면 '아직 못 풀겠어요'/'봐 주세요' 모두 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput
        recognizeStatus="success"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="loading"
      />,
    );

    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("RESULT 단계(diagnoseStatus=success)에서는 '새 문제 풀기'로 라벨이 바뀌고 강조/활성화되며 나머지는 비활성화된다", () => {
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput
        recognizeStatus="success"
        solveStatus="idle"
        recognizeWorkStatus="success"
        diagnoseStatus="success"
      />,
    );

    const newProblemButton = screen.getByRole("button", { name: "새 문제 풀기" });
    expect(newProblemButton).not.toBeDisabled();
    expect(newProblemButton.className).toContain("bg-brand-deep");
    expect(screen.queryByRole("button", { name: "문제 인식하기" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();
  });

  it("RESULT 단계(solveStatus=success)에서도 '새 문제 풀기'로 전환되고 클릭 시 onNewProblem이 호출된다", () => {
    const handleNewProblem = vi.fn();
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput
        recognizeStatus="success"
        solveStatus="success"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
        onNewProblem={handleNewProblem}
      />,
    );

    expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "봐 주세요" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "새 문제 풀기" }));
    expect(handleNewProblem).toHaveBeenCalledTimes(1);
  });

  it("onRecognize가 있으면 INPUT 단계에서 '문제 인식하기' 클릭 시 호출된다", () => {
    const handleRecognize = vi.fn();
    render(
      <ActionBar
        problemId={null}
        hasProblemInput
        hasWorkInput={false}
        recognizeStatus="idle"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
        onRecognize={handleRecognize}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
    expect(handleRecognize).toHaveBeenCalledTimes(1);
  });

  it("onGiveUp/onDiagnose가 있으면 WORK-풀이후 단계에서 각 버튼 클릭 시 호출된다", () => {
    const handleGiveUp = vi.fn();
    const handleDiagnose = vi.fn();
    render(
      <ActionBar
        problemId="problem-1"
        hasProblemInput
        hasWorkInput
        recognizeStatus="success"
        solveStatus="idle"
        recognizeWorkStatus="idle"
        diagnoseStatus="idle"
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
