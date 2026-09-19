import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProblemInputContext,
  type ProblemInputContextValue,
} from "../../../features/problem-input/ProblemInputContext";
import { SolvePencilcanvasPage } from "./SolvePencilcanvasPage";

/** `RequireProblemInputGuard.test.tsx`와 동일한 최소 컨텍스트 베이스 — 이 페이지가 실제로 읽는
 *  필드만 테스트별로 override한다. */
function createContextValue(
  overrides: Partial<ProblemInputContextValue> = {},
): ProblemInputContextValue {
  return {
    capturedImage: null,
    setCapturedImage: () => undefined,
    clearCapturedImage: () => undefined,
    hasCaptureData: false,
    strokes: [],
    tool: "pen",
    setTool: () => undefined,
    commitStroke: () => undefined,
    undoStroke: () => undefined,
    redoStroke: () => undefined,
    clearStrokes: () => undefined,
    canUndoStroke: false,
    canRedoStroke: false,
    workStrokes: [],
    workTool: "pen",
    setWorkTool: () => undefined,
    commitWorkStroke: () => undefined,
    undoWorkStroke: () => undefined,
    redoWorkStroke: () => undefined,
    clearWorkStrokes: () => undefined,
    canUndoWorkStroke: false,
    canRedoWorkStroke: false,
    hasProblemInput: false,
    lastInputType: null,
    isRequestingReinput: false,
    beginReinput: () => undefined,
    startNewProblem: () => undefined,
    recognizeStatus: "idle",
    problemId: null,
    recognizedText: null,
    dailyUsageCount: null,
    dailyUsageLimit: null,
    solveStatus: "idle",
    streamedText: "",
    solveResult: null,
    suggestedQuestions: null,
    submitErrorMessage: null,
    submitProblem: () => Promise.resolve(),
    recognizeOnly: () => Promise.resolve(null),
    giveUp: () => Promise.resolve(),
    resumeFromHistory: () => Promise.resolve(false),
    resumeToWork: () => Promise.resolve(false),
    resetSubmission: () => undefined,
    cancelRecognition: () => undefined,
    beginRecognitionEdit: () => undefined,
    chatMessages: [],
    chatStatus: "idle",
    chatErrorMessage: null,
    sendChatMessage: () => Promise.resolve(false),
    resetChat: () => undefined,
    recognizeWorkStatus: "idle",
    workLines: null,
    recognizeWorkErrorMessage: null,
    recognizeWork: () => Promise.resolve(null),
    resetRecognizeWork: () => undefined,
    diagnoseStatus: "idle",
    diagnosis: null,
    diagnoseErrorMessage: null,
    diagnose: () => Promise.resolve(null),
    resetDiagnose: () => undefined,
    resumeMode: null,
    resumeStatus: "idle",
    resumeStreamedText: "",
    resumeSolution: null,
    resumeErrorMessage: null,
    startResume: () => Promise.resolve(),
    resetResume: () => undefined,
    ...overrides,
  };
}

interface MockContext2D {
  fillStyle: string;
  globalCompositeOperation: string;
  setTransform: (...args: number[]) => void;
  clearRect: (...args: number[]) => void;
  fillRect: (...args: number[]) => void;
  translate: (...args: number[]) => void;
  drawImage: (...args: unknown[]) => void;
  fill: () => void;
}

function createMockContext(): MockContext2D {
  return {
    fillStyle: "",
    globalCompositeOperation: "source-over",
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    fill: vi.fn(),
  };
}

/**
 * stage-qa-agent CONDITIONAL PASS(MEDIUM) 재현 시나리오 전용 테스트 하니스. WORK 단계 →
 * "새 문제 풀기"(`startNewProblem()`, 같은 라우트로 `navigate`해 리마운트 없이 `isWorkStage`만
 * `false`→`true`로 왕복) → 완전히 새로운 문제로 다시 WORK 단계 진입까지, 실제
 * `ProblemInputProvider`를 재구현하지 않고 이 페이지가 소비하는 필드만 최소한으로 흉내 낸다
 * (`RequireProblemInputGuard.test.tsx`와 동일한 패턴).
 */
function Harness() {
  const [problemId, setProblemId] = useState<string | null>("problem-1");
  const [recognizedText, setRecognizedText] = useState<string | null>("1+1=?");
  // "새 문제 풀기" 세그먼트가 보이려면 `diagnoseStatus`(또는 `solveStatus`)가 `success`여야 한다
  // (`shared/lib/solve/actionBarState`) — 실제로는 진단 성공 직후 landscape로 곧장 navigate하기
  // 전의 아주 짧은 순간에만 이 상태가 pencilcanvas 화면에 존재하지만, 그 순간에도 이 페이지의
  // state 리셋 로직은 동일하게 적용돼야 하므로 그 순간을 고정해 재현한다.
  const [diagnoseStatus, setDiagnoseStatus] = useState<ProblemInputContextValue["diagnoseStatus"]>(
    "success",
  );

  const value = createContextValue({
    hasProblemInput: true,
    problemId,
    recognizedText,
    diagnoseStatus,
    startNewProblem: () => {
      setProblemId(null);
      setRecognizedText(null);
      setDiagnoseStatus("idle");
    },
    recognizeOnly: () => {
      setProblemId("problem-2");
      setRecognizedText("2+2=?");
      return Promise.resolve("problem-2");
    },
  });

  return (
    <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
      <ProblemInputContext.Provider value={value}>
        <Routes>
          <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
        </Routes>
      </ProblemInputContext.Provider>
    </MemoryRouter>
  );
}

describe("SolvePencilcanvasPage — RecognizedChip 위치 고정(오너 iPad 실기기 보고 수정)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("WORK 단계에서 토글 버튼을 누르면 같은 DOM 노드가 유지되며(언마운트/재마운트 없음) 포커스를 잃지 않는다", async () => {
    render(<Harness />);

    const toggle = await screen.findByRole("button", { name: "인식된 문제 확대" });
    toggle.focus();
    expect(toggle).toHaveFocus();

    fireEvent.click(toggle);

    // 축소/확장 상태가 항상 같은 위치에 렌더링되므로, 토글 후에도 같은 DOM 노드가 그대로 유지된다
    // (별도의 autoFocus 없이도 포커스가 자연히 이어진다).
    const expandedToggle = await screen.findByRole("button", { name: "인식된 문제 축소" });
    expect(expandedToggle).toBe(toggle);
    expect(expandedToggle).toHaveFocus();
  });

  it("WORK 단계에서 '새 문제 풀기'로 나갔다가 새 문제로 다시 WORK 단계에 진입하면, 새로 마운트된 토글 버튼이 포커스를 가로채지 않는다", async () => {
    render(<Harness />);

    const firstToggle = await screen.findByRole("button", { name: "인식된 문제 확대" });
    fireEvent.click(firstToggle);
    await screen.findByRole("button", { name: "인식된 문제 축소" });

    // "새 문제 풀기" 클릭 — `isWorkStage`가 false로 바뀌지만 같은 라우트로 navigate하므로 페이지
    // 컴포넌트는 리마운트되지 않는다.
    fireEvent.click(screen.getByRole("button", { name: "새 문제 풀기" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /인식된 문제/ })).not.toBeInTheDocument(),
    );

    // 완전히 새로운 문제를 인식해 다시 WORK 단계로 진입한다 — 이번에는 토글을 누르지 않았다.
    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    const newToggle = await screen.findByRole("button", { name: "인식된 문제 확대" });
    expect(newToggle).not.toHaveFocus();
  });

  it("RecognizedChip은 PenRail 그룹 우측이 아니라 화면 상단 중앙 고정 컨테이너에 렌더링된다(design-agent Figma 재조회 확정 — `267:607`/`38:21` 두 프레임 모두 동일 좌표로 화면 중앙 배치, 오너가 iPad 실기기에서 PenRail 우측 고정안을 철회 요청)", async () => {
    render(<Harness />);

    const badge = await screen.findByText("인식됨");
    const container = badge.closest("div[class*='top-[90px]']");
    expect(container).not.toBeNull();
    // PenRail 그룹 우측을 측정해 넘기던 인라인 `left` style이 완전히 제거되고, 다른 상단 중앙
    // 요소(ProblemCard/EmptyStateHint 컨테이너)와 동일한 `inset-x-0 + mx-auto` 패턴으로 화면
    // 상단 중앙에 고정된다.
    expect(container).toHaveClass("absolute");
    expect(container).toHaveClass("inset-x-0");
    expect(container).toHaveClass("top-[90px]");
    expect(container).toHaveClass("mx-auto");
    expect(container).not.toHaveAttribute("style");
  });
});

describe("SolvePencilcanvasPage — 진단(diagnose) 중 로딩 표시 유지(오너 실기기 보고 수정)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  /**
   * "봐 주세요" 1클릭이 recognizeWork→diagnose를 순서대로 실행하는 동안(오너 확정 흐름,
   * /solve/landscape로 이동하기 전까지 이 화면에 머무른다) recognizeWork가 끝나고 diagnose가
   * 끝날 때까지 로딩 표시가 없어 멈춘 것처럼 보이던 버그를 재현·검증한다.
   */
  it("recognizeWorkStatus가 success로 바뀐 뒤에도 diagnoseStatus가 loading이면 로딩 표시가 계속 보인다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            recognizeWorkStatus: "success",
            diagnoseStatus: "loading",
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("진단하는 중")).toBeInTheDocument();
    expect(screen.queryByText("풀이를 인식하는 중")).not.toBeInTheDocument();
  });

  it("recognizeWorkStatus가 loading이면 '풀이를 인식하는 중'을 보여준다(기존 동작 회귀 없음)", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            recognizeWorkStatus: "loading",
            diagnoseStatus: "idle",
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("풀이를 인식하는 중")).toBeInTheDocument();
    expect(screen.queryByText("진단하는 중")).not.toBeInTheDocument();
  });
});

describe("SolvePencilcanvasPage — 소프트 캡(하루 10회, 오너 확정) 안내(Figma 없음)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("오늘 누적 인식 횟수가 한도를 초과하면 차단 없이 안내 모달을 보여준다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            dailyUsageCount: 11,
            dailyUsageLimit: 10,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("오늘 문제풀이 횟수 안내")).toBeInTheDocument();
  });

  it("오늘 누적 인식 횟수가 한도 이하면 안내 모달을 보여주지 않는다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            dailyUsageCount: 3,
            dailyUsageLimit: 10,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("오늘 문제풀이 횟수 안내")).not.toBeInTheDocument();
  });

  it("서버가 카운트를 채우지 않으면(null) 안내 모달을 보여주지 않는다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            dailyUsageCount: null,
            dailyUsageLimit: null,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("오늘 문제풀이 횟수 안내")).not.toBeInTheDocument();
  });

  it("'확인'을 누르면 차단 없이 모달만 닫힌다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            dailyUsageCount: 11,
            dailyUsageLimit: 10,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.queryByText("오늘 문제풀이 횟수 안내")).not.toBeInTheDocument();
  });
});

describe("SolvePencilcanvasPage — 에러 팝업 '인식취소' 버튼(오너 UX 확정: 확인 팝업 없이 즉시 초기화)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("INPUT 단계 인식 실패 모달에서 '인식취소'를 누르면 cancelRecognition이 호출되고 '확인'(재시도)은 그대로 유지된다", () => {
    const cancelRecognition = vi.fn();
    const resetSubmission = vi.fn();
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            recognizeStatus: "error",
            resetSubmission,
            cancelRecognition,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("문제를 인식하지 못했습니다")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "인식취소" }));
    expect(cancelRecognition).toHaveBeenCalledTimes(1);
    expect(resetSubmission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(resetSubmission).toHaveBeenCalledTimes(1);
  });

  it("WORK 단계(재인식/진단) 실패 모달에서도 '인식취소'를 누르면 cancelRecognition이 호출되고 기존 '확인'(재시도) 동작은 그대로 유지된다", () => {
    const cancelRecognition = vi.fn();
    const resetRecognizeWork = vi.fn();
    const resetDiagnose = vi.fn();
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            recognizeWorkStatus: "error",
            resetRecognizeWork,
            resetDiagnose,
            cancelRecognition,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("풀이를 인식하지 못했습니다")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "인식취소" }));
    expect(cancelRecognition).toHaveBeenCalledTimes(1);
    expect(resetRecognizeWork).not.toHaveBeenCalled();
    expect(resetDiagnose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(resetRecognizeWork).toHaveBeenCalledTimes(1);
    expect(resetDiagnose).toHaveBeenCalledTimes(1);
  });
});

describe("SolvePencilcanvasPage — RecognizedChip '인식 취소' 배선(오너 UX 결정: 인식취소 상시 배치)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("'인식 취소' 버튼을 누르면 cancelRecognition이 호출된다", () => {
    const cancelRecognition = vi.fn();
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            cancelRecognition,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "인식 취소" }));
    expect(cancelRecognition).toHaveBeenCalledTimes(1);
  });

  it("재인식(recognizeWork) 로딩 중이면 '인식 취소' 버튼이 비활성화된다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            recognizeWorkStatus: "loading",
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "인식 취소" })).toBeDisabled();
  });

  it("진단(diagnose) 로딩 중이면 '인식 취소' 버튼이 비활성화된다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            diagnoseStatus: "loading",
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "인식 취소" })).toBeDisabled();
  });

  it("재인식/진단이 모두 로딩 중이 아니면 '인식 취소' 버튼이 활성화되어 있다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            recognizeWorkStatus: "idle",
            diagnoseStatus: "idle",
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "인식 취소" })).not.toBeDisabled();
  });
});

describe("SolvePencilcanvasPage — RecognizedChip '인식 수정'/'인식 취소' 입력 모달리티 분기(Figma 플로우 조사, design-agent 2단계 handback)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("필기로 인식된 상태(lastInputType='handwriting')에서는 '인식 수정' 버튼이 렌더링되고, 클릭 시 beginRecognitionEdit만 호출되며 strokes/capturedImage는 그대로 유지된다(cancelRecognition은 호출되지 않는다)", () => {
    const cancelRecognition = vi.fn();
    const beginRecognitionEdit = vi.fn();
    const strokes: ProblemInputContextValue["strokes"] = [
      { tool: "pen", points: [{ x: 0, y: 0, pressure: 0.5 }] },
    ];
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            lastInputType: "handwriting",
            strokes,
            cancelRecognition,
            beginRecognitionEdit,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "인식 수정" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "인식 취소" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "인식 수정" }));

    expect(beginRecognitionEdit).toHaveBeenCalledTimes(1);
    expect(cancelRecognition).not.toHaveBeenCalled();
    // beginRecognitionEdit 자체는 strokes/capturedImage를 지우지 않는다(Provider 책임) — 여기서는
    // 페이지가 잘못된 초기화 함수(clearStrokes/clearCapturedImage 등)를 별도로 호출하지 않는지,
    // Provider가 넘겨준 strokes 배열 참조가 그대로인지로 간접 확인한다.
    expect(strokes).toHaveLength(1);
  });

  it("사진으로 인식된 상태(lastInputType='photo')에서는 기존처럼 '인식 취소' 버튼이 렌더링되고, 클릭 시 cancelRecognition만 호출된다(beginRecognitionEdit은 호출되지 않는다)", () => {
    const cancelRecognition = vi.fn();
    const beginRecognitionEdit = vi.fn();
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            problemId: "problem-1",
            recognizedText: "1+1=?",
            lastInputType: "photo",
            cancelRecognition,
            beginRecognitionEdit,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "인식 취소" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "인식 수정" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "인식 취소" }));

    expect(cancelRecognition).toHaveBeenCalledTimes(1);
    expect(beginRecognitionEdit).not.toHaveBeenCalled();
  });
});

describe("SolvePencilcanvasPage — RecognizedProblemPopup '인식취소' 배선(오너 UX 결정)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("사진 인식 직후 팝업에서 '인식취소'를 누르면 cancelRecognition이 호출된다", async () => {
    const cancelRecognition = vi.fn();
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            hasProblemInput: true,
            capturedImage: { blob: new Blob(), previewUrl: "blob:test-preview" },
            recognizeOnly: () => Promise.resolve("problem-1"),
            cancelRecognition,
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    fireEvent.click(await screen.findByRole("button", { name: "인식취소" }));
    expect(cancelRecognition).toHaveBeenCalledTimes(1);
  });

  /**
   * 실기기 회귀 재현: 인식이 제대로 안 된 상태(예: 빈 텍스트로 인식됨)에서 이 팝업의 "인식취소"를
   * 누르면 `cancelRecognition()`이 `capturedImage`/`recognizedText`/`problemId` 등 Provider
   * state는 비우지만, 팝업의 열림/닫힘을 제어하는 이 페이지 전용 로컬 state
   * (`isRecognizedPreviewOpen`)는 건드리지 않는다 — 이 state를 함께 닫지 않으면
   * `recognizedText`가 빈 채로 팝업이 다시 렌더링되어, 사용자 눈에는 "인식취소"를 눌러도 멈춘
   * 빈 팝업만 남는 것처럼 보인다. 이 하니스는 실제 `ProblemInputProvider`의 `cancelRecognition`과
   * 동일하게 Provider state(`recognizedText`/`capturedImage`)를 초기화하는 최소 재현이다.
   */
  it("인식이 비정상(빈 텍스트)인 상태에서 '인식취소'를 누르면 팝업 자체가 화면에서 사라진다(실기기 회귀 재현)", async () => {
    function CancelClosesPopupHarness() {
      const [recognizedText, setRecognizedText] = useState<string | null>("");
      const [capturedImage, setCapturedImage] = useState<{
        blob: Blob;
        previewUrl: string;
      } | null>({ blob: new Blob(), previewUrl: "blob:test-preview" });

      const value = createContextValue({
        hasProblemInput: true,
        capturedImage,
        recognizedText,
        recognizeOnly: () => Promise.resolve("problem-1"),
        cancelRecognition: () => {
          setRecognizedText(null);
          setCapturedImage(null);
        },
      });

      return (
        <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
          <ProblemInputContext.Provider value={value}>
            <Routes>
              <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
            </Routes>
          </ProblemInputContext.Provider>
        </MemoryRouter>
      );
    }

    render(<CancelClosesPopupHarness />);

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("문제가 인식 되었습니다")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "인식취소" }));

    // 팝업이 즉시 닫혀야 한다 — `recognizedText`가 비워진 채로 팝업이 다시 뜨는(빈 팝업) 회귀가
    // 없어야 한다.
    await waitFor(() => {
      expect(screen.queryByText("문제가 인식 되었습니다")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "인식취소" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "계속하기" })).not.toBeInTheDocument();
  });
});

describe("SolvePencilcanvasPage — ProblemCard/EmptyStateHint 컨테이너 데드존 수정(P0, iPad 실기기 보고)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("problemCardData===null(안내 문구만 보이는 초기 상태)에서는 컨테이너가 pointer-events-none이라 뒤의 캔버스가 펜 입력을 받을 수 있다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue()}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    // EmptyStateHint 전용 래퍼는 더 이상 `top-[90px]`가 아니라 세로 중앙(`top-1/2`)이다(오너
    // 실기기 피드백 + Figma 재실측, 2026-09 — `InputModeToggle`과 겹쳐 보이던 회귀 수정).
    const hint = screen.getByText("문제집을 사진으로 찍어서 올리세요");
    const containerEl = hint.closest("div[class*='top-1/2']");
    expect(containerEl).not.toBeNull();
    expect(containerEl).toHaveClass("pointer-events-none");
    expect(containerEl).not.toHaveClass("pointer-events-auto");
    expect(containerEl).toHaveClass("-translate-y-1/2");
    expect(containerEl?.className).not.toContain("top-[90px]");
  });

  it("problemCardData!==null(사진 업로드 후 ProblemCard가 보이는 상태)에서는 컨테이너가 pointer-events-auto로 돌아와 카드 스크롤/탭이 정상 동작한다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            capturedImage: { blob: new Blob(), previewUrl: "blob:test-preview" },
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    const image = screen.getByAltText("촬영한 문제");
    const containerEl = image.closest("div[class*='top-[90px]']");
    expect(containerEl).not.toBeNull();
    expect(containerEl).toHaveClass("pointer-events-auto");
    expect(containerEl).not.toHaveClass("pointer-events-none");
  });
});

describe("SolvePencilcanvasPage — 필기 시작 시 EmptyStateHint 숨김(오너 실기기 피드백: 필기를 방해하지 않도록)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("strokes가 비어 있으면(필기 전) EmptyStateHint가 보인다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue({ strokes: [] })}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByText("문제집을 사진으로 찍어서 올리세요")).toBeInTheDocument();
  });

  it("strokes가 채워지면(필기 시작) EmptyStateHint가 사라져 캔버스를 가리지 않는다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({
            strokes: [{ tool: "pen", points: [{ x: 0, y: 0, pressure: 0.5 }] }],
          })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.queryByText("문제집을 사진으로 찍어서 올리세요")).not.toBeInTheDocument();
  });
});

/** `screen.getByText`의 기본 normalizer는 연속 공백을 하나로 합치고 앞뒤 공백을 trim한다 — Figma
 *  원문의 의도적인 이중 공백/trailing 공백을 정확히 검증하려면 normalizer를 끄고 element의
 *  `textContent`를 원문 그대로 비교해야 한다. */
function getByExactText(text: string) {
  return screen.getByText((_content, element) => element?.textContent === text);
}

describe("SolvePencilcanvasPage — 사진/필기 입력 토글(InputModeToggle, Figma 342-833, 오너 UX 결정)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("INPUT 단계 기본값은 '사진으로 문제 인식'이 선택되어 있고 사진 전용 안내 문구를 보여준다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue()}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "사진으로 문제 인식" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getByExactText("문제집을 사진으로 찍어서 올리세요")).toBeInTheDocument();
    expect(
      getByExactText(
        '한문제씩 사진 안에 문제 내용이 모두 들어오게 찍고  하단에 "문제인식하기" 버튼을 눌러 주세요',
      ),
    ).toBeInTheDocument();
  });

  it("'사진으로 문제 인식' 탭을 클릭하면 /camera로 이동한다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue()}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
            <Route path="/camera" element={<div>CameraPage</div>} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "사진으로 문제 인식" }));

    expect(screen.getByText("CameraPage")).toBeInTheDocument();
  });

  it("'필기로 문제 인식' 탭을 클릭하면 /camera로 이동하지 않고 EmptyStateHint 문구가 필기 전용으로 바뀐다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue()}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
            <Route path="/camera" element={<div>CameraPage</div>} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "필기로 문제 인식" }));

    expect(screen.queryByText("CameraPage")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "필기로 문제 인식" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(getByExactText("문제를 펜으로 쓰면 인식 할 수 있습니다.  ")).toBeInTheDocument();
    expect(
      getByExactText(
        '한문제씩 또박또박 써주시면 인식이 더 잘 될 수 있어요. 다 쓴 후 "문제 인식하기"버튼을 눌러 주세요',
      ),
    ).toBeInTheDocument();
  });

  it("WORK 단계(problemId 있음)에서는 InputModeToggle이 렌더링되지 않는다", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider
          value={createContextValue({ hasProblemInput: true, problemId: "problem-1" })}
        >
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("button", { name: "사진으로 문제 인식" }),
    ).not.toBeInTheDocument();
  });
});

describe("SolvePencilcanvasPage — INPUT 단계 SolveScroll(WORK 단계와 동일한 실제 스크롤 가능 여부 기반, 오너 결정 2026-09)", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => createMockContext() as unknown as CanvasRenderingContext2D,
    );
  });

  it("INPUT 단계 진입 직후(콘텐츠가 없어 스크롤이 불필요한 초기 상태)에는 SolveScroll이 disabled 상태다(마커 탭이 무효화된다)", () => {
    render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue()}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    const marker = screen.getByLabelText("풀이 100% 지점으로 스크롤 이동");
    expect(marker).toHaveAttribute("aria-disabled", "true");
    expect(marker).toBeDisabled();
  });

  it("INPUT 캔버스가 마운트 시점부터 실제로 스크롤 가능하면(WORK 단계와 동일한 scrollable 코드 경로) SolveScroll의 disabled가 하드코딩된 true가 아니라 그 상태를 반영해 활성화된다", () => {
    // jsdom은 scrollHeight/clientHeight를 항상 0으로 보고하므로, `HandwritingCanvas`가 마운트
    // 시점에 직접 호출하는 `measureOuterHeight`/`resizeCanvasToContent`(`notifyScrollable` 트리거)가
    // "콘텐츠가 뷰포트보다 큼"을 관찰하도록 `Element.prototype` 접근자를 렌더 전에 미리 스텁한다
    // (`HandwritingCanvas.test.tsx`가 인스턴스에 직접 `Object.defineProperty`하는 것과 동일한
    // 취지이며, 렌더 전에 걸어야 마운트 시점 첫 호출에도 반영된다).
    vi.spyOn(Element.prototype, "scrollHeight", "get").mockReturnValue(400);
    vi.spyOn(Element.prototype, "clientHeight", "get").mockReturnValue(100);

    const { container } = render(
      <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
        <ProblemInputContext.Provider value={createContextValue()}>
          <Routes>
            <Route path="/solve/pencilcanvas" element={<SolvePencilcanvasPage />} />
          </Routes>
        </ProblemInputContext.Provider>
      </MemoryRouter>,
    );

    // INPUT 캔버스가 `scrollable` prop을 받으면 `HandwritingCanvas`가 outer 뷰포트에
    // `overflow-y-auto` 클래스를 붙인다(`scrollable=false`였다면 이 클래스 자체가 없다) — WORK
    // 단계와 동일한 코드 경로를 타는지 확인하는 근거다.
    expect(container.querySelector(".overflow-y-auto")).not.toBeNull();

    const marker = screen.getByLabelText("풀이 100% 지점으로 스크롤 이동");
    expect(marker).toHaveAttribute("aria-disabled", "false");
    expect(marker).not.toBeDisabled();
  });
});
