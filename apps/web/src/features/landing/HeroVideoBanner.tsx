import { useEffect, useRef } from "react";
import chalkPosterUrl from "../../assets/landing/hero-chalk-poster.webp";
import chalkVideoUrl from "../../assets/landing/hero-chalk-720.mp4";
import { usePrefersReducedMotion } from "../../shared/lib/dom/usePrefersReducedMotion";
import { LANDING_SCROLL_MARGIN } from "./landingStyles";

/**
 * Hero 위 전체 폭 칠판 홍보 영상(Figma `446:20`, 1440×786 — 오너 제공 20초 영상, 2026-11-01).
 * 여백·모서리 없이 화면 폭을 채우고, Figma 비율(1440:786)에 맞춰 `object-cover`로 양옆을 약간 자른다.
 * 자동 재생은 음소거여야 브라우저가 허용하고, React의 `muted` prop은 속성으로 반영되지 않는 경우가 있어 ref로 직접 켠다.
 * 동작 줄이기 사용자는 자동 재생하지 않고 포스터(완성된 제목 장면)에서 멈춰 둔다.
 * 5초 넘게 움직이므로 정지 수단(WCAG 2.2.2)으로 기본 컨트롤을 둔다(소리 켜기도 여기서).
 */
export function HeroVideoBanner() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    video.muted = true;
    if (prefersReducedMotion) {
      video.pause();
      return;
    }
    // 저전력 모드 등에서 자동 재생이 거부되면 포스터와 컨트롤이 남는다. 예전 Safari는 Promise 대신 undefined를 돌려준다.
    Promise.resolve(video.play()).catch(() => {});
  }, [prefersReducedMotion]);

  return (
    <section id="top" aria-label="수풀잉 소개 영상" className={`bg-landing-brand-deep ${LANDING_SCROLL_MARGIN}`}>
      <video
        ref={videoRef}
        src={chalkVideoUrl}
        poster={chalkPosterUrl}
        width={1280}
        height={720}
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label="수풀잉 홍보 영상: 학교에서는 알겠다는데, 혼자 풀면 막히나요? 내 풀이를 AI가 한 줄씩 읽고 막힌 곳부터 이어 풀어요."
        className="block aspect-video h-auto w-full object-cover lg:aspect-[1440/786]"
      />
    </section>
  );
}
