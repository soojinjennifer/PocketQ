/**
 * Stage 5 WU7 — 마이페이지 재조회 그림(웹 플래그 on). `docs/FIGURE_DESIGN.md` §18.4·§18.5.
 * S5-9(같은 단계 = 같은 그림, 기본 최종, 10회 열고 닫기 후 보드 0), S5-10(보드 수 = 보이는 그림 수, 언마운트 후 0),
 * 결과별 단계 state(solveStep/resumeStep 독립), 문제 전환 시 최종으로, 도형 없으면 슬롯 없음(DOM = WU0 기준값).
 * JSXGraph 청크는 불러오지 않는다(보드 상자 단계 — 실제 JSXGraph 보드는 헤드리스 §8에서 확인).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemHistoryDetailDto } from "validation";
import { F01_TRIANGLE_ANGLE, F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { AuthContext, type AuthContextValue } from "../../features/auth/AuthContext";
import { createFakeSession } from "../../test/supabaseTestUtils";
import { applyStage5OneLineDelta, sortClassTokens } from "../../test/stage5OneLineDelta";
import baselineJson from "./__baseline__/myPageDetailDom.baseline.json";

vi.stubEnv("VITE_FIGURES_ENABLED", "true");
vi.mock("../../features/figure-visualization/jsxgraphAdapter", () => ({ loadJsxGraph: () => new Promise(() => {}) }));
vi.mock("../../shared/lib/supabase/client", () => ({ supabase: { auth: { signOut: vi.fn() } } }));
vi.mock("../../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(),
  getProblemHistoryDetail: vi.fn(),
  bulkDeleteProblemHistory: vi.fn(),
}));

const { getProblemHistoryDetail, listProblemHistory } = await import("../../shared/api/problemHistory");
const { MyPage } = await import("./MyPage");

const AT = "2026-10-25T01:00:00.000Z";
const ITEMS = [
  { problemId: "p1", recognizedText: "삼각형 ABC의 높이와 중선", conceptTags: ["삼각형"], createdAt: AT },
  { problemId: "p2", recognizedText: "각 BAC", conceptTags: [], createdAt: AT },
];
const SOLVE_MD = "## 풀이\n**1단계** 삼각형을 그린다.\n**2단계** 높이 AH를 긋는다.\n**3단계** 중선 AM을 긋는다.";
const RESUME_MD = "## 이어풀기\n**1단계** 각을 본다.\n**2단계** 45°를 확인한다.";

const BOTH: ProblemHistoryDetailDto = {
  problemId: "p1",
  recognizedText: ITEMS[0]!.recognizedText,
  recognizedLatex: null,
  createdAt: AT,
  solution: {
    conceptMd: null,
    solutionMd: SOLVE_MD,
    answerMd: "AH = 3",
    conceptTags: ["삼각형"],
    aiProvider: "openai",
    aiModel: "m",
    figures: [F09_STEPWISE_AUXILIARY.raw],
    stepFigureRefs: [{ stepId: "s2", figureId: "fig-f09" }],
  },
  resumeSolution: {
    mode: "alternative",
    methodName: "새로운 방법으로 처음부터 풀기",
    solutionMd: RESUME_MD,
    answerMd: "45",
    verified: true,
    figures: [F01_TRIANGLE_ANGLE.raw],
    stepFigureRefs: [{ stepId: "s2", figureId: "fig-f01" }],
  },
  chatMessages: [],
};

function renderMyPage() {
  const authValue: AuthContextValue = {
    status: "authenticated",
    user: createFakeSession({ user_metadata: { nickname: "지민", grade: "H1" } }).user,
    holdPublicRedirect: false,
    setHoldPublicRedirect: () => undefined,
    isPasswordRecovery: false,
    setIsPasswordRecovery: () => undefined,
  };
  return render(
    <MemoryRouter initialEntries={["/mypage"]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/mypage" element={<MyPage />} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

async function openRow(name: RegExp): Promise<HTMLElement> {
  await waitFor(() => expect(screen.getAllByRole("button", { name }).length).toBeGreaterThan(0));
  fireEvent.click(screen.getAllByRole("button", { name })[0]!);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.textContent).not.toContain("풀이를 불러오는 중"));
  return dialog;
}

function figureSections(dialog: HTMLElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>("[data-figure-slot] section")];
}

function boards(): number {
  return document.querySelectorAll("[id^='figboard']").length;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
});

describe("재조회 그림", () => {
  it("solve·resume 그림이 각자 자리에(답 앞), 보드 수 = 그림 수, 기본 최종, 단계는 결과별로 독립", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(BOTH);
    renderMyPage();
    const dialog = await openRow(/삼각형 ABC/);
    await waitFor(() => expect(figureSections(dialog)).toHaveLength(2));
    expect(boards()).toBe(2);
    const [solveFigure, resumeFigure] = figureSections(dialog);
    const text = dialog.textContent ?? "";
    expect(text.indexOf("높이 AH")).toBeLessThan(text.indexOf("AH = 3"));
    expect(text.indexOf("AH = 3")).toBeLessThan(text.indexOf("이어풀기 결과"));
    expect(within(solveFigure!).getByText("최종")).toBeInTheDocument();
    expect(within(resumeFigure!).getByText("최종")).toBeInTheDocument();

    fireEvent.click(within(solveFigure!).getByRole("button", { name: "이전" }));
    fireEvent.click(within(solveFigure!).getByRole("button", { name: "이전" }));
    expect(within(solveFigure!).getByText("2단계 / 3")).toBeInTheDocument();
    expect(within(resumeFigure!).getByText("최종")).toBeInTheDocument();
    // solve 단계 블록만 강조된다.
    const current = [...dialog.querySelectorAll("li[aria-current='step']")].map((li) => li.textContent ?? "");
    expect(current).toHaveLength(1);
    expect(current[0]).toContain("높이 AH");

    fireEvent.click(within(resumeFigure!).getByRole("button", { name: "이전" }));
    expect(within(resumeFigure!).getByText("2단계 / 2")).toBeInTheDocument();
    expect(within(solveFigure!).getByText("2단계 / 3")).toBeInTheDocument();
  });

  it("다른 문제로 바꾸거나 닫았다 다시 열면 단계가 최종으로, 10회 열고 닫은 뒤 보드 0", async () => {
    vi.mocked(getProblemHistoryDetail).mockImplementation((id: string) =>
      Promise.resolve(id === "p1" ? BOTH : { ...BOTH, problemId: "p2", recognizedText: "각 BAC" }),
    );
    renderMyPage();
    let dialog = await openRow(/삼각형 ABC/);
    await waitFor(() => expect(figureSections(dialog)).toHaveLength(2));
    fireEvent.click(within(figureSections(dialog)[0]!).getByRole("button", { name: "이전" }));
    expect(within(figureSections(dialog)[0]!).getByText("3단계 / 3")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "목록으로" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(boards()).toBe(0);

    for (let i = 0; i < 10; i += 1) {
      dialog = await openRow(i % 2 === 0 ? /삼각형 ABC/ : /각 BAC/);
      await waitFor(() => expect(figureSections(dialog)).toHaveLength(2));
      expect(boards()).toBe(2);
      for (const section of figureSections(dialog)) expect(within(section).getByText("최종")).toBeInTheDocument();
      fireEvent.keyDown(window, { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(boards()).toBe(0);
    }
  });

  it("도형이 없거나 상세 도형이 전부 변조로 거부되면 그림 카드 0(래퍼 유무는 §18.5 규칙), 보드 0", async () => {
    const tampered = { ...BOTH, resumeSolution: undefined, solution: { ...BOTH.solution!, figures: [{ broken: true }] } };
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(tampered);
    renderMyPage();
    const dialog = await openRow(/삼각형 ABC/);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(figureSections(dialog)).toHaveLength(0);
    expect(boards()).toBe(0);
    expect(dialog.textContent).toContain("AH = 3");
  });

  it("S5-14: 웹 on이어도 도형 없는 solve 상세의 DOM은 WU0 기준값(승인 클래스 변경만 적용)과 같다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({
      items: [{ problemId: "problem-1", recognizedText: "삼각형 ABC의 높이와 중선", conceptTags: ["삼각형"], createdAt: AT }],
    });
    vi.mocked(getProblemHistoryDetail).mockResolvedValue({
      problemId: "problem-1",
      recognizedText: "삼각형 ABC의 높이와 중선",
      recognizedLatex: "AH",
      createdAt: AT,
      solution: { ...BOTH.solution!, conceptMd: null, answerMd: "\\(AH = 3\\)", solutionMd: SOLVE_MD, figures: undefined, stepFigureRefs: undefined },
      chatMessages: [],
    });
    renderMyPage();
    const dialog = await openRow(/삼각형 ABC/);
    const html = (baselineJson as { html: Record<string, string> }).html["withSolutionNoChat"] ?? "";
    expect(sortClassTokens(dialog.outerHTML)).toBe(sortClassTokens(applyStage5OneLineDelta(html)));
  });
});
