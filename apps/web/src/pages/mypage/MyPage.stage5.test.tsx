/**
 * Stage 5 WU7a·WU7 — 마이페이지 재조회(웹 플래그 off 기본). `docs/FIGURE_DESIGN.md` §18.1·§18.3·§18.13.
 * RS8(resume 카드·"저장된 풀이가 없는 문제예요" 없음), RS11b(과거 행·own 대체 문구), RS11c(읽기 전용 WorkLineList·배지),
 * RS12(포커스 이동·복귀 3경로·inert).
 */
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemHistoryDetailDto } from "validation";
import { AuthContext, type AuthContextValue } from "../../features/auth/AuthContext";
import { createFakeSession } from "../../test/supabaseTestUtils";

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
  { problemId: "p1", recognizedText: "첫 번째 문제", conceptTags: ["삼각형"], createdAt: AT },
  { problemId: "p2", recognizedText: "두 번째 문제", conceptTags: [], createdAt: AT },
];
const SOLUTION = {
  conceptMd: null,
  solutionMd: "## 풀이\n**1단계** 정리",
  answerMd: "42",
  conceptTags: ["삼각형"],
  aiProvider: "openai" as const,
  aiModel: "m",
};
const RESUME = {
  mode: "own" as const,
  methodName: "3번째 줄부터 이어가기",
  solutionMd: "## 이어풀기\n**1단계** 이어서 정리",
  answerMd: "-1",
  verified: true,
};
const WORK = {
  lines: [
    { lineNo: 1, latex: "x + 1 = 3" },
    { lineNo: 2, latex: "x = 2" },
    { lineNo: 3, latex: "x = 5" },
    { lineNo: 4, latex: "끝" },
  ],
  lastValidLine: 2,
  stallLine: 3,
};

function detail(overrides: Partial<ProblemHistoryDetailDto>): ProblemHistoryDetailDto {
  return { problemId: "p1", recognizedText: "첫 번째 문제", recognizedLatex: null, createdAt: AT, solution: null, chatMessages: [], ...overrides };
}

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

async function open(name: RegExp, focusFirst = true): Promise<{ row: HTMLElement; dialog: HTMLElement }> {
  await waitFor(() => expect(screen.getAllByRole("button", { name }).length).toBeGreaterThan(0));
  const row = screen.getAllByRole("button", { name })[0]!;
  if (focusFirst) row.focus();
  fireEvent.click(row);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() => expect(dialog.textContent).not.toContain("풀이를 불러오는 중"));
  return { row, dialog };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
});

describe("RS8·RS11 resume 섹션 조립", () => {
  it("resume만: '저장된 풀이가 없는 문제예요' 없음, h3 sr-only, 학생 줄(읽기 전용·배지) → 이어풀기 카드 → 답", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(detail({ resumeSolution: { ...RESUME, workContext: WORK } }));
    renderMyPage();
    const { dialog } = await open(/첫 번째 문제/);
    expect(within(dialog).queryByText("저장된 풀이가 없는 문제예요")).not.toBeInTheDocument();
    const heading = within(dialog).getByRole("heading", { level: 3, name: "이어풀기 결과" });
    expect(heading.className).toContain("sr-only");
    expect(within(dialog).getByRole("region", { name: "이어풀기 결과" })).toBeInTheDocument();
    expect(within(dialog).getByText("내가 쓴 풀이")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "수정" })).not.toBeInTheDocument();
    // 판정: 1·2 확인, 3 막힌 지점, 4 배지 없음(실시간 화면과 같은 함수).
    expect(within(dialog).getAllByText("확인")).toHaveLength(2);
    expect(within(dialog).getAllByText("막힌 지점")).toHaveLength(1);
    expect(within(dialog).getByText("3번째 줄부터 이어가기")).toBeInTheDocument();
    const text = dialog.textContent ?? "";
    expect(text.indexOf("내가 쓴 풀이")).toBeLessThan(text.indexOf("3번째 줄부터 이어가기"));
    expect(within(dialog).getByRole("button", { name: "다시 풀기" })).toBeInTheDocument();
  });

  it("solve + resume: h3가 보이고(pt-3), 순서는 solve 답 → 이어풀기 머리말 → 학생 줄 → 이어풀기 카드 → 대화", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(
      detail({
        solution: SOLUTION,
        resumeSolution: { ...RESUME, mode: "alternative", methodName: "새로운 방법으로 처음부터 풀기", workContext: WORK },
        chatMessages: [{ role: "user", content: "대화 질문", createdAt: AT }],
      }),
    );
    renderMyPage();
    const { dialog } = await open(/첫 번째 문제/);
    const heading = within(dialog).getByRole("heading", { level: 3, name: "이어풀기 결과" });
    expect(heading.className).not.toContain("sr-only");
    expect(heading.className).toContain("pt-3");
    const text = dialog.textContent ?? "";
    const order = ["42", "이어풀기 결과", "내가 쓴 풀이", "새로운 방법으로 처음부터 풀기", "대화 질문"].map((part) => text.indexOf(part));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("RS11b own + workContext 없음 → S5-V3 대체 문구(WorkLineList 없음), alternative + 없음 → 아무것도 없음", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValueOnce(detail({ resumeSolution: RESUME }));
    renderMyPage();
    const first = await open(/첫 번째 문제/);
    expect(within(first.dialog).getByText("내가 쓴 풀이 줄은 저장되지 않아 여기에는 보이지 않아요.")).toBeInTheDocument();
    expect(within(first.dialog).queryByText("내가 쓴 풀이")).not.toBeInTheDocument();
    fireEvent.click(within(first.dialog).getByRole("button", { name: "목록으로" }));

    vi.mocked(getProblemHistoryDetail).mockResolvedValueOnce(detail({ problemId: "p2", resumeSolution: { ...RESUME, mode: "alternative" } }));
    const second = await open(/두 번째 문제/);
    expect(within(second.dialog).queryByText("내가 쓴 풀이 줄은 저장되지 않아 여기에는 보이지 않아요.")).not.toBeInTheDocument();
    expect(within(second.dialog).queryByText("내가 쓴 풀이")).not.toBeInTheDocument();
  });

  it("둘 다 없으면 기존 '저장된 풀이가 없는 문제예요' 그대로", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(detail({}));
    renderMyPage();
    const { dialog } = await open(/첫 번째 문제/);
    expect(within(dialog).getByText("저장된 풀이가 없는 문제예요")).toBeInTheDocument();
  });
});

describe("RS11 저장된 줄의 위험한 LaTeX 명령", () => {
  it("\\href·\\htmlId는 링크·id로 렌더되지 않는다(KaTeX trust=false), 다른 줄과 상세는 정상", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(
      detail({
        resumeSolution: {
          ...RESUME,
          workContext: {
            lines: [
              { lineNo: 1, latex: "\\href{javascript:alert(1)}{클릭}" },
              { lineNo: 2, latex: "\\htmlId{evil}{x}" },
              { lineNo: 3, latex: "x = 5" },
            ],
            lastValidLine: 2,
            stallLine: 3,
          },
        },
      }),
    );
    renderMyPage();
    const { dialog } = await open(/첫 번째 문제/);
    expect(dialog.querySelector("a[href^='javascript']")).toBeNull();
    expect(dialog.querySelector("a")).toBeNull();
    expect(document.getElementById("evil")).toBeNull();
    expect(within(dialog).getByText("3번째 줄부터 이어가기")).toBeInTheDocument();
  });
});

describe("RS12 포커스·inert", () => {
  it.each([
    ["목록으로", (dialog: HTMLElement) => fireEvent.click(within(dialog).getByRole("button", { name: "목록으로" }))],
    ["Escape", () => fireEvent.keyDown(window, { key: "Escape" })],
    [
      "배경",
      (dialog: HTMLElement) => {
        const backdrop = dialog.parentElement?.querySelector<HTMLElement>("button[aria-hidden='true']");
        if (!backdrop) throw new Error("backdrop");
        fireEvent.click(backdrop);
      },
    ],
  ] as const)("열면 '목록으로' focus·header/main inert, %s로 닫으면 연 행으로 복귀·inert 해제", async (_name, close) => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(detail({ problemId: "p2", solution: SOLUTION }));
    const { container } = renderMyPage();
    const { row, dialog } = await open(/두 번째 문제/);
    expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "목록으로" }));
    expect(container.querySelector("header")?.hasAttribute("inert")).toBe(true);
    expect(container.querySelector("main")?.hasAttribute("inert")).toBe(true);
    close(dialog);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(row);
    expect(container.querySelector("header")?.hasAttribute("inert")).toBe(false);
    expect(container.querySelector("main")?.hasAttribute("inert")).toBe(false);
  });

  it("클릭으로 포커스가 행에 가지 않는 환경(Safari, activeElement=body)에서도 연 행의 상세 버튼으로 복귀", async () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(detail({ problemId: "p2", solution: SOLUTION }));
    renderMyPage();
    (document.activeElement as HTMLElement | null)?.blur();
    const { row, dialog } = await open(/두 번째 문제/, false);
    fireEvent.click(within(dialog).getByRole("button", { name: "목록으로" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(document.activeElement).toBe(row);
  });
});

describe("재작업 1 — MyPage 루트 높이(design P3, frontend.md §3-6)", () => {
  it("루트는 min-h-dvh(vh 계열 min-h-screen 없음)", () => {
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(detail({}));
    const { container } = renderMyPage();
    const root = container.firstElementChild;
    const t = (root?.getAttribute("class") ?? "").split(/\s+/);
    expect(t).toContain("min-h-dvh");
    expect(t).not.toContain("min-h-screen");
  });
});

