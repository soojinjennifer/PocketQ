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

    const hint = screen.getByText("Apple Pencil이나 마우스로 문제를 써 보세요");
    const containerEl = hint.closest("div[class*='top-[90px]']");
    expect(containerEl).not.toBeNull();
    expect(containerEl).toHaveClass("pointer-events-none");
    expect(containerEl).not.toHaveClass("pointer-events-auto");
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
