import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProblemHistoryDetailDto } from "validation";
import { AuthContext, type AuthContextValue } from "../../features/auth/AuthContext";
import { createFakeSession } from "../../test/supabaseTestUtils";

vi.mock("../../shared/lib/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn() } },
}));

vi.mock("../../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(),
  getProblemHistoryDetail: vi.fn(),
}));

const { getProblemHistoryDetail, listProblemHistory } = await import(
  "../../shared/api/problemHistory"
);
const { MyPage } = await import("./MyPage");

const ITEMS = [
  {
    problemId: "problem-1",
    recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
    conceptTags: ["이차방정식"],
    createdAt: new Date(2026, 6, 12, 9, 30).toISOString(),
  },
  {
    problemId: "problem-2",
    recognizedText: "y = 2x + 1의 기울기를 구하라",
    conceptTags: ["일차함수"],
    createdAt: new Date(2026, 6, 11, 9, 30).toISOString(),
  },
];

const DETAIL: ProblemHistoryDetailDto = {
  problemId: "problem-1",
  recognizedText: "x^2 - 5x + 6 = 0을 풀어라",
  recognizedLatex: null,
  createdAt: ITEMS[0]!.createdAt,
  solution: {
    conceptMd: "이차방정식은 인수분해로 풀 수 있다.",
    solutionMd: "1단계: 인수분해한다.",
    answerMd: "x = 2 또는 x = 3",
    conceptTags: ["이차방정식"],
    aiProvider: "openai",
    aiModel: "gpt-5",
  },
  chatMessages: [
    { role: "user", content: "왜 인수분해를 쓰나요?", createdAt: ITEMS[0]!.createdAt },
    { role: "assistant", content: "계수가 정수라서 빠릅니다.", createdAt: ITEMS[0]!.createdAt },
  ],
};

/** "다시 풀기"가 넘긴 라우터 state(`resumeProblemId`)를 화면에 드러내는 테스트용 목적지 화면. */
function LandscapeStateProbe() {
  const location = useLocation();
  const resumeProblemId = (location.state as { resumeProblemId?: string } | null)?.resumeProblemId;
  return <div>LandscapePage:{resumeProblemId ?? "none"}</div>;
}

function renderMyPage() {
  const authValue: AuthContextValue = {
    status: "authenticated",
    user: createFakeSession({ user_metadata: { nickname: "지민", grade: "H1" } }).user,
    holdPublicRedirect: false,
    setHoldPublicRedirect: () => undefined,
  };

  return render(
    <MemoryRouter initialEntries={["/mypage"]}>
      <AuthContext.Provider value={authValue}>
        <Routes>
          <Route path="/mypage" element={<MyPage />} />
          <Route path="/solve/pencilcanvas" element={<div>SolvePage</div>} />
          <Route path="/solve/landscape" element={<LandscapeStateProbe />} />
          <Route path="/grade-setup" element={<div>GradeSetupPage</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyPage", () => {
  it("프로필 헤더에 닉네임/학년/이메일을 보여준다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    expect(screen.getByText("지민")).toBeInTheDocument();
    expect(screen.getByText("고1 · student@example.com")).toBeInTheDocument();
    await waitFor(() => expect(listProblemHistory).toHaveBeenCalled());
  });

  it("목록을 불러오면 History Row와 실제 태그 기반 필터 Pill을 렌더링한다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "이차방정식" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "일차함수" })).toBeInTheDocument();
  });

  it("필터 Pill을 선택하면 해당 개념 태그의 기록만 남는다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[1]!.recognizedText).length).toBe(2));

    fireEvent.click(screen.getByRole("button", { name: "이차방정식" }));

    expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2);
    expect(screen.queryByText(ITEMS[1]!.recognizedText)).not.toBeInTheDocument();
  });

  it("기록이 없으면 빈 상태 안내와 CTA를 보여준다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: [] });
    renderMyPage();

    await waitFor(() => expect(screen.getByText("아직 풀이한 문제가 없어요")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "문제 풀러 가기" })).toBeInTheDocument();
  });

  it("목록 조회에 실패하면 모달이 아니라 인라인 안내 + 다시 시도 버튼을 보여준다", async () => {
    vi.mocked(listProblemHistory).mockRejectedValueOnce(new Error("network down"));
    vi.mocked(listProblemHistory).mockResolvedValueOnce({ items: ITEMS });
    renderMyPage();

    await waitFor(() =>
      expect(screen.getByText("풀이 기록을 불러오지 못했습니다.")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("network down")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
  });

  it("History Row를 누르면 /mypage 안의 오버레이로 과거 풀이를 보여준다(라우트 이동 없음)", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getAllByRole("button", { name: /x\^2 - 5x \+ 6/ })[0]!);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(getProblemHistoryDetail).toHaveBeenCalledWith("problem-1");
    expect(screen.getByText("풀이 결과")).toBeInTheDocument();
    expect(screen.getByText("관련 개념")).toBeInTheDocument();
    expect(screen.getByText(/x = 2 또는 x = 3/)).toBeInTheDocument();
    // 프로필 헤더가 그대로 남아 있다 = 여전히 /mypage 안이다.
    expect(screen.getByText("지민")).toBeInTheDocument();
  });

  it("오버레이는 read-only다 — '새 문제' 배지와 후속 질문 입력창을 렌더링하지 않는다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getAllByRole("button", { name: /x\^2 - 5x \+ 6/ })[0]!);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    expect(screen.queryByText("새 문제")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("후속 질문 입력")).not.toBeInTheDocument();
  });

  it("'다시 풀기'를 누르면 resumeProblemId를 라우터 state에 담아 /solve/landscape로 이동한다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getAllByRole("button", { name: /x\^2 - 5x \+ 6/ })[0]!);

    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    // 조회 전용 오버레이의 "수정" 액션은 "다시 풀기"로 대체된다.
    expect(screen.queryByRole("button", { name: "수정" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "다시 풀기" }));

    await waitFor(() =>
      expect(screen.getByText("LandscapePage:problem-1")).toBeInTheDocument(),
    );
    // 오버레이가 있던 /mypage를 완전히 벗어난다.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("저장된 대화 이력을 순서대로 보여준다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getAllByRole("button", { name: /x\^2 - 5x \+ 6/ })[0]!);

    await waitFor(() => expect(screen.getByText("왜 인수분해를 쓰나요?")).toBeInTheDocument());
    expect(screen.getByText("계수가 정수라서 빠릅니다.")).toBeInTheDocument();
  });

  it("'목록으로'를 누르면 오버레이가 닫힌다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(getProblemHistoryDetail).mockResolvedValue(DETAIL);
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getAllByRole("button", { name: /x\^2 - 5x \+ 6/ })[0]!);
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "목록으로" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("상세 조회에 실패하면 오버레이 안에 인라인 안내를 보여준다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(getProblemHistoryDetail).mockRejectedValue(new Error("boom"));
    renderMyPage();

    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getAllByRole("button", { name: /x\^2 - 5x \+ 6/ })[0]!);

    await waitFor(() =>
      expect(screen.getByText("풀이 기록을 불러오지 못했습니다.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByText("boom")).not.toBeInTheDocument();
  });
});
