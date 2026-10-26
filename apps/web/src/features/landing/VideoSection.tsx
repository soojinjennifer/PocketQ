import { LandingVideoFrame } from "./LandingVideoFrame";
import { SectionHeader } from "./SectionHeader";
import { LANDING_DARK_BAND_INNER, LANDING_SCROLL_MARGIN } from "./landingStyles";

/**
 * Video(`447:78`) — `brand/deep` 전체 폭 배경. Round 2부터 사용 방법 영상(`vSsyDRtZmKw`) 하나만 두고, 설치 영상은
 * 페이지 아래 Install 섹션으로 옮겼다(오너 요청). 화면 가운데에 오면 음소거로 자동 재생한다(D2-1).
 */
export function VideoSection() {
  return (
    <section
      id="video"
      aria-labelledby="video-title"
      className={`bg-landing-brand-deep ${LANDING_SCROLL_MARGIN}`}
    >
      <div className={LANDING_DARK_BAND_INNER}>
        <SectionHeader
          titleId="video-title"
          align="center"
          tone="dark"
          eyebrow="WATCH · 1분"
          title="직접 보면 바로 알아요"
          subtitle="문제 입력 → 내 풀이 → 진단 → 이어풀기까지, 실제 화면으로."
        />
        <LandingVideoFrame
          videoId="vSsyDRtZmKw"
          title="수풀잉 사용 방법"
          caption="수풀잉 사용 방법 · 1분 영상"
          autoplayOnView
        />
      </div>
    </section>
  );
}
