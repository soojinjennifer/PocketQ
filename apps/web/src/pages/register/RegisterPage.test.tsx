import { AuthApiError } from "@supabase/supabase-js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../../features/auth/AuthProvider";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession } from "../../test/supabaseTestUtils";
import { RegisterPage } from "./RegisterPage";

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
  // RegisterPage는 useAuth()(holdPublicRedirect 제어)를 사용하므로 AuthProvider가 필요하다.
  // 이 파일은 PublicOnlyRoute 없이 RegisterPage만 격리 렌더링하므로 세션 상태는 항상 비로그인으로 둔다.
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() } },
  });
});

function renderRegisterPage() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/register"]}>
        <Routes>
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/login" element={<div>LoginPage</div>} />
          <Route path="/solve/pencilcanvas" element={<div>SolvePage</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("RegisterPage", () => {
  it("입력 필드는 닉네임/이메일/비밀번호 3개를 초과하지 않는다", () => {
    renderRegisterPage();
    const inputs = document.querySelectorAll("input");
    expect(inputs).toHaveLength(3);
    expect(
      screen.getByPlaceholderText("제가 부를 수 있는 닉네임을 입력해 주세요"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
  });

  it("Kakao/Google 소셜 가입 버튼과 이메일 가입 제출 버튼을 제공한다", () => {
    renderRegisterPage();
    expect(screen.getByRole("button", { name: "이메일로 가입하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카카오로 가입하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google로 가입하기" })).toBeInTheDocument();
  });

  function fillAndSubmit() {
    fireEvent.change(screen.getByPlaceholderText("제가 부를 수 있는 닉네임을 입력해 주세요"), {
      target: { value: "새싹" },
    });
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));
  }

  it("가입 성공(세션 즉시 발급) 시 완료 팝업을 표시하고, 팝업 버튼 클릭 후에만 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: createFakeSession().user, session: createFakeSession() },
      error: null,
    });
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText("회원가입이 완료 되었습니다")).toBeInTheDocument();
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("LoginPage")).not.toBeInTheDocument();
    expect(screen.queryByText("SolvePage")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "로그인하기" }));

    await waitFor(() => expect(screen.getByText("LoginPage")).toBeInTheDocument());
  });

  it("가입 성공(이메일 확인 대기) 시 이메일 인증 팝업을 표시하고, 팝업 버튼 클릭 시 이동 없이 팝업만 닫힌다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: createFakeSession().user, session: null },
      error: null,
    });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText("이메일 인증 대기중")).toBeInTheDocument();
    expect(screen.getByText("이메일을 확인해 주세요")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    await waitFor(() => expect(screen.queryByText("이메일 인증 대기중")).not.toBeInTheDocument());
    expect(screen.queryByText("LoginPage")).not.toBeInTheDocument();
  });

  it("가입 시 이미 가입된 이메일이면(오류 코드 email_exists) 안내 팝업을 표시하고, 팝업 버튼 클릭 시 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("이미 가입된 이메일입니다.", 400, "email_exists"),
    });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText("이미 가입되어 있습니다")).toBeInTheDocument();
    expect(screen.getByText("로그인을 해주세요")).toBeInTheDocument();
    expect(screen.queryByText("이미 가입된 이메일입니다.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "로그인하러 가기" }));

    await waitFor(() => expect(screen.getByText("LoginPage")).toBeInTheDocument());
  });

  it("가입 시 이미 가입된 이메일이면(오류 코드 user_already_exists) 안내 팝업을 표시한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("User already registered", 400, "user_already_exists"),
    });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText("이미 가입되어 있습니다")).toBeInTheDocument();
  });

  it("가입 실패 시(다른 종류의 오류, 예: 약한 비밀번호) 인라인 오류 메시지를 표시한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("비밀번호가 너무 약합니다.", 400, "weak_password"),
    });

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText("비밀번호가 너무 약합니다.")).toBeInTheDocument();
    expect(screen.queryByText("이미 가입되어 있습니다")).not.toBeInTheDocument();
  });

  it("제출 중에는 로딩 인디케이터를 표시한다", async () => {
    let resolveSignUp: (value: {
      data: { user: ReturnType<typeof createFakeSession>["user"]; session: ReturnType<typeof createFakeSession> };
      error: null;
    }) => void = () => {};
    vi.mocked(supabase.auth.signUp).mockReturnValue(
      new Promise((resolve) => {
        resolveSignUp = resolve;
      }),
    );

    renderRegisterPage();
    fillAndSubmit();

    expect(await screen.findByText("처리 중")).toBeInTheDocument();

    const session = createFakeSession();
    resolveSignUp({ data: { user: session.user, session }, error: null });
    await waitFor(() => expect(screen.queryByText("처리 중")).not.toBeInTheDocument());
  });

  it("NavTabBar의 '로그인' 탭 클릭 시 /login으로 이동한다", () => {
    renderRegisterPage();
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    expect(screen.getByText("LoginPage")).toBeInTheDocument();
  });
});
