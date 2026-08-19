import { AuthApiError } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession, type AuthStateListener } from "../../test/supabaseTestUtils";
import { AuthProvider } from "./AuthProvider";
import { useAuth } from "./useAuth";

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

function AuthProbe() {
  const { status, user, holdPublicRedirect, isPasswordRecovery } = useAuth();
  return (
    <div>
      <div data-testid="status">{status}</div>
      <div data-testid="user-email">{user?.email ?? "none"}</div>
      <div data-testid="hold-public-redirect">{String(holdPublicRedirect)}</div>
      <div data-testid="is-password-recovery">{String(isPasswordRecovery)}</div>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(() => ({
    data: {
      subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() },
    },
  }));
});

describe("AuthProvider", () => {
  it("세션 복원 성공 시 authenticated 상태와 사용자 정보를 제공한다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession({ email: "jimin@example.com" }) },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(screen.getByTestId("user-email")).toHaveTextContent("jimin@example.com");
  });

  it("세션 복원 실패(에러) 시 unauthenticated 상태가 된다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: new AuthApiError("세션을 확인할 수 없습니다.", 500, "unexpected_failure"),
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("user-email")).toHaveTextContent("none");
  });

  it("재방문(새로고침) 시 지속된 세션이 있으면 별도 로그인 액션 없이 authenticated로 복원된다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled();
    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("onAuthStateChange로 SIGNED_OUT 이벤트가 오면 상태가 unauthenticated로 갱신된다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });

    let capturedCallback: AuthStateListener | undefined;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      capturedCallback = callback;
      return {
        data: {
          subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() },
        },
      };
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

    void capturedCallback?.("SIGNED_OUT", null);

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
  });

  it("PASSWORD_RECOVERY 이벤트가 오면 isPasswordRecovery와 holdPublicRedirect가 모두 true가 된다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let capturedCallback: AuthStateListener | undefined;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      capturedCallback = callback;
      return {
        data: {
          subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() },
        },
      };
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"),
    );
    expect(screen.getByTestId("is-password-recovery")).toHaveTextContent("false");

    void capturedCallback?.("PASSWORD_RECOVERY", createFakeSession());

    await waitFor(() =>
      expect(screen.getByTestId("is-password-recovery")).toHaveTextContent("true"),
    );
    expect(screen.getByTestId("hold-public-redirect")).toHaveTextContent("true");
    expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
  });

  it("recovery 상태에서 세션이 사라지면 isPasswordRecovery와 holdPublicRedirect가 모두 false로 돌아온다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    });

    let capturedCallback: AuthStateListener | undefined;
    vi.mocked(supabase.auth.onAuthStateChange).mockImplementation((callback) => {
      capturedCallback = callback;
      return {
        data: {
          subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() },
        },
      };
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    void capturedCallback?.("PASSWORD_RECOVERY", createFakeSession());
    await waitFor(() =>
      expect(screen.getByTestId("is-password-recovery")).toHaveTextContent("true"),
    );

    void capturedCallback?.("SIGNED_OUT", null);

    await waitFor(() =>
      expect(screen.getByTestId("is-password-recovery")).toHaveTextContent("false"),
    );
    expect(screen.getByTestId("hold-public-redirect")).toHaveTextContent("false");
  });
});
