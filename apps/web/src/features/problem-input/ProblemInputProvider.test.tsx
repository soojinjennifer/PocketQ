import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../shared/api/ApiError";
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
      <button onClick={cancelRecognition}>인식취소</button>
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
