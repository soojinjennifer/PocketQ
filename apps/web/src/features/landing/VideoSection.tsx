import { YouTubeEmbed } from "../../shared/ui/video-embed/YouTubeEmbed";
import { VideoPlayIcon } from "./LandingIcons";
import { SectionHeader } from "./SectionHeader";
import { LANDING_SCROLL_MARGIN } from "./landingStyles";

/**
 * 영상 매핑(오케스트레이터 결정): 1번 사용 방법 = `vSsyDRtZmKw`, 2번 설치 = `2RgyXWjlH9I`.
 * Figma 레이어 이름은 두 프레임 모두 `2RgyXWjlH9I`지만 무시한다(§3.5, D-7).
 */
const LANDING_VIDEOS = [
  { id: "vSsyDRtZmKw", title: "수풀잉 사용 방법", caption: "수풀잉 사용 방법 · 1분 영상" },
  { id: "2RgyXWjlH9I", title: "수풀잉 설치", caption: "수풀잉 설치 영상" },
] as const;

/**
 * 밝은 inset 링 + 8px 안쪽 밝은 outline. 둘 사이에 어두운 패널 색이 띠처럼 남아 흰 베젤과 구별된다(검수 L-11).
 * 기반 클래스의 `outline-none`이 outline-style을 none으로 두므로 `outline-solid`로 다시 켠다.
 */
const VIDEO_FOCUS_RING =
  "focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-landing-label-on-deep focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-[-8px] focus-visible:outline-landing-label-on-deep";

/**
 * Video(`447:78`) — `brand/deep` 전체 폭 배경, 안쪽 최대 폭 1000. 프레임 외곽 p 10 / radius 30 / Video Frame 그림자,
 * 안쪽 16:9 패널 `brand/deeper` radius 22. Figma대로 단색 패널이고 YouTube 썸네일은 쓰지 않는다(검수 M-4) — 재생을 누르기
 * 전에는 YouTube로 가는 요청이 0건이다. 포커스 링은 어두운 패널 위에서 보이도록 `label/on-deep`(밝은 색)을 쓴다(검수 M-5).
 */
export function VideoSection() {
  return (
    <section
      id="video"
      aria-labelledby="video-title"
      className={`bg-landing-brand-deep ${LANDING_SCROLL_MARGIN}`}
    >
      <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-7 px-6 py-14 lg:py-[76px]">
        <SectionHeader
          titleId="video-title"
          align="center"
          tone="dark"
          eyebrow="WATCH · 1분"
          title="직접 보면 바로 알아요"
          subtitle="문제 입력 → 내 풀이 → 진단 → 이어풀기까지, 실제 화면으로."
        />
        {LANDING_VIDEOS.map((video) => (
          <div
            key={video.id}
            className="bg-bg-canvas rounded-landing-panel shadow-landing-video-frame p-1.5 md:p-2.5"
          >
            <YouTubeEmbed
              videoId={video.id}
              title={video.title}
              className="bg-landing-brand-deeper rounded-landing-video-inner"
              focusRingClassName={VIDEO_FOCUS_RING}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
              >
                <VideoPlayIcon className="size-14 md:size-[72px]" />
                <span className="text-landing-label-on-deep-secondary text-sm font-semibold">{video.caption}</span>
              </span>
            </YouTubeEmbed>
          </div>
        ))}
      </div>
    </section>
  );
}
