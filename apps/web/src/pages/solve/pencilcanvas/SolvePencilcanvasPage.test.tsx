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
    startStroke: () => undefined,
    addPoint: () => undefined,
    undoStroke: () => undefined,
    clearStrokes: () => undefined,
    workStrokes: [],
    workTool: "pen",
    setWorkTool: () => undefined,
    startWorkStroke: () => undefined,
    addWorkPoint: () => undefined,
    undoWorkStroke: () => undefined,
    clearWorkStrokes: () => undefined,
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
