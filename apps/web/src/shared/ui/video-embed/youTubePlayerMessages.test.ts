import { describe, expect, it, vi } from "vitest";
import { parsePlayerMessage, postListening, postPlayerCommand } from "./youTubePlayerMessages";
import { buildYouTubeEmbedSrc, youTubeThumbnailUrls } from "./youTubeUrls";

const NOCOOKIE = "https://www.youtube-nocookie.com";

function mountIframe() {
  const iframe = document.createElement("iframe");
  document.body.appendChild(iframe);
  const contentWindow = iframe.contentWindow;
  if (!contentWindow) throw new Error("contentWindow가 없다");
  return { iframe, contentWindow };
}

function message(data: unknown, source: Window | null, origin = NOCOOKIE) {
  return new MessageEvent("message", { data, source, origin });
}

describe("youTubeUrls", () => {
  it("embed 주소: jsapi·origin을 넣고, muted일 때만 mute=1", () => {
    const loud = buildYouTubeEmbedSrc("abc", { muted: false, origin: "https://x.test" });
    expect(loud).toBe(
      `${NOCOOKIE}/embed/abc?autoplay=1&rel=0&playsinline=1&enablejsapi=1&origin=https%3A%2F%2Fx.test`,
    );
    expect(buildYouTubeEmbedSrc("abc", { muted: true, origin: "https://x.test" })).toBe(
      `${loud}&mute=1`,
    );
  });

  it("썸네일 주소는 i.ytimg.com의 maxres와 hq", () => {
    expect(youTubeThumbnailUrls("abc")).toEqual({
      maxres: "https://i.ytimg.com/vi/abc/maxresdefault.jpg",
      hq: "https://i.ytimg.com/vi/abc/hqdefault.jpg",
    });
  });
});

describe("youTubePlayerMessages", () => {
  it("명령과 listening은 JSON 문자열로, targetOrigin은 항상 nocookie로 보낸다", () => {
    const { iframe, contentWindow } = mountIframe();
    const postMessage = vi.spyOn(contentWindow, "postMessage").mockImplementation(() => {});
    postPlayerCommand(iframe, "pauseVideo");
    postListening(iframe, "p1");
    expect(postMessage).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
      NOCOOKIE,
    );
    expect(postMessage).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({ event: "listening", id: "p1", channel: "widget" }),
      NOCOOKIE,
    );
    iframe.remove();
  });

  it("onReady, onStateChange, infoDelivery.playerState를 해석한다", () => {
    const { iframe, contentWindow } = mountIframe();
    expect(parsePlayerMessage(message('{"event":"onReady"}', contentWindow), iframe)).toEqual({
      kind: "ready",
    });
    expect(
      parsePlayerMessage(message('{"event":"onStateChange","info":2}', contentWindow), iframe),
    ).toEqual({
      kind: "state",
      state: 2,
    });
    expect(
      parsePlayerMessage(
        message('{"event":"infoDelivery","info":{"playerState":1,"currentTime":3}}', contentWindow),
        iframe,
      ),
    ).toEqual({ kind: "state", state: 1 });
    expect(
      parsePlayerMessage(
        message('{"event":"infoDelivery","info":{"currentTime":3}}', contentWindow),
        iframe,
      ),
    ).toBeNull();
    iframe.remove();
  });

  it("다른 출처, 다른 창, iframe 없음, 깨진 JSON은 null", () => {
    const { iframe, contentWindow } = mountIframe();
    const valid = '{"event":"onReady"}';
    expect(
      parsePlayerMessage(message(valid, contentWindow, "https://www.youtube.com"), iframe),
    ).toBeNull();
    expect(parsePlayerMessage(message(valid, window), iframe)).toBeNull();
    expect(parsePlayerMessage(message(valid, contentWindow), null)).toBeNull();
    expect(parsePlayerMessage(message("{not json", contentWindow), iframe)).toBeNull();
    expect(parsePlayerMessage(message(42, contentWindow), iframe)).toBeNull();
    iframe.remove();
  });
});
