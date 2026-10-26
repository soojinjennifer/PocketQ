import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../../shared/lib/supabase/client", () => ({
  supabase: { auth: { updateUser: vi.fn(), signOut: vi.fn() } },
}));

const GATE_HEADING = "시작하기 전에 확인해 주세요";

function authValue(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    status: "unauthenticated",
    user: null,
    holdPublicRedirect: false,
    setHoldPublicRedirect: () => undefined,
    isPasswordRecovery: false,
    setIsPasswordRecovery: () => undefined,
    ...overrides,
  };
}

describe("ProtectedRoute", () => {
  it("비로그인이면 /login으로 가기 전 한 번도 가입 동의 게이트나 보호 화면을 DOM에 그리지 않는다(깜빡임 없음)", async () => {
    // 최종 화면만 보면 이동 전 잠깐 그려진 게이트를 놓친다. DOM에 추가된 모든 노드를 기록해 확인한다.
    const addedTexts: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => addedTexts.push(node.textContent ?? ""));
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    const router = createMemoryRouter(
      [
        {
          path: "/mypage",
          element: (
            <ProtectedRoute>
              <div>보호 화면</div>
            </ProtectedRoute>
          ),
        },
        { path: "/login", element: <div>LoginPage</div> },
      ],
      { initialEntries: ["/mypage"] },
    );
    render(
      <AuthContext.Provider value={authValue({ status: "unauthenticated" })}>
        <RouterProvider router={router} />
      </AuthContext.Provider>,
    );

    expect(await screen.findByText("LoginPage")).toBeInTheDocument();
    addedTexts.push(...observer.takeRecords().flatMap((record) => Array.from(record.addedNodes, (node) => node.textContent ?? "")));
    observer.disconnect();

    expect(addedTexts.some((text) => text.includes(GATE_HEADING))).toBe(false);
    expect(addedTexts.some((text) => text.includes("보호 화면"))).toBe(false);
    expect(router.state.historyAction).toBe("REPLACE");
  });
});
