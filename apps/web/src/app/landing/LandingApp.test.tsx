import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { createFakeSession } from "../../test/supabaseTestUtils";
import { LandingApp, SESSION_CHECK_TIMEOUT_MS, type ScheduleTimeout } from "./LandingApp";

vi.mock("../../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      signInWithOAuth: vi.fn(),
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LandingApp(세션 확인)", () => {
  it("확인하는 동안 Spinner만 보이고, 세션이 있으면 서비스 루트(/)로 replace 이동한다", async () => {
    let resolveSession: (value: Awaited<ReturnType<typeof supabase.auth.getSession>>) => void = () => {};
    vi.mocked(supabase.auth.getSession).mockReturnValue(
      new Promise((resolve) => {
        resolveSession = resolve;
      }),
    );
    const redirect = vi.fn();
    render(<LandingApp redirectToService={redirect} />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();

    resolveSession({ data: { session: createFakeSession() }, error: null });

    await waitFor(() => expect(redirect).toHaveBeenCalledWith("/"));
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("기본 이동 함수는 location.replace('/')를 쓴다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession() },
      error: null,
    });
    const replaceSpy = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, replace: replaceSpy },
    });
    try {
      render(<LandingApp />);
      await waitFor(() => expect(replaceSpy).toHaveBeenCalledWith("/"));
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
    }
  });

  it("세션이 없으면 랜딩을 그린다", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    const redirect = vi.fn();
    render(<LandingApp redirectToService={redirect} />);

    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent("어디서 막혔는지");
    expect(redirect).not.toHaveBeenCalled();
  });

  it("세션 확인이 실패(reject)해도 랜딩을 그린다", async () => {
    vi.mocked(supabase.auth.getSession).mockRejectedValue(new Error("network"));
    const redirect = vi.fn();
    render(<LandingApp redirectToService={redirect} />);

    expect(await screen.findByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(redirect).not.toHaveBeenCalled();
  });

  describe("getSession이 늦거나 멈출 때", () => {
    type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>;

    function setup() {
      let resolveSession: (value: SessionResult) => void = () => {};
      vi.mocked(supabase.auth.getSession).mockReturnValue(
        new Promise((resolve) => {
          resolveSession = resolve;
        }),
      );
      let fireTimeout: () => void = () => {};
      const cancel = vi.fn();
      const scheduleTimeout = vi.fn<ScheduleTimeout>((callback) => {
        fireTimeout = callback;
        return cancel;
      });
      const redirect = vi.fn();
      render(<LandingApp redirectToService={redirect} scheduleTimeout={scheduleTimeout} />);
      return {
        redirect,
        scheduleTimeout,
        cancel,
        fireTimeout: () => act(() => fireTimeout()),
        resolveSession: (value: SessionResult) =>
          act(async () => {
            resolveSession(value);
            await Promise.resolve();
          }),
      };
    }

    it("제한 시간(3000ms)이 먼저 지나면 Spinner 대신 랜딩을 그린다", () => {
      const { scheduleTimeout, fireTimeout, redirect } = setup();
      expect(SESSION_CHECK_TIMEOUT_MS).toBe(3000);
      expect(scheduleTimeout).toHaveBeenCalledWith(expect.any(Function), SESSION_CHECK_TIMEOUT_MS);
      expect(screen.getByRole("status")).toBeInTheDocument();

      fireTimeout();

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("어디서 막혔는지");
      expect(redirect).not.toHaveBeenCalled();
    });

    it("랜딩을 보인 뒤 세션이 늦게 확인되면 그래도 서비스 루트(/)로 replace 이동한다", async () => {
      const { fireTimeout, resolveSession, redirect } = setup();
      fireTimeout();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();

      await resolveSession({ data: { session: createFakeSession() }, error: null });

      expect(redirect).toHaveBeenCalledWith("/");
    });

    it("랜딩을 보인 뒤 늦게 온 결과가 '세션 없음'이면 랜딩을 그대로 둔다", async () => {
      const { fireTimeout, resolveSession, redirect } = setup();
      fireTimeout();
      await resolveSession({ data: { session: null }, error: null });

      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
      expect(redirect).not.toHaveBeenCalled();
    });

    it("제한 시간 안에 결과가 오면 타이머를 취소한다", async () => {
      const { resolveSession, cancel } = setup();
      await resolveSession({ data: { session: null }, error: null });
      expect(cancel).toHaveBeenCalled();
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });
});
