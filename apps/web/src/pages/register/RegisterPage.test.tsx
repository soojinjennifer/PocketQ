import { AuthApiError } from "@supabase/supabase-js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
});

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={["/register"]}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<div>LoginPage</div>} />
        <Route path="/solve" element={<div>SolvePage</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  it("입력 필드는 이메일/비밀번호 2개를 초과하지 않는다", () => {
    renderRegisterPage();
    const inputs = document.querySelectorAll("input");
    expect(inputs).toHaveLength(2);
  });

  it("Kakao/Google 소셜 가입 버튼과 이메일 가입 제출 버튼을 제공한다", () => {
    renderRegisterPage();
    expect(screen.getByRole("button", { name: "이메일로 가입하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "카카오로 가입하기" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Google로 가입하기" })).toBeInTheDocument();
  });

  it("가입 성공(세션 즉시 발급) 시 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: createFakeSession().user, session: createFakeSession() },
      error: null,
    });

    renderRegisterPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));

    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("가입 성공(이메일 확인 대기) 시 안내 메시지를 표시한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: createFakeSession().user, session: null },
      error: null,
    });

    renderRegisterPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));

    expect(
      await screen.findByText("가입 요청이 접수되었습니다. 이메일 인증 절차는 안내에 따라 진행해 주세요."),
    ).toBeInTheDocument();
  });

  it("가입 실패 시 오류 메시지를 표시한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("이미 가입된 이메일입니다.", 400, "email_exists"),
    });

    renderRegisterPage();
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));

    expect(await screen.findByText("이미 가입된 이메일입니다.")).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));

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
