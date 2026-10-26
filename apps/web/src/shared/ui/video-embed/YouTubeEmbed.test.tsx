import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { YouTubeEmbed } from "./YouTubeEmbed";
import { YouTubePlaybackGroup } from "./YouTubePlaybackGroup";
import {
  NOCOOKIE_ORIGIN as NOCOOKIE,
  loadAndSpy,
  sendPlayerState,
  stubIntersectionObserver,
} from "../../../test/youTubeTestUtils";

function stubReducedMotion(matches: boolean) {
  const mediaQueryList = {
    matches,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => mediaQueryList),
  );
}

function getIframe(title: string): HTMLIFrameElement {
  const element = screen.getByTitle(`${title} 영상 (YouTube)`);
  if (!(element instanceof HTMLIFrameElement)) throw new Error("iframe이 아니다");
  return element;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("YouTubeEmbed(facade, 누를 때만 재생 — 기본)", () => {
  it("처음에는 라벨이 있는 재생 버튼만 그리고 iframe을 만들지 않는다", () => {
    const { container } = render(
      <YouTubeEmbed
        videoId="vSsyDRtZmKw"
        title="수풀잉 사용 방법"
        thumbnailSrc="https://i.ytimg.com/vi/vSsyDRtZmKw/hqdefault.jpg"
      />,
    );
    expect(screen.getByRole("button", { name: "수풀잉 사용 방법 영상 재생" })).toBeInTheDocument();
    expect(container.querySelector("iframe")).toBeNull();
    const thumbnail = container.querySelector("img");
    expect(thumbnail).toHaveAttribute("loading", "lazy");
    expect(thumbnail).toHaveAttribute("alt", "");
    expect(container.firstElementChild).toHaveClass("aspect-video");
  });

  it("기본 모드는 IntersectionObserver를 만들지 않는다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="vSsyDRtZmKw" title="기본" />);
    expect(io.constructorSpy).not.toHaveBeenCalled();
  });

  it("누르면 youtube-nocookie iframe(autoplay, jsapi, origin, 소리 켬)으로 바뀌고 포커스가 옮겨간다", () => {
    render(<YouTubeEmbed videoId="2RgyXWjlH9I" title="수풀잉 설치" />);
    fireEvent.click(screen.getByRole("button", { name: "수풀잉 설치 영상 재생" }));

    const iframe = getIframe("수풀잉 설치");
    const src = iframe.getAttribute("src") ?? "";
    expect(src.startsWith(`${NOCOOKIE}/embed/2RgyXWjlH9I?`)).toBe(true);
    expect(src).toContain("autoplay=1");
    expect(src).toContain("enablejsapi=1");
    expect(src).toContain(`origin=${encodeURIComponent(window.location.origin)}`);
    expect(src).not.toContain("mute=1");
    expect(iframe).toHaveAttribute(
      "allow",
      "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
    );
    expect(iframe).toHaveAttribute("allowfullscreen");
    expect(iframe).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    expect(screen.queryByRole("button", { name: "수풀잉 설치 영상 재생" })).toBeNull();
    expect(iframe).toHaveFocus();
  });

  it("포커스 표시는 버튼의 마지막 자식 장식 span에 그린다(기본 ring-brand, 바꿀 수 있음)", () => {
    const { rerender } = render(<YouTubeEmbed videoId="vSsyDRtZmKw" title="기본" />);
    const button = screen.getByRole("button", { name: "기본 영상 재생" });
    expect(button).toHaveClass("group", "rounded-[inherit]", "outline-none");
    const ring = button.lastElementChild;
    expect(ring).toHaveAttribute("aria-hidden", "true");
    expect(ring).toHaveClass(
      "pointer-events-none",
      "absolute",
      "inset-0",
      "rounded-[inherit]",
      "group-focus-visible:ring-brand",
      "group-focus-visible:ring-inset",
    );

    rerender(
      <YouTubeEmbed
        videoId="vSsyDRtZmKw"
        title="기본"
        focusRingClassName="group-focus-visible:ring-4 group-focus-visible:ring-landing-brand-deeper"
      />,
    );
    const customRing = screen.getByRole("button", { name: "기본 영상 재생" }).lastElementChild;
    expect(customRing).toHaveClass("group-focus-visible:ring-landing-brand-deeper");
    expect(customRing).not.toHaveClass("group-focus-visible:ring-brand");
  });

  it("썸네일이 있으면 포커스 장식 span이 img보다 DOM 순서상 뒤에 있다(썸네일 위에 그려짐, §14.0)", () => {
    const { container } = render(
      <YouTubeEmbed
        videoId="vSsyDRtZmKw"
        title="순서"
        thumbnailSrc="https://i.ytimg.com/vi/x/maxresdefault.jpg"
      >
        <span>overlay</span>
      </YouTubeEmbed>,
    );
    const button = screen.getByRole("button", { name: "순서 영상 재생" });
    const img = container.querySelector("img");
    const ring = button.lastElementChild;
    if (!img || !ring) throw new Error("img 또는 장식 span이 없다");
    expect(ring.tagName).toBe("SPAN");
    expect(img.compareDocumentPosition(ring) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("thumbnailSrc가 없으면 이미지를 그리지 않는다", () => {
    const { container } = render(<YouTubeEmbed videoId="vSsyDRtZmKw" title="단색" />);
    expect(container.querySelector("img")).toBeNull();
  });

  it("썸네일: maxres 오류 → hq → 그것도 오류면 이미지를 지운다", () => {
    const { container } = render(
      <YouTubeEmbed
        videoId="v"
        title="썸네일"
        thumbnailSrc="https://t/maxres.jpg"
        thumbnailFallbackSrc="https://t/hq.jpg"
      />,
    );
    const first = container.querySelector("img");
    expect(first).toHaveAttribute("src", "https://t/maxres.jpg");
    if (!first) throw new Error("img가 없다");
    fireEvent.error(first);
    const second = container.querySelector("img");
    expect(second).toHaveAttribute("src", "https://t/hq.jpg");
    if (!second) throw new Error("img가 없다");
    fireEvent.error(second);
    expect(container.querySelector("img")).toBeNull();
  });

  it("썸네일: maxres가 120px 자리표시 이미지로 오면 hq로 바꾼다", () => {
    const { container } = render(
      <YouTubeEmbed
        videoId="v"
        title="썸네일"
        thumbnailSrc="https://t/maxres.jpg"
        thumbnailFallbackSrc="https://t/hq.jpg"
      />,
    );
    const first = container.querySelector("img");
    if (!first) throw new Error("img가 없다");
    Object.defineProperty(first, "naturalWidth", { configurable: true, value: 120 });
    fireEvent.load(first);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://t/hq.jpg");
  });

  it("실제 썸네일(1280px)이 오면 그대로 둔다", () => {
    const { container } = render(
      <YouTubeEmbed
        videoId="v"
        title="썸네일"
        thumbnailSrc="https://t/maxres.jpg"
        thumbnailFallbackSrc="https://t/hq.jpg"
      />,
    );
    const first = container.querySelector("img");
    if (!first) throw new Error("img가 없다");
    Object.defineProperty(first, "naturalWidth", { configurable: true, value: 1280 });
    fireEvent.load(first);
    expect(container.querySelector("img")).toHaveAttribute("src", "https://t/maxres.jpg");
  });
});

describe("YouTubeEmbed autoplayOnView(D2-1)", () => {
  it("가운데 선(rootMargin)과 가시 비율을 관찰하고, 가운데에 오면 mute=1 iframe을 만들되 포커스는 옮기지 않는다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="vSsyDRtZmKw" title="자동" autoplayOnView />);
    expect(io.observers.map((o) => o.options.rootMargin)).toContain("-50% 0px -50% 0px");
    expect(io.observers.some((o) => JSON.stringify(o.options.threshold) === "[0,0.25,0.9]")).toBe(
      true,
    );

    io.enterCenter();
    const iframe = getIframe("자동");
    expect(iframe.getAttribute("src")).toContain("mute=1");
    expect(iframe.getAttribute("src")).toContain("autoplay=1");
    expect(iframe).not.toHaveFocus();
    expect(document.activeElement).toBe(document.body);
  });

  it("가운데에 닿지 않아도 90% 이상 보이면 재생하고, 25~90% 사이에서는 아무것도 하지 않는다", () => {
    const io = stubIntersectionObserver();
    const { container } = render(<YouTubeEmbed videoId="v" title="아래" autoplayOnView />);
    io.setRatio(0.5);
    expect(container.querySelector("iframe")).toBeNull();
    io.setRatio(0.95);
    expect(getIframe("아래").getAttribute("src")).toContain("mute=1");
  });

  it("10%만 보이면 nocookie 출처로 pauseVideo를 보내고, 다시 가운데로 오면 playVideo를 보낸다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="왕복" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("왕복"));
    sendPlayerState(player.contentWindow, 1);

    io.leave();
    expect(player.commands().at(-1)).toEqual({
      payload: { event: "command", func: "pauseVideo", args: [] },
      targetOrigin: NOCOOKIE,
    });
    sendPlayerState(player.contentWindow, 2);

    io.enterCenter();
    expect(player.funcs().at(-1)).toBe("playVideo");
    // postMessage 오버로드 중 (message, targetOrigin: string) 형태로만 보낸다.
    expect(player.postMessage.mock.calls.map((call) => (call as unknown[])[1])).toEqual(
      player.postMessage.mock.calls.map(() => NOCOOKIE),
    );
  });

  it("사용자가 직접 멈췄으면 다시 화면에 들어와도 자동으로 이어 재생하지 않는다(D2-2)", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="사용자" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("사용자"));
    sendPlayerState(player.contentWindow, 1);
    sendPlayerState(player.contentWindow, 2); // 보이는 상태에서 사용자가 일시정지

    io.leave();
    io.enterCenter();
    expect(player.funcs()).not.toContain("playVideo");

    // 사용자가 다시 재생하면 이후로는 자동 재생 규칙이 돌아온다.
    sendPlayerState(player.contentWindow, 1);
    io.leave();
    sendPlayerState(player.contentWindow, 2);
    io.enterCenter();
    expect(player.funcs().at(-1)).toBe("playVideo");
  });

  it("다른 출처·다른 창의 메시지는 무시한다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="출처" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("출처"));
    sendPlayerState(player.contentWindow, 1);
    sendPlayerState(player.contentWindow, 2, "https://evil.example"); // 다른 출처
    sendPlayerState(window, 2); // 같은 출처, 다른 창

    io.leave();
    io.enterCenter();
    // 사용자 일시정지로 기록되지 않았으므로 다시 재생한다.
    expect(player.funcs().at(-1)).toBe("playVideo");
  });

  it("동작 줄이기면 화면에 들어와도 iframe을 만들지 않고, 누르면 소리를 켠 채 만들고 포커스를 옮긴다", () => {
    const io = stubIntersectionObserver();
    stubReducedMotion(true);
    const { container } = render(<YouTubeEmbed videoId="v" title="줄이기" autoplayOnView />);
    io.enterCenter();
    expect(container.querySelector("iframe")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "줄이기 영상 재생" }));
    const iframe = getIframe("줄이기");
    expect(iframe.getAttribute("src")).not.toContain("mute=1");
    expect(iframe).toHaveFocus();
  });

  it("데이터 절약 모드면 자동 재생하지 않는다(D2-3)", () => {
    const io = stubIntersectionObserver();
    vi.stubGlobal("navigator", { ...navigator, connection: { saveData: true } });
    const { container } = render(<YouTubeEmbed videoId="v" title="절약" autoplayOnView />);
    io.enterCenter();
    expect(container.querySelector("iframe")).toBeNull();
  });

  it("화면에 들어오기 전에 누르면 소리를 켠 iframe을 만든다", () => {
    stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="먼저" autoplayOnView />);
    fireEvent.click(screen.getByRole("button", { name: "먼저 영상 재생" }));
    expect(getIframe("먼저").getAttribute("src")).not.toContain("mute=1");
  });

  it("IntersectionObserver가 없어도 깨지지 않고, 누르면 재생한다", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<YouTubeEmbed videoId="v" title="미지원" autoplayOnView />);
    fireEvent.click(screen.getByRole("button", { name: "미지원 영상 재생" }));
    expect(getIframe("미지원")).toHaveFocus();
  });

  it("언마운트하면 관찰자를 끊고 message 리스너를 지운다", () => {
    const io = stubIntersectionObserver();
    const removeListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<YouTubeEmbed videoId="v" title="정리" autoplayOnView />);
    io.enterCenter();
    unmount();
    expect(io.observers).toHaveLength(2);
    expect(io.observers.every((o) => o.disconnected)).toBe(true);
    expect(removeListener).toHaveBeenCalledWith("message", expect.any(Function));
  });
});

describe("YouTubePlaybackGroup", () => {
  it("B가 재생을 시작하면(claim) A에 pauseVideo를 보낸다", () => {
    render(
      <YouTubePlaybackGroup>
        <YouTubeEmbed videoId="a" title="A" />
        <YouTubeEmbed videoId="b" title="B" />
      </YouTubePlaybackGroup>,
    );
    fireEvent.click(screen.getByRole("button", { name: "A 영상 재생" }));
    const playerA = loadAndSpy(getIframe("A"));
    sendPlayerState(playerA.contentWindow, 1);

    fireEvent.click(screen.getByRole("button", { name: "B 영상 재생" }));
    expect(playerA.commands().at(-1)).toEqual({
      payload: { event: "command", func: "pauseVideo", args: [] },
      targetOrigin: NOCOOKIE,
    });
  });

  it("Provider 밖에서는 아무 일도 하지 않는다(그룹 없이도 재생)", () => {
    render(<YouTubeEmbed videoId="a" title="단독" />);
    fireEvent.click(screen.getByRole("button", { name: "단독 영상 재생" }));
    expect(getIframe("단독")).toBeInTheDocument();
  });
});

describe("YouTubeEmbed 재생 규칙 경계(QA M-R2-2)", () => {
  it("재생 중 비율이 0.5·0.25로 줄면(25~90% 유지 구간) pauseVideo를 보내지 않고, 0.1이면 보낸다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="유지" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("유지"));
    sendPlayerState(player.contentWindow, 1);

    io.setCenter(false);
    io.setRatio(0.5);
    expect(player.funcs()).not.toContain("pauseVideo");
    io.setRatio(0.25); // 경계값: 25%는 아직 유지 구간이다
    expect(player.funcs()).not.toContain("pauseVideo");

    io.setRatio(0.1);
    expect(player.funcs().at(-1)).toBe("pauseVideo");
  });

  it("가시 비율 0.5라도 가운데 선에 닿으면 재생한다(비율 규칙과 별개)", () => {
    const io = stubIntersectionObserver();
    const { container } = render(<YouTubeEmbed videoId="v" title="가운데" autoplayOnView />);
    io.setRatio(0.5);
    expect(container.querySelector("iframe")).toBeNull();
    io.setCenter(true);
    expect(getIframe("가운데").getAttribute("src")).toContain("mute=1");
  });

  it("claim한 영상 자신에게는 pauseVideo를 보내지 않는다", () => {
    render(
      <YouTubePlaybackGroup>
        <YouTubeEmbed videoId="a" title="A" />
        <YouTubeEmbed videoId="b" title="B" />
      </YouTubePlaybackGroup>,
    );
    fireEvent.click(screen.getByRole("button", { name: "A 영상 재생" }));
    const playerA = loadAndSpy(getIframe("A"));
    sendPlayerState(playerA.contentWindow, 1);

    fireEvent.click(screen.getByRole("button", { name: "B 영상 재생" }));
    const playerB = loadAndSpy(getIframe("B"));
    sendPlayerState(playerB.contentWindow, 1); // 준비 신호 겸 재생 상태 → 다시 claim

    expect(playerA.funcs()).toContain("pauseVideo");
    expect(playerB.funcs()).not.toContain("pauseVideo");
  });
});

describe("YouTubeEmbed 명령 채널(QA L-R2-4, L-R2-5)", () => {
  it("iframe load만으로는 보류된 pauseVideo를 보내지 않고, 플레이어가 준비되면 보낸다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="보류" autoplayOnView />);
    io.enterCenter();
    io.leave(); // 준비 전에 화면을 벗어남 → pauseVideo 보류
    const player = loadAndSpy(getIframe("보류"));
    expect(player.funcs()).toEqual([]);

    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: NOCOOKIE,
          source: player.contentWindow,
          data: JSON.stringify({ event: "onReady" }),
        }),
      );
    });
    expect(player.funcs()).toEqual(["pauseVideo"]);
  });

  it("보류된 playVideo는 load 때 미리 보내고, 준비되면 한 번 더 보낸다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="재생보류" autoplayOnView />);
    io.enterCenter();
    io.leave();
    io.enterCenter(); // 보류 명령이 pauseVideo → playVideo로 바뀜
    const player = loadAndSpy(getIframe("재생보류"));
    expect(player.funcs()).toEqual(["playVideo"]);
    sendPlayerState(player.contentWindow, 3);
    expect(player.funcs()).toEqual(["playVideo", "playVideo"]);
  });

  it("일시정지 알림이 오지 않은 pauseVideo의 기다림은 잠시 뒤 풀려, 다음 사용자 일시정지를 놓치지 않는다", () => {
    vi.useFakeTimers();
    try {
      const io = stubIntersectionObserver();
      render(<YouTubeEmbed videoId="v" title="기다림" autoplayOnView />);
      io.enterCenter();
      const player = loadAndSpy(getIframe("기다림"));
      sendPlayerState(player.contentWindow, 3); // 버퍼링 중

      io.leave(); // pauseVideo, 그러나 플레이어는 일시정지 알림을 보내지 않는다
      act(() => {
        vi.advanceTimersByTime(2100);
      });
      io.enterCenter();
      sendPlayerState(player.contentWindow, 2); // 보이는 상태에서 진짜 사용자 일시정지

      const playCount = player.funcs().filter((f) => f === "playVideo").length;
      io.leave();
      io.enterCenter();
      expect(player.funcs().filter((f) => f === "playVideo")).toHaveLength(playCount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("YouTubeEmbed 명령 채널 세부(QA M-R3-1, L4g, L4h)", () => {
  function sendReady(source: Window | null) {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          origin: NOCOOKIE,
          source,
          data: JSON.stringify({ event: "onReady" }),
        }),
      );
    });
  }

  function listeningCalls(player: ReturnType<typeof loadAndSpy>) {
    return player.postMessage.mock.calls
      .map((call) => ({
        payload: JSON.parse(String(call[0])) as { event: string; id?: unknown; channel?: unknown },
        targetOrigin: (call as unknown[])[1],
      }))
      .filter(({ payload }) => payload.event === "listening");
  }

  it("iframe load 때 nocookie 출처로 listening(widget, id 포함)을 보낸다", () => {
    render(<YouTubeEmbed videoId="v" title="듣기" />);
    fireEvent.click(screen.getByRole("button", { name: "듣기 영상 재생" }));
    const player = loadAndSpy(getIframe("듣기"));
    const calls = listeningCalls(player);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.targetOrigin).toBe(NOCOOKIE);
    expect(calls[0]?.payload.channel).toBe("widget");
    expect(typeof calls[0]?.payload.id).toBe("string");
    expect(calls[0]?.payload.id).not.toBe("");
  });

  it("load 뒤·준비 전에 요청한 pauseVideo는 준비 신호가 올 때 정확히 한 번만 간다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="준비전" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("준비전"));
    io.leave(); // load 뒤, 준비 전
    expect(player.funcs()).toEqual([]);

    sendReady(player.contentWindow);
    expect(player.funcs()).toEqual(["pauseVideo"]);
    sendReady(player.contentWindow);
    sendPlayerState(player.contentWindow, 2);
    expect(player.funcs()).toEqual(["pauseVideo"]);
  });

  it("상태 메시지도 준비 신호다 — 보류된 pauseVideo가 한 번 간다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="상태준비" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("상태준비"));
    io.leave();
    expect(player.funcs()).toEqual([]);
    sendPlayerState(player.contentWindow, 3);
    sendPlayerState(player.contentWindow, 2);
    expect(player.funcs()).toEqual(["pauseVideo"]);
  });

  it("load 뒤·준비 전에 요청한 playVideo는 바로(미리) 보낸다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="미리재생" autoplayOnView />);
    io.enterCenter();
    const player = loadAndSpy(getIframe("미리재생"));
    io.leave(); // pause 보류(전송 안 됨)
    io.enterCenter(); // 보류가 playVideo로 바뀌고, load 뒤라 미리 보낸다
    expect(player.funcs()).toEqual(["playVideo"]);
  });

  it("준비 때 보낸 보류 명령은 비워진다 — 이후 준비·상태 메시지나 iframe 재로드가 다시 보내지 않는다", () => {
    const io = stubIntersectionObserver();
    render(<YouTubeEmbed videoId="v" title="비우기" autoplayOnView />);
    io.enterCenter();
    io.leave();
    io.enterCenter(); // 준비 전 보류: playVideo
    const iframe = getIframe("비우기");
    const player = loadAndSpy(iframe); // load 때 미리 1회
    sendReady(player.contentWindow); // 준비 때 1회, 보류 비움
    expect(player.funcs()).toEqual(["playVideo", "playVideo"]);

    sendReady(player.contentWindow);
    sendPlayerState(player.contentWindow, 1);
    fireEvent.load(iframe); // 플레이어 내부 이동 등으로 load가 다시 와도
    expect(player.funcs()).toEqual(["playVideo", "playVideo"]);
  });

  it("그룹이 멈춘 영상의 일시정지 알림은 사용자 일시정지가 아니다 — 다시 화면에 들어오면 자동 재생한다(L4g)", () => {
    const io = stubIntersectionObserver();
    render(
      <YouTubePlaybackGroup>
        <div data-video="a">
          <YouTubeEmbed videoId="a" title="A" autoplayOnView />
        </div>
        <YouTubeEmbed videoId="b" title="B" />
      </YouTubePlaybackGroup>,
    );
    const viewA = io.controlsFor((target) => target.closest('[data-video="a"]') !== null);
    viewA.enterCenter();
    const playerA = loadAndSpy(getIframe("A"));
    sendPlayerState(playerA.contentWindow, 1);

    fireEvent.click(screen.getByRole("button", { name: "B 영상 재생" })); // claim → A 멈춤
    expect(playerA.funcs().at(-1)).toBe("pauseVideo");
    sendPlayerState(playerA.contentWindow, 2); // A는 아직 화면 안 — 그룹 일시정지의 결과

    viewA.leave();
    viewA.enterCenter();
    expect(playerA.funcs().at(-1)).toBe("playVideo");
  });

  it("언마운트하면 일시정지 대기 타이머를 해제한다(L4h)", () => {
    vi.useFakeTimers();
    try {
      const io = stubIntersectionObserver();
      const { unmount } = render(<YouTubeEmbed videoId="v" title="타이머" autoplayOnView />);
      io.enterCenter();
      const player = loadAndSpy(getIframe("타이머"));
      sendPlayerState(player.contentWindow, 1);
      io.leave(); // pauseVideo + 대기 타이머
      expect(vi.getTimerCount()).toBe(1);
      unmount();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
