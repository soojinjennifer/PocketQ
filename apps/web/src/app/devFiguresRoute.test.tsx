import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { routeConfig } from "./routes";

// gitignored `.env`(VITE_SUPABASE_*) 없이도 돌도록 다른 라우트 테스트와 같은 관례로 Supabase 클라이언트를 mock한다
// (Stage 5 재작업 1, QA LOW-6 — 깨끗한 체크아웃에서 `createClient("")`가 스위트 로드를 깨뜨렸다). 라우팅만 검증하므로 auth는 쓰지 않는다.
vi.mock("../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));

// 미리보기 페이지의 FigureView가 실제 JSXGraph를 부르지 않게 한다(라우팅만 검증).
vi.mock("../features/figure-visualization/jsxgraphAdapter", () => ({
  loadJsxGraph: () => new Promise(() => {}),
}));

describe("개발 전용 /dev/figures 라우트", () => {
  it("개발 모드에서 /dev/figures가 도형 미리보기 페이지를 지연 로딩한다", async () => {
    expect(import.meta.env.DEV).toBe(true);
    const router = createMemoryRouter(routeConfig, { initialEntries: ["/dev/figures"] });
    render(<RouterProvider router={router} />);
    expect(await screen.findByRole("heading", { level: 1, name: "도형 미리보기 (개발 전용)" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "F01 삼각형과 각" })).toBeInTheDocument();
    expect(screen.queryByText("페이지를 찾을 수 없습니다")).not.toBeInTheDocument();
  });

  it("/dev/figures 라우트는 `*`(Not Found)보다 앞에 있다", () => {
    const paths = routeConfig.map((route) => route.path);
    const devIndex = paths.indexOf("/dev/figures");
    expect(devIndex).toBeGreaterThan(-1);
    expect(devIndex).toBeLessThan(paths.indexOf("*"));
  });
});
