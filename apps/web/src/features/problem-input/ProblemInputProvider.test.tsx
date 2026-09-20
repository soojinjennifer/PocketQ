import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";
import type { ResumeStreamEvent } from "../../shared/api/resumeProblem";
import type { SolveStreamEvent } from "../../shared/api/solveProblem";
import { ProblemInputProvider } from "./ProblemInputProvider";
import { useProblemInput } from "./useProblemInput";

vi.mock("../../shared/api/recognizeProblem", () => ({
  recognizeProblem: vi.fn(),
}));
vi.mock("../../shared/api/problemHistory", () => ({
  reopenProblemHistory: vi.fn(),
}));
vi.mock("../../shared/api/solveProblem", () => ({
  solveProblemStream: vi.fn(),
}));
vi.mock("../../shared/api/chatMessage", () => ({
  sendChatMessage: vi.fn(),
}));
vi.mock("../../shared/api/recognizeWork", () => ({
  recognizeWork: vi.fn(),
}));
vi.mock("../../shared/api/diagnoseProblem", () => ({
  diagnoseProblem: vi.fn(),
}));
vi.mock("../../shared/api/resumeProblem", () => ({
  resumeProblemStream: vi.fn(),
}));
vi.mock("../../shared/api/suggestedQuestions", () => ({
  getSuggestedQuestions: vi.fn(),
}));

const { recognizeProblem } = await import("../../shared/api/recognizeProblem");
const { recognizeWork } = await import("../../shared/api/recognizeWork");
const { solveProblemStream } = await import("../../shared/api/solveProblem");
const { diagnoseProblem } = await import("../../shared/api/diagnoseProblem");
const { resumeProblemStream } = await import("../../shared/api/resumeProblem");

async function* eventsOf<T>(events: T[]) {
  await Promise.resolve();
  for (const event of events) {
    yield event;
  }
}

const SOLUTION = {
  conceptMd: null,
  solutionMd: "풀이",
  answerMd: "답",
  conceptTags: [],
  aiProvider: "openai" as const,
  aiModel: "gpt-5.6-terra",
};

const DIAGNOSIS = {
  lastValidLine: 1,
  stallLine: 2,
  errorTypeLabel: "부호 오류",
  errorDetail: "2번째 줄을 다시 확인하세요.",
  relatedConcepts: ["이차함수 > 완전제곱식"],
  reachedAnswerWithNotes: false,
  isLowConfidence: false,
  conceptExplanations: [],
  identifiedMethod: null,
  isMethodApplicable: true,
  methodApplicabilityNote: null,
  problemAnswerLatex: "-1",
};

const RESUME_SOLUTION = {
  mode: "own" as const,
  methodName: "3번째 줄부터 이어가기",
  solutionMd: "이어풀기 본문",
  answerMd: "답",
  verified: true,
};

/**
 * `SolvePencilcanvasPage.test.tsx`/`RequireProblemInputGuard.test.tsx`와 달리, 이 테스트는 mock
 * 컨텍스트가 아니라 실제 `ProblemInputProvider`를 렌더링해 `cancelRecognition()`이 하위 훅들의
 * 실제 state까지 정확히 초기화하는지 검증한다. 화면 조립(`SolvePencilcanvasPage`)을 거치지 않고
 * `useProblemInput()`을 직접 소비하는 최소 Consumer로 필요한 필드만 노출한다.
 */
function Consumer() {
  const {
    capturedImage,
    setCapturedImage,
    strokes,
    commitStroke,
    lastInputType,
    recognizeStatus,
    problemId,
    recognizedText,
    dailyUsageCount,
    solveStatus,
    suggestedQuestions,
    recognizeOnly,
    cancelRecognition,
    workStrokes,
    commitWorkStroke,
    workLines,
    recognizeWorkStatus,
    diagnoseStatus,
    recognizeWork: doRecognizeWork,
    resumeStatus,
    returnToWorkFromResult,
    giveUp,
    diagnose,
    startResume,
  } = useProblemInput();

  return (
    <div>
      <div data-testid="capturedImage">{capturedImage ? "has-image" : "no-image"}</div>
      <div data-testid="strokes">{strokes.length}</div>
      <div data-testid="lastInputType">{lastInputType ?? "null"}</div>
      <div data-testid="recognizeStatus">{recognizeStatus}</div>
      <div data-testid="problemId">{problemId ?? "null"}</div>
      <div data-testid="recognizedText">{recognizedText ?? "null"}</div>
      <div data-testid="dailyUsageCount">{dailyUsageCount ?? "null"}</div>
      <div data-testid="solveStatus">{solveStatus}</div>
      <div data-testid="suggestedQuestions">{suggestedQuestions ? "has-suggestions" : "null"}</div>
      <div data-testid="workStrokes">{workStrokes.length}</div>
      <div data-testid="workLines">{workLines ? "has-work-lines" : "null"}</div>
      <div data-testid="recognizeWorkStatus">{recognizeWorkStatus}</div>
      <div data-testid="diagnoseStatus">{diagnoseStatus}</div>
      <div data-testid="resumeStatus">{resumeStatus}</div>

      <button onClick={() => setCapturedImage(new Blob(["fake"], { type: "image/jpeg" }))}>
        사진설정
      </button>
      <button onClick={() => commitStroke({ tool: "pen", points: [{ x: 0, y: 0, pressure: 1 }] })}>
        필기추가
      </button>
      <button onClick={() => commitWorkStroke({ tool: "pen", points: [{ x: 0, y: 0, pressure: 1 }] })}>
        WORK필기추가
      </button>
      <button onClick={() => void recognizeOnly()}>인식하기</button>
      <button
        onClick={() => {
          if (problemId) {
            void doRecognizeWork({ problemId, imageBlob: new Blob(["fake"]) });
          }
        }}
      >
        WORK인식하기
      </button>
      <button onClick={() => void giveUp()}>풀이생성</button>
      <button
        onClick={() => {
          if (problemId) {
            void diagnose({ problemId, workLines: [{ lineNo: 1, latex: "x" }] });
          }
        }}
      >
        진단하기
      </button>
      <button onClick={() => void startResume("own")}>이어풀기하기</button>
      <button onClick={cancelRecognition}>인식취소</button>
      <button onClick={returnToWorkFromResult}>결과에서수정</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
      <Routes>
        <Route element={<ProblemInputProvider grade="M2" />}>
          <Route path="/solve/pencilcanvas" element={<Consumer />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProblemInputProvider — cancelRecognition (인식취소, 오너 UX 확정)", () => {
  it("INPUT 단계 인식 실패 후 호출하면 사진/필기/recognize/solve/lastInputType/제안질문 상태가 모두 초기 상태로 돌아간다", async () => {
    vi.mocked(recognizeProblem).mockRejectedValue(
      new ApiError("recognition_failed", "문제를 인식할 수 없습니다.", 422),
    );

    renderProvider();

    fireEvent.click(screen.getByText("사진설정"));
    fireEvent.click(screen.getByText("필기추가"));
    expect(screen.getByTestId("capturedImage")).toHaveTextContent("has-image");
    expect(screen.getByTestId("strokes")).toHaveTextContent("1");

    fireEvent.click(screen.getByText("인식하기"));
    await waitFor(() => expect(screen.getByTestId("recognizeStatus")).toHaveTextContent("error"));
    expect(screen.getByTestId("lastInputType")).toHaveTextContent("photo");

    fireEvent.click(screen.getByText("인식취소"));

    expect(screen.getByTestId("capturedImage")).toHaveTextContent("no-image");
    expect(screen.getByTestId("strokes")).toHaveTextContent("0");
    expect(screen.getByTestId("recognizeStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("problemId")).toHaveTextContent("null");
    expect(screen.getByTestId("recognizedText")).toHaveTextContent("null");
    expect(screen.getByTestId("dailyUsageCount")).toHaveTextContent("null");
    expect(screen.getByTestId("solveStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("lastInputType")).toHaveTextContent("null");
    expect(screen.getByTestId("suggestedQuestions")).toHaveTextContent("null");
  });

  it("WORK 단계(재인식) 실패 후 호출하면 problemId/WORK 캔버스/인식결과까지 모두 초기 INPUT 빈 상태로 돌아간다", async () => {
    vi.mocked(recognizeProblem).mockResolvedValue({
      problemId: "problem-1",
      recognizedText: "1+1=?",
      recognizedLatex: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    vi.mocked(recognizeWork).mockRejectedValue(
      new ApiError("internal_error", "학생 풀이 인식 중 오류가 발생했습니다.", 500),
    );

    renderProvider();

    fireEvent.click(screen.getByText("사진설정"));
    fireEvent.click(screen.getByText("인식하기"));
    await waitFor(() => expect(screen.getByTestId("problemId")).toHaveTextContent("problem-1"));

    fireEvent.click(screen.getByText("WORK필기추가"));
    expect(screen.getByTestId("workStrokes")).toHaveTextContent("1");

    fireEvent.click(screen.getByText("WORK인식하기"));
    await waitFor(() =>
      expect(screen.getByTestId("recognizeWorkStatus")).toHaveTextContent("error"),
    );

    fireEvent.click(screen.getByText("인식취소"));

    expect(screen.getByTestId("problemId")).toHaveTextContent("null");
    expect(screen.getByTestId("recognizeStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("recognizedText")).toHaveTextContent("null");
    expect(screen.getByTestId("workStrokes")).toHaveTextContent("0");
    expect(screen.getByTestId("workLines")).toHaveTextContent("null");
    expect(screen.getByTestId("recognizeWorkStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("diagnoseStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("capturedImage")).toHaveTextContent("no-image");
    expect(screen.getByTestId("lastInputType")).toHaveTextContent("null");
  });
});

describe("ProblemInputProvider — returnToWorkFromResult (`/solve/landscape` '수정', 2026-09 목적지 재정의)", () => {
  it("problemId/recognizedText/workStrokes는 그대로 두고 solveStatus/diagnoseStatus/resumeStatus만 idle로 되돌린다", async () => {
    vi.mocked(recognizeProblem).mockResolvedValue({
      problemId: "problem-1",
      recognizedText: "1+1=?",
      recognizedLatex: null,
      createdAt: "2026-09-01T00:00:00.000Z",
    });
    vi.mocked(solveProblemStream).mockReturnValue(
      eventsOf<SolveStreamEvent>([{ type: "done", result: SOLUTION }]),
    );
    vi.mocked(diagnoseProblem).mockResolvedValue(DIAGNOSIS);
    vi.mocked(resumeProblemStream).mockReturnValue(
      eventsOf<ResumeStreamEvent>([{ type: "done", result: RESUME_SOLUTION }]),
    );

    renderProvider();

    fireEvent.click(screen.getByText("사진설정"));
    fireEvent.click(screen.getByText("인식하기"));
    await waitFor(() => expect(screen.getByTestId("problemId")).toHaveTextContent("problem-1"));

    fireEvent.click(screen.getByText("WORK필기추가"));
    expect(screen.getByTestId("workStrokes")).toHaveTextContent("1");

    fireEvent.click(screen.getByText("풀이생성"));
    await waitFor(() => expect(screen.getByTestId("solveStatus")).toHaveTextContent("success"));

    fireEvent.click(screen.getByText("진단하기"));
    await waitFor(() => expect(screen.getByTestId("diagnoseStatus")).toHaveTextContent("success"));

    fireEvent.click(screen.getByText("이어풀기하기"));
    await waitFor(() => expect(screen.getByTestId("resumeStatus")).toHaveTextContent("success"));

    fireEvent.click(screen.getByText("결과에서수정"));

    // 결과/진단/이어풀기 진행 상태만 초기화된다.
    expect(screen.getByTestId("solveStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("diagnoseStatus")).toHaveTextContent("idle");
    expect(screen.getByTestId("resumeStatus")).toHaveTextContent("idle");
    // 문제 인식(problemId/recognizedText)과 학생이 이미 쓴 풀이(workStrokes)는 그대로 보존된다.
    expect(screen.getByTestId("problemId")).toHaveTextContent("problem-1");
    expect(screen.getByTestId("recognizedText")).toHaveTextContent("1+1=?");
    expect(screen.getByTestId("workStrokes")).toHaveTextContent("1");
  });
});
