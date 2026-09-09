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
  bulkDeleteProblemHistory: vi.fn(),
}));

const { getProblemHistoryDetail, listProblemHistory, bulkDeleteProblemHistory } = await import(
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
    isPasswordRecovery: false,
    setIsPasswordRecovery: () => undefined,
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

  it("필터 Pill 행은 줄바꿈 대신 1줄 가로 스크롤 컨테이너로 렌더링된다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    const allPill = await screen.findByRole("button", { name: "전체" });
    const filterRow = allPill.parentElement;

    expect(filterRow?.className).toContain("flex-nowrap");
    expect(filterRow?.className).toContain("overflow-x-auto");
    expect(filterRow?.className).not.toContain("flex-wrap");
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

describe("MyPage — 마이페이지 개선 3번(체크박스 일괄 삭제)", () => {
  it("체크박스를 선택하지 않으면 '풀이 내역 지우기' 버튼이 비활성이다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    const deleteButton = await screen.findByRole("button", { name: "풀이 내역 지우기" });
    expect(deleteButton).toBeDisabled();
  });

  it("체크박스를 선택하면 버튼이 활성화되고, 클릭하면 확인 모달이 뜬다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);

    const deleteButton = screen.getByRole("button", { name: "풀이 내역 지우기" });
    expect(deleteButton).not.toBeDisabled();

    fireEvent.click(deleteButton);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("풀이 기록을 삭제할까요?")).toBeInTheDocument();
  });

  it("체크박스를 클릭해도 상세보기 오버레이가 열리지 않는다(행 클릭과 분리)", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getProblemHistoryDetail).not.toHaveBeenCalled();
  });

  it("확인 모달에서 '취소'를 누르면 선택 상태를 유지한 채 모달만 닫힌다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "풀이 내역 지우기" }));
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(bulkDeleteProblemHistory).not.toHaveBeenCalled();
    // 선택 상태가 유지돼 버튼이 여전히 활성이다.
    expect(screen.getByRole("button", { name: "풀이 내역 지우기" })).not.toBeDisabled();
  });

  it("확인 모달에서 '삭제'를 누르면 API를 호출하고 목록을 새로고침하며 선택을 초기화한다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(bulkDeleteProblemHistory).mockResolvedValue({ deletedProblemIds: ["problem-1"] });
    renderMyPage();

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "풀이 내역 지우기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(bulkDeleteProblemHistory).toHaveBeenCalledWith(["problem-1"]));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    // 삭제 성공 후 목록을 다시 조회한다(최초 1회 + 삭제 후 1회).
    await waitFor(() => expect(listProblemHistory).toHaveBeenCalledTimes(2));
    // 선택 상태가 초기화돼 버튼이 다시 비활성이다.
    expect(screen.getByRole("button", { name: "풀이 내역 지우기" })).toBeDisabled();
  });

  it("stage-qa HIGH 결함 재현: 태그 필터를 바꾸면 화면에서 사라진 체크 선택이 초기화돼, 다시 보이지 않는 항목이 삭제 대상에 섞이지 않는다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    renderMyPage();

    // 1) "이차방정식" 태그로 필터링한 뒤 화면에 보이는 problem-1을 체크한다.
    await waitFor(() => expect(screen.getAllByText(ITEMS[0]!.recognizedText).length).toBe(2));
    fireEvent.click(screen.getByRole("button", { name: "이차방정식" }));
    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(1));
    fireEvent.click(screen.getByRole("checkbox", { name: `${ITEMS[0]!.recognizedText} 선택` }));
    expect(screen.getByRole("button", { name: "풀이 내역 지우기" })).not.toBeDisabled();

    // 2) 다른 태그("일차함수")로 필터를 전환한다 — 체크했던 problem-1은 화면에서 사라진다.
    fireEvent.click(screen.getByRole("button", { name: "일차함수" }));
    await waitFor(() => expect(screen.getAllByText(ITEMS[1]!.recognizedText).length).toBe(2));
    expect(screen.queryByText(ITEMS[0]!.recognizedText)).not.toBeInTheDocument();

    // 3) 선택 상태가 필터 전환 시 초기화돼 "풀이 내역 지우기" 버튼은 다시 비활성이어야 한다.
    expect(screen.getByRole("button", { name: "풀이 내역 지우기" })).toBeDisabled();

    // 4) 방어적으로 이 필터에서 새로 체크한 뒤 삭제해도, 화면에 보이지 않는 problem-1은
    //    삭제 요청에 포함되지 않는다(현재 필터로 보이는 problem-2만 포함).
    vi.mocked(bulkDeleteProblemHistory).mockResolvedValue({ deletedProblemIds: ["problem-2"] });
    fireEvent.click(screen.getByRole("checkbox", { name: `${ITEMS[1]!.recognizedText} 선택` }));
    fireEvent.click(screen.getByRole("button", { name: "풀이 내역 지우기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() => expect(bulkDeleteProblemHistory).toHaveBeenCalledWith(["problem-2"]));
    expect(bulkDeleteProblemHistory).not.toHaveBeenCalledWith(
      expect.arrayContaining(["problem-1"]),
    );
  });

  it("삭제에 실패하면 모달이 아니라 별도 에러 모달로 원본 메시지를 감추고 안내한다", async () => {
    vi.mocked(listProblemHistory).mockResolvedValue({ items: ITEMS });
    vi.mocked(bulkDeleteProblemHistory).mockRejectedValue(new Error("network down"));
    renderMyPage();

    await waitFor(() => expect(screen.getAllByRole("checkbox")).toHaveLength(2));
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    fireEvent.click(screen.getByRole("button", { name: "풀이 내역 지우기" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));

    await waitFor(() =>
      expect(screen.getByText("풀이 기록을 삭제하지 못했습니다.")).toBeInTheDocument(),
    );
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
    // 목록은 다시 조회하지 않는다(실패했으므로).
    expect(listProblemHistory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "확인" }));
    expect(screen.queryByText("풀이 기록을 삭제하지 못했습니다.")).not.toBeInTheDocument();
  });
});
