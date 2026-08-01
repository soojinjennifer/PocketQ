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
  it("이메일 로그인 성공 시 user를 반환하고 즉시 이동하지 않는다", async () => {
    const session = createFakeSession();
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { error: string | null; user: typeof session.user | null } | undefined;
    await act(async () => {
      actionResult = await result.current.signInWithEmail("student@example.com", "correct-pw");
    });

    expect(actionResult?.error).toBeNull();
    expect(actionResult?.user).toEqual(session.user);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "correct-pw",
    });
    expect(screen.getByTestId("location")).toHaveTextContent("/mypage");
  });

  it("이메일 로그인 실패 시 오류 메시지를 반환하고 이동하지 않는다", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null, weakPassword: null },
      error: new AuthApiError("이메일 또는 비밀번호가 올바르지 않습니다.", 400, "invalid_credentials"),
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult:
      | { error: string | null; user: unknown; isInvalidCredentials: boolean }
      | undefined;
    await act(async () => {
      actionResult = await result.current.signInWithEmail("student@example.com", "wrong-pw");
    });

    expect(actionResult?.error).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
    expect(actionResult?.user).toBeNull();
    expect(actionResult?.isInvalidCredentials).toBe(true);
  });

  it("이메일 로그인 실패(다른 오류 코드) 시 isInvalidCredentials는 false를 반환한다", async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
      data: { user: null, session: null, weakPassword: null },
      error: new AuthApiError("이메일 인증이 필요합니다.", 400, "email_not_confirmed"),
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { error: string | null; isInvalidCredentials: boolean } | undefined;
    await act(async () => {
      actionResult = await result.current.signInWithEmail("student@example.com", "wrong-pw");
    });

    expect(actionResult?.error).toBe("이메일 인증이 필요합니다.");
    expect(actionResult?.isInvalidCredentials).toBe(false);
  });

  it("이메일 가입 시 닉네임을 options.data에 포함해 signUp을 호출한다", async () => {
    const session = createFakeSession();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.signUpWithEmail("new-student@example.com", "new-pw-123", "새싹");
    });

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: "new-student@example.com",
      password: "new-pw-123",
      options: { data: { nickname: "새싹" } },
    });
  });

  it("이메일 가입 성공(세션 즉시 발급) 시 세션을 종료하지만 자체적으로 이동하지 않는다", async () => {
    const session = createFakeSession();
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    });
    vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult:
      | {
          error: string | null;
          needsEmailConfirmation: boolean;
          forcedSignOut: boolean;
          alreadyRegistered: boolean;
        }
      | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail(
        "new-student@example.com",
        "new-pw-123",
        "새싹",
      );
    });

    expect(actionResult?.error).toBeNull();
    expect(actionResult?.needsEmailConfirmation).toBe(false);
    expect(actionResult?.forcedSignOut).toBe(true);
    expect(actionResult?.alreadyRegistered).toBe(false);
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent("/mypage");
  });

  it("이메일 가입 시 세션이 즉시 발급되지 않으면 이메일 인증 필요로 표시하고 이동하지 않는다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult:
      | {
          error: string | null;
          needsEmailConfirmation: boolean;
          forcedSignOut: boolean;
          alreadyRegistered: boolean;
        }
      | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail(
        "new-student@example.com",
        "new-pw-123",
        "새싹",
      );
    });

    expect(actionResult?.error).toBeNull();
    expect(actionResult?.needsEmailConfirmation).toBe(true);
    expect(actionResult?.forcedSignOut).toBe(false);
    expect(actionResult?.alreadyRegistered).toBe(false);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
  });

  it("이메일 가입 시 이미 가입된 이메일(오류 코드 user_already_exists)이면 alreadyRegistered를 true로 반환한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("User already registered", 400, "user_already_exists"),
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult:
      | {
          error: string | null;
          needsEmailConfirmation: boolean;
          forcedSignOut: boolean;
          alreadyRegistered: boolean;
        }
      | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail(
        "existing-student@example.com",
        "new-pw-123",
        "새싹",
      );
    });

    expect(actionResult?.alreadyRegistered).toBe(true);
    expect(actionResult?.error).toBe("User already registered");
  });

  it("이메일 가입 시 이미 가입된 이메일(오류 코드 email_exists)이면 alreadyRegistered를 true로 반환한다", async () => {
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: null, session: null },
      error: new AuthApiError("이미 가입된 이메일입니다.", 400, "email_exists"),
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult: { alreadyRegistered: boolean } | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail(
        "existing-student@example.com",
        "new-pw-123",
        "새싹",
      );
    });

    expect(actionResult?.alreadyRegistered).toBe(true);
  });

  it("이메일 가입 시 obfuscated 성공 응답(session 없음 + identities 빈 배열)이면 alreadyRegistered를 true로 반환한다", async () => {
    const existingUser = createFakeSession().user;
    vi.mocked(supabase.auth.signUp).mockResolvedValue({
      data: { user: { ...existingUser, identities: [] }, session: null },
      error: null,
    });

    const { result } = renderHook(() => useAuthActions(), { wrapper: Wrapper });

    let actionResult:
      | {
          error: string | null;
          needsEmailConfirmation: boolean;
          forcedSignOut: boolean;
          alreadyRegistered: boolean;
        }
      | undefined;
    await act(async () => {
      actionResult = await result.current.signUpWithEmail(
        "existing-student@example.com",
        "new-pw-123",
        "새싹",
      );
    });

    expect(actionResult?.error).toBeNull();
    expect(actionResult?.needsEmailConfirmation).toBe(false);
    expect(actionResult?.forcedSignOut).toBe(false);
    expect(actionResult?.alreadyRegistered).toBe(true);
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
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
