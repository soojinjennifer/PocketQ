import { AuthApiError, type AuthChangeEvent, type Session } from "@supabase/supabase-js";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../features/auth/AuthProvider";
import { supabase } from "../shared/lib/supabase/client";
import { createFakeSession, type AuthStateListener } from "../test/supabaseTestUtils";
import { routeConfig } from "./routes";

vi.mock("../shared/lib/supabase/client", () => ({
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

let authListeners: AuthStateListener[] = [];

function emitAuthChange(event: AuthChangeEvent, session: Session | null) {
  authListeners.forEach((listener) => {
    void listener(event, session);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  authListeners = [];

  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
    authListeners.push(callback);
    return {
      data: {
        subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() },
      },
    };
  });
});

function renderApp(initialEntries: string[]) {
  const router = createMemoryRouter(routeConfig, { initialEntries });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

describe("라우팅", () => {
  it("세션 확인 중(loading)에는 잘못된 리다이렉트가 발생하지 않는다", async () => {
    let resolveGetSession: (value: { data: { session: null }; error: null }) => void = () => {};
    vi.mocked(supabase.auth.getSession).mockReturnValue(
      new Promise((resolve) => {
        resolveGetSession = resolve;
      }),
    );

    renderApp(["/"]);

    expect(screen.getByText("세션 확인 중")).toBeInTheDocument();
    expect(screen.queryByLabelText("이메일")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "문제 인식하기" })).not.toBeInTheDocument();

    resolveGetSession({ data: { session: null }, error: null });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "수풀잉" })).toBeInTheDocument(),
    );
  });

  it("비로그인 사용자가 '/'에 접근하면 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "수풀잉" })).toBeInTheDocument(),
    );
  });

  it("로그인된 사용자(학년 설정됨)가 '/'에 접근하면 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession({ user_metadata: { grade: "M1" } }) },
      error: null,
    });

    renderApp(["/"]);

    await waitFor(() => expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeInTheDocument());
  });

  it("로그인된 사용자(학년 미설정)가 '/'에 접근하면 /grade-setup으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "학년을 선택해 주세요" })).toBeInTheDocument(),
    );
  });

  it("이메일 로그인 성공 시 학년 미설정이면 완료 팝업 표시 후 '계속하기' 클릭 시에만 /grade-setup으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation((credentials) => {
      const email = "email" in credentials ? credentials.email : "student@example.com";
      const session = createFakeSession({ email });
      emitAuthChange("SIGNED_IN", session);
      return Promise.resolve({ data: { user: session.user, session }, error: null });
    });

    renderApp(["/login"]);
    await waitFor(() => expect(screen.getByLabelText("이메일")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    // 레이스 컨디션 회귀 방지: 인증 상태가 즉시 authenticated로 바뀌어도
    // PublicOnlyRoute가 LoginPage를 먼저 언마운트해선 안 되며, 완료 팝업이 먼저 보여야 한다.
    expect(await screen.findByText("로그인 되었습니다")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "학년을 선택해 주세요" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "학년을 선택해 주세요" })).toBeInTheDocument(),
    );
  });

  it("이메일 로그인 성공 시 학년이 설정되어 있으면 완료 팝업 표시 후 '계속하기' 클릭 시에만 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation((credentials) => {
      const email = "email" in credentials ? credentials.email : "student@example.com";
      const session = createFakeSession({ email, user_metadata: { grade: "H3" } });
      emitAuthChange("SIGNED_IN", session);
      return Promise.resolve({ data: { user: session.user, session }, error: null });
    });

    renderApp(["/login"]);
    await waitFor(() => expect(screen.getByLabelText("이메일")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "correct-password" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    // 레이스 컨디션 회귀 방지: 팝업이 먼저 보여야 하고, SolvePage로의 이동은
    // 팝업의 "계속하기" 클릭 이후에만 일어나야 한다.
    expect(await screen.findByText("로그인 되었습니다")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "문제 인식하기" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "계속하기" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeInTheDocument());
  });

  it("회원가입(가입 즉시 세션 발급 후 강제 로그아웃) 시 즉시 이동하지 않고 완료 팝업을 표시하며, '로그인하기' 클릭 후에만 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    const session = createFakeSession({ user_metadata: { nickname: "새싹" } });
    vi.mocked(supabase.auth.signUp).mockImplementation(() => {
      // 실제 Supabase 동작을 재현: signUp이 세션을 발급하는 순간 onAuthStateChange(SIGNED_IN)가
      // signUp()의 Promise가 resolve되기도 전에(거의 같은 시점에) 트리거될 수 있다.
      emitAuthChange("SIGNED_IN", session);
      return Promise.resolve({ data: { user: session.user, session }, error: null });
    });
    vi.mocked(supabase.auth.signOut).mockImplementation(() => {
      // forcedSignOut 흐름에서 signUpWithEmail이 내부적으로 호출하는 signOut() 역시
      // onAuthStateChange(SIGNED_OUT)를 Promise resolve 직전에 트리거한다.
      emitAuthChange("SIGNED_OUT", null);
      return Promise.resolve({ error: null });
    });

    renderApp(["/register"]);
    await waitFor(() => expect(screen.getByLabelText("이메일")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("제가 부를 수 있는 닉네임을 입력해 주세요"), {
      target: { value: "새싹" },
    });
    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 가입하기" }));

    // 레이스 컨디션 회귀 방지: signUp이 발급한 세션으로 인해 잠깐 authenticated 상태가 되더라도
    // PublicOnlyRoute가 RegisterPage를 먼저 언마운트해선 안 되며, 완료 팝업이 먼저 보여야 한다.
    expect(await screen.findByText("회원가입이 완료 되었습니다")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "문제 인식하기" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "학년을 선택해 주세요" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "로그인하기" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "이메일로 계속하기" })).toBeInTheDocument(),
    );
  });

  it("로그인한 사용자(학년 설정됨)의 /login 접근은 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession({ user_metadata: { grade: "M1" } }) },
      error: null,
    });

    renderApp(["/login"]);

    await waitFor(() => expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeInTheDocument());
  });

  it("비로그인 사용자는 /register에 정상 접근할 수 있다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/register"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "수풀잉" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "이메일로 가입하기" })).toBeInTheDocument();
  });

  it("로그인한 사용자의 /register 접근은 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession({ user_metadata: { grade: "M1" } }) },
      error: null,
    });

    renderApp(["/register"]);

    await waitFor(() => expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeInTheDocument());
  });

  it("비로그인 사용자의 보호 라우트(/solve/pencilcanvas) 접근은 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/solve/pencilcanvas"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "수풀잉" })).toBeInTheDocument(),
    );
  });

  it("존재하지 않는 URL은 NotFoundPage를 표시한다", () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/no-such-route"]);

    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeInTheDocument();
  });

  it("이메일 로그인 실패 시 /login에 머무르며 오류 팝업을 표시한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null, weakPassword: null },
      error: new AuthApiError("이메일 또는 비밀번호가 올바르지 않습니다.", 400, "invalid_credentials"),
    });

    renderApp(["/login"]);
    await waitFor(() => expect(screen.getByLabelText("이메일")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText("비밀번호"), { target: { value: "wrong-password" } });
    fireEvent.click(screen.getByRole("button", { name: "이메일로 계속하기" }));

    await waitFor(() =>
      expect(screen.getByText("이메일이나 비밀번호가 틀렸습니다")).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "수풀잉" })).toBeInTheDocument();
  });

  it("촬영 데이터 없이 /camera/preview에 접근하면 /camera로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/camera/preview"]);

    await waitFor(() => expect(screen.getByText("문제가 잘 보이게 맞춰 주세요")).toBeInTheDocument());
  });

  it("로그인한 사용자는 /camera에 정상 접근할 수 있다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/camera"]);

    await waitFor(() => expect(screen.getByText("문제가 잘 보이게 맞춰 주세요")).toBeInTheDocument());
  });
});
