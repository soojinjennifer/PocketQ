import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { ProblemInputContext, type ProblemInputContextValue } from "./ProblemInputContext";
import { RequireProblemInputGuard } from "./RequireProblemInputGuard";

/** 가드가 실제로 보는 필드(`hasProblemInput`/`problemId`/`recognizeStatus`)만 덮어쓰는 최소 컨텍스트. */
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

function renderGuard(
  value: ProblemInputContextValue,
  initialEntry: { pathname: string; state?: unknown } | string,
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ProblemInputContext.Provider value={value}>
        <Routes>
          <Route
            path="/solve/landscape"
            element={
              <RequireProblemInputGuard>
                <div>LandscapePage</div>
              </RequireProblemInputGuard>
            }
          />
          <Route path="/camera" element={<div>CameraPage</div>} />
        </Routes>
      </ProblemInputContext.Provider>
    </MemoryRouter>,
  );
}

describe("RequireProblemInputGuard", () => {
  it("사진/필기 입력이 있으면 자식을 렌더링한다", () => {
    renderGuard(createContextValue({ hasProblemInput: true }), "/solve/landscape");

    expect(screen.getByText("LandscapePage")).toBeInTheDocument();
  });

  it("입력도 세션도 없으면 /camera로 리다이렉트한다", async () => {
    renderGuard(createContextValue(), "/solve/landscape");

    await waitFor(() => expect(screen.getByText("CameraPage")).toBeInTheDocument());
    expect(screen.queryByText("LandscapePage")).not.toBeInTheDocument();
  });

  it("마이페이지 '다시 풀기'로 넘어온 location.state가 있으면 입력이 없어도 통과시킨다", async () => {
    renderGuard(createContextValue(), {
      pathname: "/solve/landscape",
      state: { resumeProblemId: "problem-1" },
    });

    expect(screen.getByText("LandscapePage")).toBeInTheDocument();
    // 리다이렉트가 지연 실행되지 않는지도 확인한다(가드가 렌더 직후 튕기면 자식 effect가 재수화를
    // 트리거할 기회조차 없다).
    await waitFor(() => expect(screen.queryByText("CameraPage")).not.toBeInTheDocument());
  });

  it("재수화 진행 중(recognizeStatus=loading, state 소비 후)에도 튕기지 않는다", async () => {
    renderGuard(createContextValue({ recognizeStatus: "loading" }), "/solve/landscape");

    expect(screen.getByText("LandscapePage")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("CameraPage")).not.toBeInTheDocument());
  });

  it("isRequestingReinput이면(결과 화면 '수정' 확인 직후) 입력이 없어도 튕기지 않는다(예외 3)", async () => {
    renderGuard(createContextValue({ isRequestingReinput: true }), "/solve/landscape");

    expect(screen.getByText("LandscapePage")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("CameraPage")).not.toBeInTheDocument());
  });

  it("problemId가 있으면(제출 성공 후 사진 정리) 계속 접근을 허용한다", () => {
    renderGuard(
      createContextValue({ problemId: "problem-1", recognizeStatus: "success" }),
      "/solve/landscape",
    );

    expect(screen.getByText("LandscapePage")).toBeInTheDocument();
  });

  // `cancelRecognition()`("인식취소", plan-agent가 지목한 위험 포인트)은 사진/필기 입력, problemId,
  // recognizeStatus를 모두 idle/빈 상태로 되돌린다 — 이 함수 자체는 `/solve/pencilcanvas`(가드 없음)
  // 에서만 호출되지만, 혹시라도 `isRequestingReinput`을 잘못 건드려 `/solve/landscape` 가드의
  // 예외 3(§27-30행)을 실수로 만족시키면 입력이 전혀 없는데도 WORK 화면(`/solve/landscape`)에
  // 접근이 허용되는 회귀가 생긴다. `cancelRecognition()`이 만들어내는 정확한 상태 조합(입력 없음 +
  // problemId 없음 + recognizeStatus idle + isRequestingReinput 그대로 false)에서는 다른 "입력
  // 없음" 상황과 동일하게 여전히 `/camera`로 리다이렉트되어야 한다(=INPUT 단계 진입점으로 돌아가
  // 빈 상태를 정상적으로 유지) — `isRequestingReinput`을 우회 트리거하지 않았음을 확인하는 것이
  // 핵심이다.
  it("cancelRecognition() 직후 상태(입력 없음, isRequestingReinput 미변경)에서도 /camera로 정상 리다이렉트되어(예외 우회 없음) INPUT 진입점을 유지한다", async () => {
    renderGuard(
      createContextValue({
        hasProblemInput: false,
        problemId: null,
        recognizeStatus: "idle",
        isRequestingReinput: false,
      }),
      "/solve/landscape",
    );

    await waitFor(() => expect(screen.getByText("CameraPage")).toBeInTheDocument());
    expect(screen.queryByText("LandscapePage")).not.toBeInTheDocument();
  });
});
