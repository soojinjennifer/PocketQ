import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { LandingPage } from "./LandingPage";

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
  vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { provider: "kakao", url: "https://example.com/oauth", flowId: "flow-1" },
    error: null,
  });
});

describe("LandingPage", () => {
  it("랜드마크와 제목 구조(H1 1개, 섹션 H2 5개)를 갖는다", () => {
    render(<LandingPage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h2Texts = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(h2Texts).toEqual([
      "정답만 찾는 게 아니라“내 풀이 방법이 어디서 막히는지” 알아야 하잖아요.",
      "딱 3번 터치면 끝.",
      "직접 보면 바로 알아요",
      "처음부터 다시?아니요, 막힌 곳부터.",
      "오늘 막힌 문제,지금 바로 풀어봐요.",
    ]);
  });

  it("기기 안내 문구를 CTA 근처에 보인다", () => {
    render(<LandingPage />);
    const cta = screen.getByRole("region", { name: /오늘 막힌 문제/ });
    expect(within(cta).getByText("iPad 가로 화면에 최적화되어 있어요")).toBeInTheDocument();
  });

  it("두 영상(사용 방법 vSsyDRtZmKw, 설치 2RgyXWjlH9I)을 facade로 그린다", () => {
    const { container } = render(<LandingPage />);
    // Figma 단색 패널(검수 M-4) — 재생 전에는 YouTube 썸네일도 요청하지 않는다.
    expect(container.querySelector('img[src*="ytimg"]')).toBeNull();
    expect(screen.getByRole("button", { name: "수풀잉 사용 방법 영상 재생" })).toHaveClass(
      "focus-visible:ring-landing-label-on-deep",
    );
    fireEvent.click(screen.getByRole("button", { name: "수풀잉 사용 방법 영상 재생" }));
    fireEvent.click(screen.getByRole("button", { name: "수풀잉 설치 영상 재생" }));
    expect(screen.getByTitle("수풀잉 사용 방법 영상 (YouTube)")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/vSsyDRtZmKw?"),
    );
    expect(screen.getByTitle("수풀잉 설치 영상 (YouTube)")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/2RgyXWjlH9I?"),
    );
  });

  it.each([
    ["카카오로 시작하기", "kakao"],
    ["Google로 시작하기", "google"],
  ] as const)("'%s'는 기존 OAuth 흐름을 provider '%s'로 시작한다(복귀 주소 = 서비스 루트)", async (label, provider) => {
    render(<LandingPage />);
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() =>
      expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
        provider,
        options: { redirectTo: window.location.origin },
      }),
    );
  });

  it("OAuth 시작이 실패하면 버튼을 다시 풀고 오류를 알린다", async () => {
    vi.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { provider: "google", url: null },
      error: new Error("provider disabled"),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.signInWithOAuth>>);
    render(<LandingPage />);
    const google = screen.getByRole("button", { name: "Google로 시작하기" });
    fireEvent.click(google);
    expect(await screen.findByRole("alert")).toHaveTextContent("provider disabled");
    expect(google).not.toBeDisabled();
  });

  it("일러스트의 버튼 모양 요소는 실제 버튼이 아니다(탭 순서 제외)", () => {
    render(<LandingPage />);
    expect(screen.queryByRole("button", { name: "봐 주세요" })).toBeNull();
    expect(screen.queryByRole("button", { name: "내 방법으로 계속" })).toBeNull();
    expect(screen.getByRole("img", { name: /진단 예시/ })).toBeInTheDocument();
  });
});
