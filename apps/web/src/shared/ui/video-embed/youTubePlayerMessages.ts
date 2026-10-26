import { YOUTUBE_NOCOOKIE_ORIGIN } from "./youTubeUrls";

/**
 * YouTube iframe 플레이어와의 postMessage 채널(IFrame Player API가 내부에서 쓰는 형식). 공식 문서화된 계약이 아니므로
 * 실패해도 조용히 무시한다 — 최악의 경우 일시정지 한 번을 놓칠 뿐이다.
 * 보내는 쪽 targetOrigin은 항상 youtube-nocookie이고, 받는 쪽은 origin과 source를 모두 확인한다.
 */

export type YouTubePlayerCommand = "playVideo" | "pauseVideo";

/** YouTube 플레이어 상태 값(-1 시작 전, 0 종료, 1 재생, 2 일시정지, 3 버퍼링, 5 대기). */
export const YOUTUBE_PLAYER_STATE = { playing: 1, paused: 2 } as const;

export type YouTubePlayerMessage = { kind: "ready" } | { kind: "state"; state: number };

function post(iframe: HTMLIFrameElement, payload: Record<string, unknown>): void {
  iframe.contentWindow?.postMessage(JSON.stringify(payload), YOUTUBE_NOCOOKIE_ORIGIN);
}

export function postPlayerCommand(iframe: HTMLIFrameElement, func: YouTubePlayerCommand): void {
  post(iframe, { event: "command", func, args: [] });
}

/** iframe load 직후 보낸다. 이 신호를 받아야 플레이어가 onReady·상태 변화를 부모에게 알려 준다. */
export function postListening(iframe: HTMLIFrameElement, id: string): void {
  post(iframe, { event: "listening", id, channel: "widget" });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readPayload(data: unknown): Record<string, unknown> | null {
  if (typeof data !== "string") {
    return isRecord(data) ? data : null;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * 이 iframe에서 온 플레이어 메시지만 해석한다. 다른 출처·다른 창(같은 출처의 다른 영상 포함)의 메시지와
 * 해석할 수 없는 메시지는 `null`이다.
 */
export function parsePlayerMessage(
  event: MessageEvent,
  iframe: HTMLIFrameElement | null,
): YouTubePlayerMessage | null {
  if (
    event.origin !== YOUTUBE_NOCOOKIE_ORIGIN ||
    !iframe ||
    event.source !== iframe.contentWindow
  ) {
    return null;
  }
  const payload = readPayload(event.data);
  if (!payload) {
    return null;
  }
  if (payload.event === "onReady") {
    return { kind: "ready" };
  }
  if (payload.event === "onStateChange" && typeof payload.info === "number") {
    return { kind: "state", state: payload.info };
  }
  if (
    (payload.event === "infoDelivery" || payload.event === "initialDelivery") &&
    isRecord(payload.info) &&
    typeof payload.info.playerState === "number"
  ) {
    return { kind: "state", state: payload.info.playerState };
  }
  return null;
}
