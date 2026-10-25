import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { YouTubeEmbed } from "./YouTubeEmbed";

describe("YouTubeEmbed(facade)", () => {
  it("처음에는 라벨이 있는 재생 버튼만 그리고 iframe을 만들지 않는다", () => {
    const { container } = render(
      <YouTubeEmbed videoId="vSsyDRtZmKw" title="수풀잉 사용 방법" thumbnailSrc="https://i.ytimg.com/vi/vSsyDRtZmKw/hqdefault.jpg" />,
    );
    expect(screen.getByRole("button", { name: "수풀잉 사용 방법 영상 재생" })).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    const thumbnail = container.querySelector("img");
    expect(thumbnail).toHaveAttribute("loading", "lazy");
    expect(thumbnail).toHaveAttribute("alt", "");
    expect(container.firstElementChild).toHaveClass("aspect-video");
  });

  it("누르면 youtube-nocookie iframe(autoplay)으로 바뀌고 포커스가 옮겨간다", () => {
    render(<YouTubeEmbed videoId="2RgyXWjlH9I" title="수풀잉 설치" />);
    fireEvent.click(screen.getByRole("button", { name: "수풀잉 설치 영상 재생" }));

    const iframe = screen.getByTitle("수풀잉 설치 영상 (YouTube)");
    const src = iframe.getAttribute("src") ?? "";
    expect(src.startsWith("https://www.youtube-nocookie.com/embed/2RgyXWjlH9I?")).toBe(true);
    expect(src).toContain("autoplay=1");
    expect(iframe).toHaveAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(screen.queryByRole("button", { name: "수풀잉 설치 영상 재생" })).toBeNull();
    expect(iframe).toHaveFocus();
  });

  it("포커스 링 기본값은 ring-brand이고, focusRingClassName으로 바꿀 수 있다", () => {
    const { rerender } = render(<YouTubeEmbed videoId="vSsyDRtZmKw" title="기본" />);
    const defaultButton = screen.getByRole("button", { name: "기본 영상 재생" });
    expect(defaultButton).toHaveClass("focus-visible:ring-brand", "focus-visible:ring-inset");

    rerender(
      <YouTubeEmbed
        videoId="vSsyDRtZmKw"
        title="기본"
        focusRingClassName="focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-landing-label-on-deep"
      />,
    );
    const customButton = screen.getByRole("button", { name: "기본 영상 재생" });
    expect(customButton).toHaveClass("focus-visible:ring-landing-label-on-deep");
    expect(customButton).not.toHaveClass("focus-visible:ring-brand");
  });

  it("thumbnailSrc가 없으면 이미지를 그리지 않는다", () => {
    const { container } = render(<YouTubeEmbed videoId="vSsyDRtZmKw" title="단색" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
