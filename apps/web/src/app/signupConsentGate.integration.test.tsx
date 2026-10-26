import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../features/auth/AuthProvider";
import { deleteUnconsentedAccount } from "../shared/api/deleteUnconsentedAccount";
import { supabase } from "../shared/lib/supabase/client";
import {
  CONSENTED_METADATA,
  createFakeSession,
  createUnconsentedSession,
  type AuthStateListener,
} from "../test/supabaseTestUtils";
import { routeConfig } from "./routes";

/**
 * 가입 동의 게이트(PRD AUTH-11, Gate A) 라우터 통합 테스트.
 * mock 콜백이 아니라 실제 `routeConfig` + `AuthProvider` + `ProtectedRoute`를 통과시켜, 상태 변화와 이동이
 * 결합된 흐름(동의 저장 → USER_UPDATED, 삭제 → signOut → /login)을 검증한다.
 */

vi.mock("../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock("../shared/api/deleteUnconsentedAccount", () => ({
  deleteUnconsentedAccount: vi.fn(),
}));

// MyPage가 마운트 시 부르는 풀이 이력 조회만 빈 목록으로 대체한다(실제 네트워크 없음).
vi.mock("../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(() => Promise.resolve({ items: [] })),
  getProblemHistoryDetail: vi.fn(),
  reopenProblemHistory: vi.fn(),
  bulkDeleteProblemHistory: vi.fn(),
}));

const GATE_HEADING = "시작하기 전에 확인해 주세요";

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
      data: { subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() } },
    };
  });
  vi.mocked(supabase.auth.signOut).mockImplementation(() => {
    emitAuthChange("SIGNED_OUT", null);
    return Promise.resolve({ error: null });
  });
});

function startWith(session: Session | null) {
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session }, error: null } as Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >);
}

function renderApp(initialEntries: string[]) {
  const router = createMemoryRouter(routeConfig, { initialEntries });
  render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
  return router;
}

function tickAllConsents() {
  fireEvent.click(screen.getByRole("checkbox", { name: "(필수) 만 14세 이상입니다" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "(필수) 이용약관에 동의합니다" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "(필수) 개인정보처리방침에 동의합니다" }));
}

function consentedVersionOf(session: Session): Session {
  return { ...session, user: { ...session.user, user_metadata: { ...session.user.user_metadata, ...CONSENTED_METADATA } } };
}

describe("가입 동의 게이트 — 라우터 통합", () => {
  it("1. 동의 기록이 없는 신규 사용자가 '/'로 들어오면 /grade-setup 경로에서 게이트를 본다", async () => {
    startWith(createUnconsentedSession());

    const router = renderApp(["/"]);

    expect(await screen.findByRole("heading", { name: GATE_HEADING })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/grade-setup");
    expect(screen.queryByRole("heading", { name: "학년을 선택해 주세요" })).not.toBeInTheDocument();
  });

  it.each(["/solve/pencilcanvas", "/mypage", "/camera"])(
    "2. 동의 기록이 없는 기존 사용자(학년 있음)가 %s로 직접 들어가도 같은 경로에서 게이트를 본다",
    async (path) => {
      startWith(createUnconsentedSession({ user_metadata: { grade: "M2", nickname: "새싹" } }));

      const router = renderApp([path]);

      expect(await screen.findByRole("heading", { name: GATE_HEADING })).toBeInTheDocument();
      expect(router.state.location.pathname).toBe(path);
      expect(screen.queryByRole("button", { name: "문제 인식하기" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "학년 변경" })).not.toBeInTheDocument();
    },
  );

  it("3. 동의를 저장하고 USER_UPDATED가 오면 같은 경로에서 원래 화면을 렌더한다", async () => {
    const session = createUnconsentedSession({ user_metadata: { grade: "M2" } });
    startWith(session);
    vi.mocked(supabase.auth.updateUser).mockImplementation(() => {
      const updated = consentedVersionOf(session);
      emitAuthChange("USER_UPDATED", updated);
      return Promise.resolve({ data: { user: updated.user }, error: null });
    });

    const router = renderApp(["/solve/pencilcanvas"]);
    await screen.findByRole("heading", { name: GATE_HEADING });

    tickAllConsents();
    fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));

    expect(await screen.findByRole("button", { name: "문제 인식하기" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: GATE_HEADING })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/solve/pencilcanvas");
  });

  it("3-1. USER_UPDATED가 늦게 와도 저장 응답의 user로 동의를 확인해 원래 화면으로 넘어간다(R5)", async () => {
    const session = createUnconsentedSession();
    startWith(session);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: consentedVersionOf(session).user },
      error: null,
    });

    const router = renderApp(["/"]);
    await screen.findByRole("heading", { name: GATE_HEADING });

    tickAllConsents();
    fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));

    expect(await screen.findByRole("heading", { name: "학년을 선택해 주세요" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/grade-setup");

    // 이벤트가 나중에 도착해도 게이트가 다시 나타나지 않는다.
    act(() => emitAuthChange("USER_UPDATED", consentedVersionOf(session)));
    expect(screen.queryByRole("heading", { name: GATE_HEADING })).not.toBeInTheDocument();
  });

  it("3-2. 저장 응답으로 기억한 동의는 그 사용자에게만 적용된다 — 같은 화면에서 다른 미동의 계정으로 바뀌면 게이트가 다시 나온다", async () => {
    const session = createUnconsentedSession({ user_metadata: { grade: "M2" } });
    startWith(session);
    // USER_UPDATED 없이 저장 응답만 동의를 알려 준다(ProtectedRoute가 사용자 id를 기억하는 경로).
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: consentedVersionOf(session).user },
      error: null,
    });

    renderApp(["/solve/pencilcanvas"]);
    await screen.findByRole("heading", { name: GATE_HEADING });
    tickAllConsents();
    fireEvent.click(screen.getByRole("button", { name: "동의하고 시작하기" }));
    expect(await screen.findByRole("button", { name: "문제 인식하기" })).toBeInTheDocument();

    // 같은 마운트에서 다른 미동의 계정으로 세션이 바뀐다(다른 탭 로그인 등).
    act(() =>
      emitAuthChange(
        "SIGNED_IN",
        createUnconsentedSession({ id: "another-user-id", user_metadata: { grade: "M2" } }),
      ),
    );

    expect(await screen.findByRole("heading", { name: GATE_HEADING })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "문제 인식하기" })).not.toBeInTheDocument();
  });

  it("4. '다른 계정으로 로그인'을 누르면 /login에 도착한다", async () => {
    startWith(createUnconsentedSession({ user_metadata: { grade: "M2" } }));

    const router = renderApp(["/mypage"]);
    await screen.findByRole("heading", { name: GATE_HEADING });

    fireEvent.click(screen.getByRole("button", { name: "다른 계정으로 로그인" }));

    expect(await screen.findByRole("button", { name: "이메일로 계속하기" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });

  it.each(["/solve/pencilcanvas", "/grade-setup"])(
    "5. 동의를 마친 사용자는 %s에서 게이트를 보지 않는다",
    async (path) => {
      startWith(createFakeSession({ user_metadata: { grade: "M2" } }));

      renderApp([path]);

      if (path === "/grade-setup") {
        expect(await screen.findByRole("heading", { name: "학년을 선택해 주세요" })).toBeInTheDocument();
      } else {
        expect(await screen.findByRole("button", { name: "문제 인식하기" })).toBeInTheDocument();
      }
      expect(screen.queryByRole("heading", { name: GATE_HEADING })).not.toBeInTheDocument();
    },
  );

  it("6. 동의를 마친 사용자가 마이페이지에서 '학년 변경'으로 /grade-setup에 가도 게이트가 다시 나오지 않는다", async () => {
    startWith(createFakeSession({ user_metadata: { grade: "H1", nickname: "지민" } }));

    const router = renderApp(["/mypage"]);
    fireEvent.click(await screen.findByRole("button", { name: "학년 변경" }));

    expect(await screen.findByRole("heading", { name: "학년을 선택해 주세요" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/grade-setup");
    expect(screen.queryByRole("heading", { name: GATE_HEADING })).not.toBeInTheDocument();
  });

  it("7. 만 14세 미만 → 삭제하면 계정 삭제 API, 로컬 로그아웃 뒤 /login에 도착한다", async () => {
    startWith(createUnconsentedSession({ user_metadata: { grade: "M1" } }));
    vi.mocked(deleteUnconsentedAccount).mockResolvedValue("deleted");

    const router = renderApp(["/solve/pencilcanvas"]);
    await screen.findByRole("heading", { name: GATE_HEADING });

    fireEvent.click(screen.getByRole("button", { name: "만 14세 미만이에요" }));
    fireEvent.click(screen.getByRole("button", { name: "삭제하고 나가기" }));

    expect(await screen.findByRole("button", { name: "이메일로 계속하기" })).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"));
    // 최종 이동은 replace다. 여기서는 로그아웃 뒤 ProtectedRoute도 /login으로 replace하므로, 훅 자체의 replace(D5)는
    // `SignupConsentGate.test.tsx`에서 따로 고정한다.
    expect(router.state.historyAction).toBe("REPLACE");
    expect(deleteUnconsentedAccount).toHaveBeenCalledTimes(1);
    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });
});
