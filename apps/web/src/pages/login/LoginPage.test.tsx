import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession } from "../../test/supabaseTestUtils";
import { LoginPage } from "./LoginPage";

vi.mock("../../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function renderLoginPage() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<div>RegisterPage</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  it("입력 필드는 이메일/비밀번호 2개를 초과하지 않는다(AUTH-2)", () => {
    renderLoginPage();
    const inputs = document.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
  });

  it("Kakao/Google 소셜 로그인 버튼과 이메일 로그인 제출 버튼을 제공한다", () => {
    renderLoginPage();
    expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카카오로 계속하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google로 계속하기" })).toBeInTheDocument();
  });

  it("소셜 로그인 버튼 클릭 시 해당 provider로 signInWithOAuth를 호출한다", async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: "google", url: "https://example.com/oauth", flowId: "flow-1" },
      error: null,
    });

    renderLoginPage();
    fireEvent.click(screen.getByRole("button", { name: "Google로 계속하기" }));

    await waitFor(() =>
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: window.location.origin },
      }),
    );
  });

  it("제출 중에는 로딩 인디케이터를 표시한다", async () => {
    let resolveSignIn: (value: {
      data: { user: ReturnType<typeof createFakeSession>["user"]; session: ReturnType<typeof createFakeSession> };
      error: null;
    }) => void = () => {};
    vi.mocked(supabase.auth.signInWithPassword).mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );

    renderLoginPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    expect(await screen.findByText("처리 중")).toBeInTheDocument();

    const session = createFakeSession();
    resolveSignIn({ data: { user: session.user, session }, error: null });
    await waitFor(() => expect(screen.queryByText("처리 중")).not.toBeInTheDocument());
  });

  it("NavTabBar의 '회원가입' 탭 클릭 시 /register로 이동한다", () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole("button", { name: "회원가입" }));
    expect(screen.getByText("RegisterPage")).toBeInTheDocument();
  });
});
