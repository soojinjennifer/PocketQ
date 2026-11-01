import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { HeroSection } from "./HeroSection";

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

function getHeroVideo(): HTMLVideoElement {
  const video = screen.getByLabelText(/수풀잉 홍보 영상/);
  if (!(video instanceof HTMLVideoElement)) {
    throw new Error("Hero 영상이 <video>가 아니다");
  }
  return video;
}

describe("HeroSection 홍보 영상", () => {
  let play: MockInstance<HTMLMediaElement["play"]>;
  let pause: MockInstance<HTMLMediaElement["pause"]>;

  beforeEach(() => {
    // jsdom은 미디어 재생을 구현하지 않는다.
    play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("오른쪽 비주얼은 포스터가 있는 음소거·반복·인라인 영상이고, 정지할 수 있게 컨트롤을 둔다", () => {
    stubReducedMotion(false);
    render(<HeroSection />);

    const video = getHeroVideo();
    expect(video.getAttribute("src")).toMatch(/hero-ad-720.*\.mp4$/);
    expect(video.getAttribute("poster")).toMatch(/hero-ad-poster.*\.webp$/);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.controls).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(screen.queryByRole("img", { name: /풀이 진단 화면 예시/ })).toBeNull();
  });

  it("자동 재생한다", () => {
    stubReducedMotion(false);
    render(<HeroSection />);

    expect(play).toHaveBeenCalled();
  });

  it("동작 줄이기 사용자에게는 자동 재생하지 않는다", () => {
    stubReducedMotion(true);
    render(<HeroSection />);

    expect(play).not.toHaveBeenCalled();
    expect(pause).toHaveBeenCalled();
  });
});
