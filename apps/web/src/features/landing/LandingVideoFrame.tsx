import { YouTubeEmbed } from "../../shared/ui/video-embed/YouTubeEmbed";
import { youTubeThumbnailUrls } from "../../shared/ui/video-embed/youTubeUrls";
import { VideoPlayIcon } from "./LandingIcons";

interface LandingVideoFrameProps {
  videoId: string;
  title: string;
  /** 썸네일 위 pill 캡션(장식, 버튼 라벨은 `title`로 만든다). */
  caption: string;
  /** 화면 가운데에 오면 음소거 자동 재생, 벗어나면 일시정지(D2-1). */
  autoplayOnView?: boolean;
}

/**
 * 썸네일 위 포커스 표시(D2-8, §14.2). 장식 span에 붙으므로 `group-focus-visible:`을 쓴다(§14.0).
 * 어두운 inset ring(`brand/deeper`)이 주 표시이고, 8px 안쪽 밝은 outline이 어두운 썸네일 위에서 보조한다.
 */
const VIDEO_FOCUS_RING =
  "group-focus-visible:ring-4 group-focus-visible:ring-inset group-focus-visible:ring-landing-brand-deeper group-focus-visible:outline-2 group-focus-visible:outline-solid group-focus-visible:outline-offset-[-8px] group-focus-visible:outline-landing-label-on-deep";

/**
 * Video 프레임(`447:78`) — 밝은 베젤(`bg/canvas` p 10 / radius 30 / Video Frame 그림자) 안의 16:9 패널(`brand/deeper`
 * radius 22). Round 2부터 YouTube 썸네일(maxres → hq → 패널 단색)을 보인다(오너 요청).
 * 재생 아이콘 둘레 ring과 캡션 pill(`brand/deeper` 80%)은 밝은 썸네일 위에서도 대비를 지킨다(§14.2 측정).
 */
export function LandingVideoFrame({
  videoId,
  title,
  caption,
  autoplayOnView = false,
}: LandingVideoFrameProps) {
  const thumbnails = youTubeThumbnailUrls(videoId);
  return (
    <div className="bg-bg-canvas rounded-landing-panel shadow-landing-video-frame p-1.5 md:p-2.5">
      <YouTubeEmbed
        videoId={videoId}
        title={title}
        thumbnailSrc={thumbnails.maxres}
        thumbnailFallbackSrc={thumbnails.hq}
        autoplayOnView={autoplayOnView}
        className="bg-landing-brand-deeper rounded-landing-video-inner"
        focusRingClassName={VIDEO_FOCUS_RING}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
        >
          <span className="ring-landing-brand-deeper/80 rounded-full ring-4">
            <VideoPlayIcon className="block size-14 md:size-[72px]" />
          </span>
          <span className="bg-landing-brand-deeper/80 text-landing-label-on-deep rounded-full px-3 py-1 text-sm font-semibold">
            {caption}
          </span>
        </span>
      </YouTubeEmbed>
    </div>
  );
}
