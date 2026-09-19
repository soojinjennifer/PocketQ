import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActionBar } from "./ActionBar";

/**
 * ActionBar v3.0(2026-09, 오너 승인) — "항상 버튼 1개 + 캡션 1개" 구조 검증. 기존 3세그먼트 관련
 * 테스트(컨테이너 보더 없음, 세그먼트별 강조/고스트 필 등)는 구조 자체가 폐기되어 대부분 무효하므로
 * 전면 재작성했다.
 */
describe("ActionBar", () => {
  describe("input-empty: INPUT 단계, 입력 없음(비활성)", () => {
    it("버튼 1개('문제 인식하기')와 캡션 1개만 렌더되고 스타일이 스펙과 일치한다", () => {
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

      const buttons = screen.getAllByRole("button");
      expect(buttons).toHaveLength(1);

      const button = screen.getByRole("button", { name: "문제 인식하기" });
      expect(button).toBeDisabled();
      expect(button.className).toContain("bg-surface-well");
      expect(button.className).toContain("border-bg-scrim");
      expect(button.className).toContain("text-action-disabled-fg");
      expect(button.className).toContain("w-[271px]");
      expect(button.className).not.toContain("w-fit");
      // 라벨+아이콘 그룹이 버튼 폭 안에서 가운데 정렬된다(Figma 좌표 재실측, 2026-09).
      expect(button.className).toContain("justify-center");
      expect(button.className).not.toContain("justify-between");
      // Corner Radius 비대칭(오너 실기기 피드백 + Figma 재실측, 2026-09): top-right만 각짐.
      expect(button.className).toContain("rounded-tl-full");
      expect(button.className).toContain("rounded-bl-full");
      expect(button.className).toContain("rounded-br-full");
      expect(button.className).not.toContain("rounded-full");

      // 라벨이 왼쪽, 아이콘(svg)이 오른쪽이어야 한다(Figma 재실측, 2026-09).
      expect(button.firstChild?.textContent).toBe("문제 인식하기");
      expect(button.lastChild?.nodeName).toBe("svg");

      const caption = screen.getByText("먼저 사진이나 필기로 문제를 인식 시켜 주세요");
      expect(caption.className).toContain("text-accent-steel");
      expect(caption.className).not.toContain("truncate");
      expect(caption.className).not.toContain("whitespace-nowrap");
    });

    it("recognize 요청이 진행 중이어도 같은 비활성 스펙을 유지한다", () => {
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

      const button = screen.getByRole("button", { name: "문제 인식하기" });
      expect(button).toBeDisabled();
      expect(button.className).toContain("bg-surface-well");
    });

    it("클릭해도 onRecognize가 호출되지 않는다(disabled)", () => {
      const handleRecognize = vi.fn();
      render(
        <ActionBar
          problemId={null}
          hasProblemInput={false}
          hasWorkInput={false}
          recognizeStatus="idle"
          solveStatus="idle"
          recognizeWorkStatus="idle"
          diagnoseStatus="idle"
          onRecognize={handleRecognize}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
      expect(handleRecognize).not.toHaveBeenCalled();
    });
  });

  describe("input-filled: INPUT 단계, 입력 있음(활성)", () => {
    it("버튼 1개('문제 인식하기')와 캡션 1개만 렌더되고 스타일이 스펙과 일치한다", () => {
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

      expect(screen.getAllByRole("button")).toHaveLength(1);

      const button = screen.getByRole("button", { name: "문제 인식하기" });
      expect(button).not.toBeDisabled();
      expect(button.className).toContain("bg-accent-green");
      expect(button.className).toContain("border-brand-deep");
      expect(button.className).toContain("text-label-on-dark");
      expect(button.className).toContain("w-[271px]");
      expect(button.className).not.toContain("w-fit");
      expect(button.className).toContain("justify-center");
      expect(button.className).not.toContain("justify-between");
      expect(button.className).toContain("rounded-tl-full");
      expect(button.className).toContain("rounded-bl-full");
      expect(button.className).toContain("rounded-br-full");
      expect(button.className).not.toContain("rounded-full");
      expect(button.firstChild?.textContent).toBe("문제 인식하기");
      expect(button.lastChild?.nodeName).toBe("svg");

      const caption = screen.getByText("버튼을 선택하여 AI가 문제를 분석하게 해주세요");
      expect(caption.className).toContain("text-accent-steel");
      expect(caption.className).not.toContain("truncate");
      expect(caption.className).not.toContain("whitespace-nowrap");
    });

    it("클릭 시 onRecognize만 호출되고 다른 콜백은 호출되지 않는다", () => {
      const handleRecognize = vi.fn();
      const handleGiveUp = vi.fn();
      const handleDiagnose = vi.fn();
      const handleNewProblem = vi.fn();
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
          onGiveUp={handleGiveUp}
          onDiagnose={handleDiagnose}
          onNewProblem={handleNewProblem}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
      expect(handleRecognize).toHaveBeenCalledTimes(1);
      expect(handleGiveUp).not.toHaveBeenCalled();
      expect(handleDiagnose).not.toHaveBeenCalled();
      expect(handleNewProblem).not.toHaveBeenCalled();
    });
  });

  describe("work-notyet: WORK 단계, 풀이 전", () => {
    it("버튼 1개('아직 못 풀겠어요')와 캡션 1개만 렌더되고 스타일이 스펙과 일치한다", () => {
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

      expect(screen.getAllByRole("button")).toHaveLength(1);

      const button = screen.getByRole("button", { name: "아직 못 풀겠어요" });
      expect(button).not.toBeDisabled();
      expect(button.className).toContain("bg-action-notyet-bg");
      expect(button.className).toContain("border-brand-deep");
      expect(button.className).toContain("text-action-notyet-fg");
      expect(button.className).toContain("w-[263px]");
      expect(button.className).not.toContain("w-fit");
      expect(button.className).toContain("justify-center");
      expect(button.className).not.toContain("justify-between");
      expect(button.className).toContain("rounded-tl-full");
      expect(button.className).toContain("rounded-bl-full");
      expect(button.className).toContain("rounded-br-full");
      expect(button.className).not.toContain("rounded-full");
      expect(button.firstChild?.textContent).toBe("아직 못 풀겠어요");
      expect(button.lastChild?.nodeName).toBe("svg");

      // RTL의 기본 텍스트 매처는 DOM 텍스트를 정규화(공백 축약)한 뒤 매처 문자열과 비교하므로,
      // 검색에는 정규화된(단일 공백) 문자열을 쓰고, 물음표 뒤 이중 공백(Figma 원문)이 실제로 DOM에
      // 남아 있는지는 원본 `textContent`로 별도 확인한다.
      const caption = screen.getByText("문제 풀기가 어려우세요? AI가 도와 드릴게요");
      expect(caption.textContent).toBe("문제 풀기가 어려우세요?  AI가 도와 드릴게요");
      expect(caption.className).toContain("text-accent-steel");
      expect(caption.className).not.toContain("truncate");
      expect(caption.className).not.toContain("whitespace-nowrap");
    });

    it("solve/recognizeWork/diagnose 중 하나라도 진행 중이면 비활성화된다", () => {
      render(
        <ActionBar
          problemId="problem-1"
          hasProblemInput
          hasWorkInput={false}
          recognizeStatus="success"
          solveStatus="loading"
          recognizeWorkStatus="idle"
          diagnoseStatus="idle"
        />,
      );

      expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).toBeDisabled();
    });

    it("클릭 시 onGiveUp만 호출되고 다른 콜백은 호출되지 않는다", () => {
      const handleRecognize = vi.fn();
      const handleGiveUp = vi.fn();
      const handleDiagnose = vi.fn();
      const handleNewProblem = vi.fn();
      render(
        <ActionBar
          problemId="problem-1"
          hasProblemInput
          hasWorkInput={false}
          recognizeStatus="success"
          solveStatus="idle"
          recognizeWorkStatus="idle"
          diagnoseStatus="idle"
          onRecognize={handleRecognize}
          onGiveUp={handleGiveUp}
          onDiagnose={handleDiagnose}
          onNewProblem={handleNewProblem}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "아직 못 풀겠어요" }));
      expect(handleGiveUp).toHaveBeenCalledTimes(1);
      expect(handleRecognize).not.toHaveBeenCalled();
      expect(handleDiagnose).not.toHaveBeenCalled();
      expect(handleNewProblem).not.toHaveBeenCalled();
    });
  });

  describe("work-done: WORK 단계, 풀이 후", () => {
    it("버튼 1개('봐 주세요')와 캡션 1개만 렌더되고 스타일이 스펙과 일치한다('아직 못 풀겠어요'는 더 이상 노출되지 않음)", () => {
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

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "아직 못 풀겠어요" })).not.toBeInTheDocument();

      const button = screen.getByRole("button", { name: "봐 주세요" });
      expect(button).not.toBeDisabled();
      expect(button.className).toContain("bg-accent-teal");
      expect(button.className).toContain("border-brand-deep");
      expect(button.className).toContain("text-label-on-dark");
      expect(button.className).toContain("w-[263px]");
      expect(button.className).not.toContain("w-fit");
      expect(button.className).toContain("justify-center");
      expect(button.className).not.toContain("justify-between");
      expect(button.className).toContain("rounded-tl-full");
      expect(button.className).toContain("rounded-bl-full");
      expect(button.className).toContain("rounded-br-full");
      expect(button.className).not.toContain("rounded-full");
      expect(button.firstChild?.textContent).toBe("봐 주세요");
      expect(button.lastChild?.nodeName).toBe("svg");

      const caption = screen.getByText("와우, 훌륭해요! 풀이가 맞는지 한번 볼까요?");
      expect(caption.className).toContain("text-icon-default");
      expect(caption.className).not.toContain("truncate");
      expect(caption.className).not.toContain("whitespace-nowrap");
    });

    it("클릭 시 onDiagnose만 호출되고 다른 콜백은 호출되지 않는다", () => {
      const handleRecognize = vi.fn();
      const handleGiveUp = vi.fn();
      const handleDiagnose = vi.fn();
      const handleNewProblem = vi.fn();
      render(
        <ActionBar
          problemId="problem-1"
          hasProblemInput
          hasWorkInput
          recognizeStatus="success"
          solveStatus="idle"
          recognizeWorkStatus="idle"
          diagnoseStatus="idle"
          onRecognize={handleRecognize}
          onGiveUp={handleGiveUp}
          onDiagnose={handleDiagnose}
          onNewProblem={handleNewProblem}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "봐 주세요" }));
      expect(handleDiagnose).toHaveBeenCalledTimes(1);
      expect(handleRecognize).not.toHaveBeenCalled();
      expect(handleGiveUp).not.toHaveBeenCalled();
      expect(handleNewProblem).not.toHaveBeenCalled();
    });
  });

  describe("result: 결과 표시 중", () => {
    it("버튼 1개('새 문제 풀기')와 캡션 1개만 렌더되고 스타일이 스펙과 일치한다(diagnoseStatus=success)", () => {
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

      expect(screen.getAllByRole("button")).toHaveLength(1);

      const button = screen.getByRole("button", { name: "새 문제 풀기" });
      expect(button).not.toBeDisabled();
      expect(button.className).toContain("bg-accent-red");
      expect(button.className).toContain("border-brand-deep");
      expect(button.className).toContain("w-[263px]");
      expect(button.className).not.toContain("w-fit");
      expect(button.className).toContain("justify-center");
      expect(button.className).toContain("rounded-tl-full");
      expect(button.className).toContain("rounded-bl-full");
      expect(button.className).toContain("rounded-br-full");
      expect(button.className).not.toContain("rounded-full");
      expect(button.querySelector("svg")).not.toBeInTheDocument();
      // Figma raw Variable 재실측(node 267:462, 2026-09): result도 다른 4개 상태와 동일한
      // 17px/22px다 — 이전에 오측했던 14px 전용 변수는 존재하지 않는다.
      expect(button.className).toContain("text-[17px]");
      expect(button.className).toContain("leading-[22px]");
      expect(button.className).not.toContain("text-[14px]");

      const caption = screen.getByText("계속 열심히 다음 문제를 풀어 볼까요?");
      expect(caption.className).toContain("text-icon-default");
      expect(caption.className).not.toContain("truncate");
      expect(caption.className).not.toContain("whitespace-nowrap");
    });

    it("solveStatus=success로도 동일한 result 상태로 전환된다", () => {
      render(
        <ActionBar
          problemId="problem-1"
          hasProblemInput
          hasWorkInput
          recognizeStatus="success"
          solveStatus="success"
          recognizeWorkStatus="idle"
          diagnoseStatus="idle"
        />,
      );

      expect(screen.getByRole("button", { name: "새 문제 풀기" })).not.toBeDisabled();
    });

    it("클릭 시 onNewProblem만 호출되고 다른 콜백은 호출되지 않는다", () => {
      const handleRecognize = vi.fn();
      const handleGiveUp = vi.fn();
      const handleDiagnose = vi.fn();
      const handleNewProblem = vi.fn();
      render(
        <ActionBar
          problemId="problem-1"
          hasProblemInput
          hasWorkInput
          recognizeStatus="success"
          solveStatus="idle"
          recognizeWorkStatus="success"
          diagnoseStatus="success"
          onRecognize={handleRecognize}
          onGiveUp={handleGiveUp}
          onDiagnose={handleDiagnose}
          onNewProblem={handleNewProblem}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "새 문제 풀기" }));
      expect(handleNewProblem).toHaveBeenCalledTimes(1);
      expect(handleRecognize).not.toHaveBeenCalled();
      expect(handleGiveUp).not.toHaveBeenCalled();
      expect(handleDiagnose).not.toHaveBeenCalled();
    });
  });
});
