import { AuthApiError } from "@supabase/supabase-js";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, MemoryRouter, Route, RouterProvider, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteUnconsentedAccount } from "../../shared/api/deleteUnconsentedAccount";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession, createUnconsentedSession } from "../../test/supabaseTestUtils";
import { SignupConsentGate } from "./SignupConsentGate";

vi.mock("../../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("../../shared/api/deleteUnconsentedAccount", () => ({
  deleteUnconsentedAccount: vi.fn(),
}));

const AGE = "(필수) 만 14세 이상입니다";
const TERMS = "(필수) 이용약관에 동의합니다";
const PRIVACY = "(필수) 개인정보처리방침에 동의합니다";
const SUBMIT = "동의하고 시작하기";
const UNDER_AGE = "만 14세 미만이에요";

type UpdateUserResult = Awaited<ReturnType<typeof supabase.auth.updateUser>>;

function consentedUserResult(): UpdateUserResult {
  return { data: { user: createFakeSession().user }, error: null };
}

function renderGate(onConsented = vi.fn()) {
  render(
    <MemoryRouter initialEntries={["/mypage"]}>
      <Routes>
        <Route path="/mypage" element={<SignupConsentGate onConsented={onConsented} />} />
        <Route path="/login" element={<div>LoginPage</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return onConsented;
}

/** 이동 방식(push/replace)까지 확인할 때 쓴다. 게이트만 렌더하므로 이동은 훅 하나만 일으킨다. */
function renderGateWithRouter() {
  const router = createMemoryRouter(
    [
      { path: "/mypage", element: <SignupConsentGate onConsented={vi.fn()} /> },
      { path: "/login", element: <div>LoginPage</div> },
    ],
    { initialEntries: ["/mypage"] },
  );
  render(<RouterProvider router={router} />);
  return router;
}

function tickAll() {
  fireEvent.click(screen.getByRole("checkbox", { name: AGE }));
  fireEvent.click(screen.getByRole("checkbox", { name: TERMS }));
  fireEvent.click(screen.getByRole("checkbox", { name: PRIVACY }));
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {};
  let reject: (reason: unknown) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
});

describe("SignupConsentGate", () => {
  it("마운트되면 제목으로 포커스를 옮기고, 제목·부제·체크리스트를 보여준다(A-1)", () => {
    renderGate();

    const heading = screen.getByRole("heading", { level: 1, name: "시작하기 전에 확인해 주세요" });
    expect(heading).toHaveFocus();
    expect(heading).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("수풀잉을 이용하려면 아래 내용에 동의해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "가입 동의 (모두 필수)" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveClass("min-h-dvh");
  });

  it("세 항목을 모두 고르기 전에는 시작 버튼이 비활성이고 sr-only 안내가 연결된다(A-5)", () => {
    renderGate();
    const submit = screen.getByRole("button", { name: SUBMIT });

    expect(submit).toBeDisabled();
    expect(submit).toHaveAccessibleDescription("세 항목에 모두 동의하면 시작할 수 있어요");

    fireEvent.click(screen.getByRole("checkbox", { name: AGE }));
    fireEvent.click(screen.getByRole("checkbox", { name: TERMS }));
    expect(submit).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: PRIVACY }));
    expect(submit).toBeEnabled();
    expect(submit).not.toHaveAttribute("aria-describedby");
  });

  it("제출하면 updateUser를 동의 기록 4개 키로 호출하고, 응답 user로 동의가 확인되면 onConsented를 부른다", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue(consentedUserResult());
    const onConsented = renderGate();

    tickAll();
    fireEvent.click(screen.getByRole("button", { name: SUBMIT }));

    await waitFor(() => expect(onConsented).toHaveBeenCalledWith("test-user-id"));
    expect(supabase.auth.updateUser).toHaveBeenCalledTimes(1);
    const [attributes] = vi.mocked(supabase.auth.updateUser).mock.calls[0] ?? [];
    const data = (attributes?.data ?? {}) as Record<string, unknown>;
    expect(Object.keys(data).sort()).toEqual(
      ["age14_confirmed_at", "consent_policy_version", "privacy_agreed_at", "terms_agreed_at"].sort(),
    );
    expect(data["consent_policy_version"]).toBe("2026-10-29");
    expect(data["terms_agreed_at"]).toBe(data["age14_confirmed_at"]);
    expect(data["privacy_agreed_at"]).toBe(data["age14_confirmed_at"]);
  });

  it("제출 중에는 모든 컨트롤이 비활성이고 스피너와 aria-busy를 표시한다", async () => {
    const pending = deferred<UpdateUserResult>();
    vi.mocked(supabase.auth.updateUser).mockReturnValue(pending.promise);
    renderGate();

    tickAll();
    fireEvent.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText("처리 중")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: SUBMIT })).toBeDisabled();
    expect(screen.getByRole("button", { name: SUBMIT })).toHaveAttribute("aria-busy", "true");
    for (const name of [AGE, TERMS, PRIVACY]) {
      expect(screen.getByRole("checkbox", { name })).toBeDisabled();
    }
    expect(screen.getByRole("button", { name: UNDER_AGE })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다른 계정으로 로그인" })).toBeDisabled();

    await act(async () => {
      pending.resolve(consentedUserResult());
      await pending.promise;
    });
  });

  it("저장에 실패하면 role=alert에 오류를 보여주고, 선택은 유지한 채 버튼을 다시 활성화한다", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: new AuthApiError("network down", 500, "unexpected_failure"),
    });
    const onConsented = renderGate();

    tickAll();
    fireEvent.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText("동의 내용을 저장하지 못했어요. 다시 시도해 주세요")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("동의 내용을 저장하지 못했어요");
    expect(screen.queryByText("network down")).not.toBeInTheDocument();
    expect(onConsented).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox", { name: AGE })).toBeChecked();
    expect(screen.getByRole("button", { name: SUBMIT })).toBeEnabled();
  });

  it("저장 응답의 user에 동의 키가 없으면 onConsented를 부르지 않고 오류를 보여준다(R5)", async () => {
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: createUnconsentedSession().user },
      error: null,
    });
    const onConsented = renderGate();

    tickAll();
    fireEvent.click(screen.getByRole("button", { name: SUBMIT }));

    expect(await screen.findByText("동의 내용을 저장하지 못했어요. 다시 시도해 주세요")).toBeInTheDocument();
    expect(onConsented).not.toHaveBeenCalled();
  });

  describe("만 14세 미만", () => {
    it("팝업을 열면 error 아이콘 2버튼 alertdialog이고, 초기 포커스는 취소 버튼이다(P1)", () => {
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: UNDER_AGE }));

      const dialog = screen.getByRole("alertdialog", { name: "만 14세 미만은 정식 서비스 때 이용할 수 있어요" });
      expect(dialog).toHaveAccessibleDescription(
        "보호자 동의 절차를 준비하고 있어요. 지금 만든 계정과 기록은 삭제할 수 있어요.",
      );
      expect(screen.getByRole("button", { name: "삭제하고 나가기" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "취소" })).toHaveFocus();
    });

    it("취소하면 팝업이 닫히고 포커스가 '만 14세 미만이에요'로 돌아온다", async () => {
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: UNDER_AGE }));
      fireEvent.click(screen.getByRole("button", { name: "취소" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: UNDER_AGE })).toHaveFocus());
      expect(deleteUnconsentedAccount).not.toHaveBeenCalled();
    });

    it("삭제하면 API → 로컬 signOut → /login 순서로 진행한다", async () => {
      const order: string[] = [];
      vi.mocked(deleteUnconsentedAccount).mockImplementation(() => {
        order.push("delete");
        return Promise.resolve("deleted");
      });
      vi.mocked(supabase.auth.signOut).mockImplementation(() => {
        order.push("signOut");
        return Promise.resolve({ error: null });
      });
      const router = renderGateWithRouter();

      fireEvent.click(screen.getByRole("button", { name: UNDER_AGE }));
      fireEvent.click(screen.getByRole("button", { name: "삭제하고 나가기" }));

      expect(await screen.findByText("LoginPage")).toBeInTheDocument();
      // 뒤로가기로 삭제된 계정의 게이트에 돌아가지 않도록 replace 이동이다(D5).
      expect(router.state.historyAction).toBe("REPLACE");
      expect(order).toEqual(["delete", "signOut"]);
      expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    });

    it("삭제 진행 중 재클릭은 무시한다(API 1회)", async () => {
      const pending = deferred<"deleted">();
      vi.mocked(deleteUnconsentedAccount).mockReturnValue(pending.promise);
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: UNDER_AGE }));
      const deleteButton = screen.getByRole("button", { name: "삭제하고 나가기" });
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);
      fireEvent.click(deleteButton);

      expect(deleteUnconsentedAccount).toHaveBeenCalledTimes(1);

      // 삭제 진행 중에는 취소로 팝업을 닫을 수 없다(F3).
      fireEvent.click(screen.getByRole("button", { name: "취소" }));
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();

      await act(async () => {
        pending.resolve("deleted");
        await pending.promise;
      });
      expect(await screen.findByText("LoginPage")).toBeInTheDocument();
    });

    it("삭제가 실패하면 팝업을 닫고 오류를 보여주며, 로그아웃하지 않고 포커스를 링크로 돌려준다(P2)", async () => {
      vi.mocked(deleteUnconsentedAccount).mockRejectedValue(new Error("boom"));
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: UNDER_AGE }));
      fireEvent.click(screen.getByRole("button", { name: "삭제하고 나가기" }));

      expect(
        await screen.findByText("계정 정보를 삭제하지 못했어요. 잠시 후 다시 시도해 주세요"),
      ).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      expect(screen.queryByText("LoginPage")).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: UNDER_AGE })).toHaveFocus());
    });

    it("서버가 409(이미 동의함)를 주면 팝업을 닫고 안내를 보여주며 로그아웃하지 않는다(C-6)", async () => {
      vi.mocked(deleteUnconsentedAccount).mockResolvedValue("already-consented");
      renderGate();

      fireEvent.click(screen.getByRole("button", { name: UNDER_AGE }));
      fireEvent.click(screen.getByRole("button", { name: "삭제하고 나가기" }));

      expect(await screen.findByText("이미 동의가 완료된 계정이에요")).toBeInTheDocument();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(supabase.auth.signOut).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.getByRole("button", { name: UNDER_AGE })).toHaveFocus());
    });
  });

  it("'다른 계정으로 로그인'은 로그아웃 후 /login으로 이동한다", async () => {
    renderGate();

    fireEvent.click(screen.getByRole("button", { name: "다른 계정으로 로그인" }));

    expect(await screen.findByText("LoginPage")).toBeInTheDocument();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
  });
});
