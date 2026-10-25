/**
 * Stage 5 WU0 — 마이페이지 상세 오버레이 DOM의 변경 전 기준값(S5-1 "MyPage DOM 동일", RS8 "resume 없으면 DOM 동일",
 * S5-14 "저장 도형 있는 행도 웹 off면 DOM 동일"). WU7의 비교 기준이다.
 *
 * `myPageDetailDom.baseline.json`은 Stage 5 코드를 바꾸기 **전**(HEAD 091ae2a 작업 트리)에 이 파일의 같은 절차로
 * 캡처했다(캡처 직후 캡처 분기는 제거했다 — 다시 캡처하지 않는다). 실제 `MyPage` + 라우터, API 모듈만 mock:
 * 목록 → 행 클릭 → dialog의 `outerHTML`. `withFigures`는 상세 응답의 solution에 저장 도형 키가 있는 경우다
 * (변경 전 웹은 이 키를 쓰지 않는다).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it, vi } from "vitest";
import baselineJson from "./myPageDetailDom.baseline.json";
import type { ProblemHistoryDetailDto } from "validation";
import { F09_STEPWISE_AUXILIARY } from "validation/src/figures/fixtures";
import { AuthContext, type AuthContextValue } from "../../../features/auth/AuthContext";
import { applyStage5OneLineDelta, sortClassTokens } from "../../../test/stage5OneLineDelta";
import { createFakeSession } from "../../../test/supabaseTestUtils";

vi.mock("../../../shared/lib/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

vi.mock("../../../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(),
  getProblemHistoryDetail: vi.fn(),
  bulkDeleteProblemHistory: vi.fn(),
}));

const { getProblemHistoryDetail, listProblemHistory } = await import("../../../shared/api/problemHistory");
const { MyPage } = await import("../MyPage");

const CREATED_AT = "2026-10-25T01:00:00.000Z";
const ITEM = { problemId: "problem-1", recognizedText: "삼각형 ABC의 높이와 중선", conceptTags: ["삼각형"], createdAt: CREATED_AT };

const SOLUTION = {
  conceptMd: "## 개념 설명\n수선의 발",
  solutionMd: "## 풀이\n**1단계** 삼각형을 그린다.\n**2단계** 높이 AH를 긋는다.\n**3단계** 중선 AM을 긋는다.",
  answerMd: "\\(AH = 3\\)",
  conceptTags: ["삼각형"],
  aiProvider: "openai" as const,
  aiModel: "gpt-test",
};

const CASES: Record<string, ProblemHistoryDetailDto> = {
  withSolutionAndChat: {
    problemId: "problem-1",
    recognizedText: ITEM.recognizedText,
    recognizedLatex: null,
    createdAt: CREATED_AT,
    solution: SOLUTION,
    chatMessages: [
      { role: "user", content: "왜 수선인가요?", createdAt: CREATED_AT },
      { role: "assistant", content: "높이는 수선이에요.", createdAt: CREATED_AT },
    ],
  },
  withSolutionNoChat: {
    problemId: "problem-1",
    recognizedText: ITEM.recognizedText,
    recognizedLatex: "AH",
    createdAt: CREATED_AT,
    solution: { ...SOLUTION, conceptMd: null },
    chatMessages: [],
  },
  noSolution: {
    problemId: "problem-1",
    recognizedText: ITEM.recognizedText,
    recognizedLatex: null,
    createdAt: CREATED_AT,
    solution: null,
    chatMessages: [],
  },
  withFigures: {
    problemId: "problem-1",
    recognizedText: ITEM.recognizedText,
    recognizedLatex: null,
    createdAt: CREATED_AT,
    solution: {
      ...SOLUTION,
      figures: [F09_STEPWISE_AUXILIARY.raw],
      stepFigureRefs: [
        { stepId: "s1", figureId: "fig-f09" },
        { stepId: "s2", figureId: "fig-f09" },
        { stepId: "s3", figureId: "fig-f09" },
      ],
    },
    chatMessages: [],
  },
};

const baseline = baselineJson as { html: Record<string, string> };

async function renderDetail(detail: ProblemHistoryDetailDto): Promise<string> {
  vi.mocked(listProblemHistory).mockResolvedValue({ items: [ITEM] });
  vi.mocked(getProblemHistoryDetail).mockResolvedValue(detail);
  const authValue: AuthContextValue = {
    status: "authenticated",
    user: createFakeSession({ user_metadata: { nickname: "지민", grade: "H1" } }).user,
    holdPublicRedirect: false,
    setHoldPublicRedirect: () => undefined,
    isPasswordRecovery: false,
    setIsPasswordRecovery: () => undefined,
  };
  const view = render(
    <MemoryRouter initialEntries={["/mypage"]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(screen.getAllByText(ITEM.recognizedText).length).toBeGreaterThan(0));
  fireEvent.click(screen.getAllByRole("button", { name: /삼각형 ABC의 높이와 중선/ })[0]!);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.textContent).not.toContain("풀이를 불러오는 중"));
  const html = dialog.outerHTML;
  view.unmount();
  return html;
}

describe("Stage 5 WU0 — 마이페이지 상세 DOM 기준값(resume 없음)", () => {
  it.each(Object.keys(CASES))("%s: dialog outerHTML이 기준값과 같다", async (key) => {
    const detail = CASES[key];
    if (!detail) throw new Error(key);
    // Stage 5: RecognizedProblemBar 승인 클래스 변경(S5-V7·V8·V10)만 기준값에 적용하고 class 토큰 순서를 무시해 비교한다(장부 §8).
    expect(sortClassTokens(await renderDetail(detail))).toBe(sortClassTokens(applyStage5OneLineDelta(baseline.html[key] ?? "")));
  });
});
