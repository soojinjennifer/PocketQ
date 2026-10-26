import { startOAuthSignIn } from "../../features/auth/startOAuthSignIn";
import { CtaSection } from "../../features/landing/CtaSection";
import { DemoSection } from "../../features/landing/DemoSection";
import { HeroSection } from "../../features/landing/HeroSection";
import { HowSection } from "../../features/landing/HowSection";
import { InstallVideoSection } from "../../features/landing/InstallVideoSection";
import { LandingFooter } from "../../features/landing/LandingFooter";
import { LandingNav } from "../../features/landing/LandingNav";
import { VideoSection } from "../../features/landing/VideoSection";
import { WhySection } from "../../features/landing/WhySection";
import { YouTubePlaybackGroup } from "../../shared/ui/video-embed/YouTubePlaybackGroup";

/**
 * 랜딩 페이지(`/home.html`, Figma `Supuling Landing · Desktop 1440` `446:8`). 섹션 조립만 한다.
 * 영상 두 개는 `YouTubePlaybackGroup`으로 묶어 한 번에 하나만 재생한다.
 * 소셜 로그인은 `features/auth`의 순수 함수를 CTA에 주입한다(feature 간 직접 참조 금지, frontend.md §1).
 */
export function LandingPage() {
  return (
    <div className="bg-landing-bg-page text-landing-label-ink font-landing-sans min-h-dvh overflow-x-clip break-keep">
      <LandingNav />
      <YouTubePlaybackGroup>
        <main id="main" tabIndex={-1} className="outline-none">
          <HeroSection />
          <WhySection />
          <HowSection />
          <VideoSection />
          <DemoSection />
          <CtaSection onStartOAuth={startOAuthSignIn} />
          <InstallVideoSection />
        </main>
      </YouTubePlaybackGroup>
      <LandingFooter />
    </div>
  );
}
