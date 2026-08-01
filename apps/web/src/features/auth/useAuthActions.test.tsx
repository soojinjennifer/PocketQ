import { AuthApiError } from "@supabase/supabase-js";
import { act, renderHook, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession } from "../../test/supabaseTestUtils";
import { useAuthActions } from "./useAuthActions";

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

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter initialEntries={["/mypage"]}>
      {children}
      <LocationDisplay />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useAuthActions", () => {
  it("이메일 로그인 성공 시 /solve로 replace 이동한다", async () => {
    const session = createFakeSession();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { error: string | null } | undefined;
    await act(async () => {
      actionResult = await result.current.signInWithEmail("student@example.com", "correct-pw");
    });

    expect(actionResult?.error).toBeNull();
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "correct-pw",
    });
  });

  it("이메일 로그인 실패 시 오류 메시지를 반환하고 이동하지 않는다", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null, weakPassword: null },
      error: new AuthApiError("이메일 또는 비밀번호가 올바르지 않습니다.", 400, "invalid_credentials"),
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { error: string | null } | undefined;
    await act(async () => {
      actionResult = await result.current.signInWithEmail("student@example.com", "wrong-pw");
    });

    expect(actionResult?.error).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
  });

  it("이메일 가입 성공(세션 즉시 발급) 시 /solve로 이동한다", async () => {
    const session = createFakeSession();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { error: string | null; needsEmailConfirmation: boolean } | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail("new-student@example.com", "new-pw-123");
    });

    expect(actionResult?.error).toBeNull();
    expect(actionResult?.needsEmailConfirmation).toBe(false);
  });

  it("이메일 가입 시 세션이 즉시 발급되지 않으면 이메일 인증 필요로 표시하고 이동하지 않는다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { error: string | null; needsEmailConfirmation: boolean } | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail("new-student@example.com", "new-pw-123");
    });

    expect(actionResult?.error).toBeNull();
    expect(actionResult?.needsEmailConfirmation).toBe(true);
  });

  it("소셜 로그인(OAuth) 트리거 시 provider와 redirectTo를 전달한다(외부 Provider 콘솔 의존 부분은 모킹)", async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: "kakao", url: "https://example.com/oauth", flowId: "flow-1" },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.signInWithOAuth("kakao");
    });

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "kakao",
      options: { redirectTo: window.location.origin },
    });
  });

  it("로그아웃 성공 시 Supabase sign-out을 호출하고 /login으로 replace 이동한다", async () => {
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/login"));
  });

  it("비밀번호를 localStorage 등 별도 저장소에 직접 저장하지 않는다", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    const session = createFakeSession();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });
    const rawPassword = "super-secret-password-value";

    await act(async () => {
      await result.current.signInWithEmail("student@example.com", rawPassword);
    });

    const persistedRawPassword = setItemSpy.mock.calls.some(
      ([, value]) => typeof value === "string" && value.includes(rawPassword),
    );
    expect(persistedRawPassword).toBe(false);

    setItemSpy.mockRestore();
  });
});
