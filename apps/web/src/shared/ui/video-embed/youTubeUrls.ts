/** iframe과 postMessage가 오가는 유일한 출처. 메시지 targetOrigin과 수신 검사에 같이 쓴다(`*` 금지). */
export const YOUTUBE_NOCOOKIE_ORIGIN = "https://www.youtube-nocookie.com";

interface EmbedSrcOptions {
  /** 자동 재생(스크롤 진입)은 브라우저 정책상 음소거로만 시작할 수 있다. 사용자가 누른 재생은 소리를 켠다. */
  muted: boolean;
  /** 임베드한 페이지의 origin. `enablejsapi`가 postMessage 대상을 검증할 때 쓴다. */
  origin: string;
}

/**
 * youtube-nocookie iframe 주소. `enablejsapi=1`이라 부모 페이지가 postMessage로 재생·일시정지를 보낼 수 있다.
 * 자동 재생 여부와 무관하게 `autoplay=1`이다 — iframe은 재생하려는 순간에만 만든다(facade).
 */
export function buildYouTubeEmbedSrc(videoId: string, { muted, origin }: EmbedSrcOptions): string {
  const params = [
    "autoplay=1",
    "rel=0",
    "playsinline=1",
    "enablejsapi=1",
    `origin=${encodeURIComponent(origin)}`,
  ];
  if (muted) {
    params.push("mute=1");
  }
  return `${YOUTUBE_NOCOOKIE_ORIGIN}/embed/${encodeURIComponent(videoId)}?${params.join("&")}`;
}

/**
 * YouTube 썸네일 주소. `maxres`(1280×720)는 영상에 따라 없을 수 있어(120×90 자리표시 이미지가 온다)
 * `hq`(480×360, 항상 있음)를 대체로 쓴다.
 */
export function youTubeThumbnailUrls(videoId: string): { maxres: string; hq: string } {
  const base = `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}`;
  return { maxres: `${base}/maxresdefault.jpg`, hq: `${base}/hqdefault.jpg` };
}
