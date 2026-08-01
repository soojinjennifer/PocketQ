import { AuthApiError } from "@supabase/supabase-js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../features/auth/AuthProvider";
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
  // LoginPage는 useAuth()(holdPublicRedirect 제어)를 사용하므로 AuthProvider가 필요하다.
  // 이 파일은 PublicOnlyRoute 없이 LoginPage만 격리 렌더링하므로 세션 상태는 항상 비로그인으로 둔다.
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() } },
  });
});

function renderLoginPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<div>RegisterPage</div>} />
          <Route path="/solve" element={<div>SolvePage</div>} />
          <Route path="/grade-setup" element={<div>GradeSetupPage</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
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

  it("로그인 성공 시 즉시 이동하지 않고 완료 팝업을 표시하며, 팝업 버튼 클릭 후에만 이동한다", async () => {
    const session = createFakeSession({ user_metadata: { nickname: "새싹", grade: "M1" } });
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    expect(await screen.findByText("로그인 되었습니다")).toBeInTheDocument();
    expect(screen.getByText("새싹님, 다시 오셨네요. 오늘도 풀어볼까요?")).toBeInTheDocument();
    expect(screen.queryByText("SolvePage")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("닉네임이 없는 사용자의 로그인 성공 시 닉네임 없는 안내 문구를 표시한다", async () => {
    const session = createFakeSession();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    expect(await screen.findByText("다시 오셨네요. 오늘도 풀어볼까요?")).toBeInTheDocument();
  });

  it("이메일/비밀번호가 틀리면(invalid_credentials) 오류 팝업을 표시하고, 팝업 버튼 클릭 시 이동 없이 팝업만 닫히며 비밀번호가 비워진다", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null, weakPassword: null },
      error: new AuthApiError("이메일 또는 비밀번호가 올바르지 않습니다.", 400, "invalid_credentials"),
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    const passwordInput = screen.getByLabelText("비밀번호");
    fireEvent.change(passwordInput, { target: { value: "wrong-pw" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    expect(await screen.findByText("이메일이나 비밀번호가 틀렸습니다")).toBeInTheDocument();
    expect(screen.getByText("다시 확인하고 시도해 주세요")).toBeInTheDocument();
    expect(screen.queryByText("이메일 또는 비밀번호가 올바르지 않습니다.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() =>
      expect(screen.queryByText("이메일이나 비밀번호가 틀렸습니다")).not.toBeInTheDocument(),
    );
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.queryByText("SolvePage")).not.toBeInTheDocument();
    expect(screen.getByLabelText<HTMLInputElement>("이메일").value).toBe("student@example.com");
    expect(screen.getByLabelText<HTMLInputElement>("비밀번호").value).toBe("");
  });

  it("로그인 실패(다른 종류의 오류, 예: email_not_confirmed) 시 인라인 오류 메시지를 표시한다", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null, weakPassword: null },
      error: new AuthApiError("이메일 인증이 필요합니다.", 400, "email_not_confirmed"),
    });

    renderLoginPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "pw" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    expect(await screen.findByText("이메일 인증이 필요합니다.")).toBeInTheDocument();
    expect(screen.queryByText("이메일이나 비밀번호가 틀렸습니다")).not.toBeInTheDocument();
  });
});
