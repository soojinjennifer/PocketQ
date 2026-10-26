import { LandingVideoFrame } from "./LandingVideoFrame";
import { SectionHeader } from "./SectionHeader";
import { LANDING_DARK_BAND_INNER, LANDING_SCROLL_MARGIN } from "./landingStyles";

/**
 * Install(Round 2 B, §14.1) — Figma 프레임이 없어 Video 섹션 셸을 그대로 쓴다. CTA 다음, Footer 앞.
 * 페이지 맨 아래라 820×1180 등에서 화면 가운데까지 올라오지 못하므로 90% 이상 보이면 자동 재생한다(D2-1).
 * Nav에는 항목을 두지 않는다(D2-10).
 */
export function InstallVideoSection() {
  return (
    <section
      id="install"
      aria-labelledby="install-title"
      className={`bg-landing-brand-deep ${LANDING_SCROLL_MARGIN}`}
    >
      <div className={LANDING_DARK_BAND_INNER}>
        <SectionHeader
          titleId="install-title"
          align="center"
          tone="dark"
          eyebrow="INSTALL"
          title="홈 화면에 추가하는 방법"
          subtitle="설치 없이 브라우저에서 홈 화면에 추가하면 앱처럼 열려요."
        />
        <LandingVideoFrame
          videoId="2RgyXWjlH9I"
          title="수풀잉 설치"
          caption="수풀잉 설치 영상"
          autoplayOnView
        />
      </div>
    </section>
  );
}
