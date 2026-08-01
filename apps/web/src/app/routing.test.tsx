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
    expect(screen.queryByText("SolvePage")).not.toBeInTheDocument();

    resolveGetSession({ data: { session: null }, error: null });
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "왜?수학" })).toBeInTheDocument(),
    );
  });

  it("비로그인 사용자가 '/'에 접근하면 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "왜?수학" })).toBeInTheDocument(),
    );
  });

  it("로그인된 사용자가 '/'에 접근하면 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/"]);

    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
    expect(screen.getByText("현재 라우트: /solve")).toBeInTheDocument();
  });

  it("이메일 로그인 성공 시 /solve로 이동한다", async () => {
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

    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("로그인한 사용자의 /login 접근은 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/login"]);

    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("비로그인 사용자는 /register에 정상 접근할 수 있다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/register"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "왜?수학" })).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "이메일로 가입하기" })).toBeInTheDocument();
  });

  it("로그인한 사용자의 /register 접근은 /solve로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/register"]);

    await waitFor(() => expect(screen.getByText("SolvePage")).toBeInTheDocument());
  });

  it("비로그인 사용자의 보호 라우트(/solve) 접근은 /login으로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/solve"]);

    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "왜?수학" })).toBeInTheDocument(),
    );
  });

  it("존재하지 않는 URL은 NotFoundPage를 표시한다", () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });

    renderApp(["/no-such-route"]);

    expect(screen.getByText("페이지를 찾을 수 없습니다")).toBeInTheDocument();
  });

  it("이메일 로그인 실패 시 /login에 머무르며 오류 메시지를 표시한다", async () => {
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
      expect(screen.getByText("이메일 또는 비밀번호가 올바르지 않습니다.")).toBeInTheDocument(),
    );
    expect(screen.getByRole("heading", { name: "왜?수학" })).toBeInTheDocument();
  });

  it("촬영 데이터 없이 /camera/preview에 접근하면 /camera로 이동한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/camera/preview"]);

    await waitFor(() => expect(screen.getByText("CameraCapturePage")).toBeInTheDocument());
    expect(screen.getByText("현재 라우트: /camera")).toBeInTheDocument();
  });

  it("로그인한 사용자는 /camera에 정상 접근할 수 있다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    renderApp(["/camera"]);

    await waitFor(() => expect(screen.getByText("CameraCapturePage")).toBeInTheDocument());
  });
});
