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
    startStroke: () => undefined,
    addPoint: () => undefined,
    undoStroke: () => undefined,
    clearStrokes: () => undefined,
    hasProblemInput: false,
    selectedOptionIds: new Set<string>(),
    toggleOption: () => undefined,
    recognizeStatus: "idle",
    problemId: null,
    recognizedText: null,
    solveStatus: "idle",
    streamedText: "",
    solveResult: null,
    submitErrorMessage: null,
    submitProblem: () => Promise.resolve(),
    resumeFromHistory: () => Promise.resolve(false),
    resetSubmission: () => undefined,
    chatMessages: [],
    chatStatus: "idle",
    chatErrorMessage: null,
    sendChatMessage: () => Promise.resolve(false),
    resetChat: () => undefined,
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

  it("problemId가 있으면(제출 성공 후 사진 정리) 계속 접근을 허용한다", () => {
    renderGuard(
      createContextValue({ problemId: "problem-1", recognizeStatus: "success" }),
      "/solve/landscape",
    );

    expect(screen.getByText("LandscapePage")).toBeInTheDocument();
  });
});
