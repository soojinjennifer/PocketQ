import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "../../shared/lib/supabase/client";
import { loadAndSpy, sendPlayerState, stubIntersectionObserver } from "../../test/youTubeTestUtils";
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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LandingPage", () => {
  it("랜드마크와 제목 구조(H1 1개, 섹션 H2 6개)를 갖는다", () => {
    render(<LandingPage />);
    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "주요 메뉴" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    const h2Texts = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);
    expect(h2Texts).toEqual([
      "정답만 찾는 게 아니라“내 풀이 방법이 어디서 막히는지” 알아야 하잖아요.",
      "딱 3번 터치면 끝.",
      "직접 보면 바로 알아요",
      "처음부터 다시?아니요, 막힌 곳부터.",
      "오늘 막힌 문제,지금 바로 풀어봐요.",
      "홈 화면에 추가하는 방법",
    ]);
  });

  it("기기 안내 문구를 CTA 근처에 보인다", () => {
    render(<LandingPage />);
    const cta = screen.getByRole("region", { name: /오늘 막힌 문제/ });
    expect(within(cta).getByText("iPad 가로 화면에 최적화되어 있어요")).toBeInTheDocument();
  });

  it("CTA 본문은 동의 기록까지 포함한 수집 항목을 알린다(PRD AUTH-4)", () => {
    render(<LandingPage />);
    const cta = screen.getByRole("region", { name: /오늘 막힌 문제/ });
    expect(within(cta).getByText(/이메일·닉네임·학년과 동의 기록만 받아요\./)).toBeInTheDocument();
    expect(within(cta).queryByText(/학년만 받아요/)).toBeNull();
  });

  it("#video에는 사용 방법 영상만, Install 섹션(CTA 다음·Footer 앞)에는 설치 영상을 facade로 그린다", () => {
    render(<LandingPage />);
    const video = screen.getByRole("region", { name: "직접 보면 바로 알아요" });
    expect(video).toHaveAttribute("id", "video");
    expect(within(video).getAllByRole("button", { name: /영상 재생$/ })).toHaveLength(1);
    expect(
      within(video).getByRole("button", { name: "수풀잉 사용 방법 영상 재생" }),
    ).toBeInTheDocument();

    const install = screen.getByRole("region", { name: "홈 화면에 추가하는 방법" });
    expect(install).toHaveAttribute("id", "install");
    expect(within(install).getByText("INSTALL")).toBeInTheDocument();
    expect(
      within(install).getByRole("button", { name: "수풀잉 설치 영상 재생" }),
    ).toBeInTheDocument();

    const cta = screen.getByRole("region", { name: /오늘 막힌 문제/ });
    const footer = screen.getByRole("contentinfo");
    expect(cta.compareDocumentPosition(install) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(install.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("영상은 maxres 썸네일을 보이고, 포커스 표시는 썸네일 위 장식 span에 그리며, 누르면 nocookie iframe으로 바뀐다", () => {
    const { container } = render(<LandingPage />);
    expect(
      container.querySelector('img[src="https://i.ytimg.com/vi/jI4vfnx2AEk/maxresdefault.jpg"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('img[src="https://i.ytimg.com/vi/2RgyXWjlH9I/maxresdefault.jpg"]'),
    ).not.toBeNull();

    const usage = screen.getByRole("button", { name: "수풀잉 사용 방법 영상 재생" });
    expect(usage.lastElementChild).toHaveClass(
      "group-focus-visible:ring-landing-brand-deeper",
      "group-focus-visible:outline-landing-label-on-deep",
    );
    expect(within(usage).getByText("수풀잉 사용 방법 · 1분 영상")).toHaveClass(
      "bg-landing-brand-deeper/80",
      "text-landing-label-on-deep",
      "rounded-full",
    );

    fireEvent.click(usage);
    fireEvent.click(screen.getByRole("button", { name: "수풀잉 설치 영상 재생" }));
    expect(screen.getByTitle("수풀잉 사용 방법 영상 (YouTube)")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/jI4vfnx2AEk?"),
    );
    expect(screen.getByTitle("수풀잉 설치 영상 (YouTube)")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube-nocookie.com/embed/2RgyXWjlH9I?"),
    );
  });

  it("Footer 법적 고지는 같은 탭 링크(/privacy.html, /terms.html)다", () => {
    render(<LandingPage />);
    const footer = screen.getByRole("contentinfo");
    const privacy = within(footer).getByRole("link", { name: "개인정보처리방침" });
    const terms = within(footer).getByRole("link", { name: "이용약관" });
    expect(privacy).toHaveAttribute("href", "/privacy.html");
    expect(terms).toHaveAttribute("href", "/terms.html");
    expect(privacy).not.toHaveAttribute("target");
    expect(terms).not.toHaveAttribute("target");
  });

  it("오너 앱 아이콘(글자 뺀 crop)을 Nav와 Why 카드에 1x/2x로 쓴다", () => {
    const { container } = render(<LandingPage />);
    const icons = Array.from(container.querySelectorAll("img")).filter((img) =>
      (img.getAttribute("src") ?? "").includes("app-icon-40"),
    );
    expect(icons).toHaveLength(2);
    for (const icon of icons) {
      expect(icon.getAttribute("srcset")).toMatch(/app-icon-40\.webp 1x, .*app-icon-80\.webp 2x$/);
    }
    expect(container.querySelector('img[src*="app-icon-120"]')).toBeNull();
  });

  it.each([
    ["카카오로 시작하기", "kakao"],
    ["Google로 시작하기", "google"],
  ] as const)(
    "'%s'는 기존 OAuth 흐름을 provider '%s'로 시작한다(복귀 주소 = 서비스 루트)",
    async (label, provider) => {
      render(<LandingPage />);
      fireEvent.click(screen.getByRole("button", { name: label }));
      await waitFor(() =>
        expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
          provider,
          options: { redirectTo: window.location.origin },
        }),
      );
    },
  );

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

describe("LandingPage 영상 연결(QA M-R2-1)", () => {
  const inSection = (id: string) => (target: Element) => target.closest("section")?.id === id;

  function iframeIn(sectionId: string): HTMLIFrameElement {
    const iframe = document.querySelector(`#${sectionId} iframe`);
    if (!(iframe instanceof HTMLIFrameElement)) throw new Error(`#${sectionId}에 iframe이 없다`);
    return iframe;
  }

  it("Video·Install 두 영상 모두 autoplayOnView다 — 가운데에 오면 각각 mute=1 iframe을 만든다", () => {
    const io = stubIntersectionObserver();
    render(<LandingPage />);
    expect(io.observers.filter((o) => o.observed.some(inSection("video")))).toHaveLength(2);
    expect(io.observers.filter((o) => o.observed.some(inSection("install")))).toHaveLength(2);

    io.controlsFor(inSection("video")).enterCenter();
    expect(iframeIn("video").getAttribute("src")).toContain("embed/jI4vfnx2AEk?");
    expect(iframeIn("video").getAttribute("src")).toContain("mute=1");
    expect(document.querySelector("#install iframe")).toBeNull();

    io.controlsFor(inSection("install")).enterCenter();
    expect(iframeIn("install").getAttribute("src")).toContain("embed/2RgyXWjlH9I?");
    expect(iframeIn("install").getAttribute("src")).toContain("mute=1");
  });

  it("한 번에 하나만 재생한다 — Install이 재생을 시작하면 Video에 pauseVideo가 간다", () => {
    const io = stubIntersectionObserver();
    render(<LandingPage />);
    io.controlsFor(inSection("video")).enterCenter();
    const video = loadAndSpy(iframeIn("video"));
    sendPlayerState(video.contentWindow, 1);
    expect(video.funcs()).not.toContain("pauseVideo");

    // Video는 화면 밖으로 나가지 않았다 — pause는 그룹(claim)에서만 올 수 있다.
    io.controlsFor(inSection("install")).enterCenter();
    expect(video.funcs().at(-1)).toBe("pauseVideo");
  });

  it("maxres 썸네일을 못 불러오면 hq 썸네일로 바꾼다(두 영상 모두)", () => {
    const { container } = render(<LandingPage />);
    for (const id of ["jI4vfnx2AEk", "2RgyXWjlH9I"]) {
      const maxres = container.querySelector(
        `img[src="https://i.ytimg.com/vi/${id}/maxresdefault.jpg"]`,
      );
      if (!maxres) throw new Error(`${id} maxres 썸네일이 없다`);
      fireEvent.error(maxres);
      expect(
        container.querySelector(`img[src="https://i.ytimg.com/vi/${id}/hqdefault.jpg"]`),
      ).not.toBeNull();
    }
  });
});
