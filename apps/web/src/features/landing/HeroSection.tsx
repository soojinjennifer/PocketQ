import { useEffect, useRef } from "react";
import heroAdPosterUrl from "../../assets/landing/hero-ad-poster.webp";
import heroAdVideoUrl from "../../assets/landing/hero-ad-720.mp4";
import { usePrefersReducedMotion } from "../../shared/lib/dom/usePrefersReducedMotion";
import { LandingBadge } from "./LandingBadge";
import { LandingButton } from "./LandingButton";
import { PlaySmallIcon } from "./LandingIcons";
import { LANDING_CANVAS_SURFACE, LANDING_CONTAINER, LANDING_SCROLL_MARGIN } from "./landingStyles";

const HERO_CHECKS = ["설치 없이 브라우저에서 “홈화면 추가”로", "5초 소셜 로그인", "3번 터치로 진단까지"] as const;

/** Figma Lead의 줄 경계 — 1024 이상에서만 줄을 바꾸고(6줄), 그 아래 폭에서는 이어서 흘린다. */
const LEAD_BREAK = <br className="hidden lg:inline" />;

/**
 * Hero 오른쪽 홍보 영상(15초, 16:9, 오너 제공 2026-11-01 — Figma의 스크린샷 + Status Chip 3개를 대체).
 * 영상 안에 제목·단계 설명이 들어 있어 Chip은 겹치지 않도록 뺐다. 자동 재생은 음소거여야 브라우저가 허용하고,
 * React의 `muted` prop은 속성으로 반영되지 않는 경우가 있어 ref로 직접 켠다. 동작 줄이기 사용자는 자동 재생하지 않고
 * 포스터에서 멈춰 둔다. 5초 넘게 움직이므로 정지 수단(WCAG 2.2.2)으로 기본 컨트롤을 둔다(소리 켜기도 여기서).
 */
function HeroVideo() {
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
    <div
      className={`${LANDING_CANVAS_SURFACE} rounded-landing-media shadow-landing-raised relative w-full min-w-0 overflow-hidden lg:flex-1`}
    >
      <video
        ref={videoRef}
        src={heroAdVideoUrl}
        poster={heroAdPosterUrl}
        width={1280}
        height={720}
        muted
        loop
        playsInline
        controls
        preload="metadata"
        aria-label="수풀잉 홍보 영상: 문제 입력, 내 풀이, AI 진단, 막힌 곳부터 이어 풀기"
        className="block aspect-video h-auto w-full object-cover"
      />
    </div>
  );
}

/** Hero(`446:20`). 1024 이상은 2열(Figma), 그 아래는 카피 → 영상 1열로 쌓는다(§6.2 잠정). */
export function HeroSection() {
  return (
    <section id="top" aria-labelledby="hero-title" className={LANDING_SCROLL_MARGIN}>
      <div
        className={`${LANDING_CONTAINER} flex flex-col gap-10 pt-10 pb-10 lg:flex-row lg:items-center lg:gap-2.5 lg:pt-16`}
      >
        <div className="flex min-w-0 flex-col items-start gap-[22px] lg:max-w-[546px] lg:flex-1">
          <LandingBadge variant="tint-l">중1~고3 · Tablet Pencil</LandingBadge>
          <h1
            id="hero-title"
            className="text-landing-brand-deep m-0 text-4xl leading-[1.1] font-extrabold tracking-[-2px] md:text-5xl lg:text-6xl"
          >
            학교에서는 알겠다는데,
            <br />
            혼자 풀면 막히나요?
          </h1>
          <p className="text-landing-label-ink m-0 max-w-[520px] text-lg leading-[1.6] text-pretty lg:max-w-[546px] lg:text-xl">
            학원이나 학교, 수학 선생님에게 다 물어보지 못했던 것들,{" "}
            {LEAD_BREAK}
            나는 열심히 푸는데, 어디가 잘 못 되었을까{" "}
            {LEAD_BREAK}
            누가 알려줬으면 좋겠었죠?{" "}
            {LEAD_BREAK}
            <strong className="font-bold">이제 AI가 내가 쓴 풀이</strong>를 하나하나 읽고, 어디까지 맞았는지,{" "}
            {LEAD_BREAK}
            어디서 왜 막혔는지 알려줘요.{" "}
            {LEAD_BREAK}
            <strong className="font-bold">내 방법 그대로</strong> 이어서 풀 수 있게, 혹은 또 다른 방법으로 더 잘
            풀게!
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:gap-[22px]">
            <LandingButton as="a" href="#start" variant="primary-l">
              지금 바로 풀어보기<span aria-hidden="true"> →</span>
            </LandingButton>
            <LandingButton as="a" href="#video" variant="secondary-l">
              <PlaySmallIcon />
              1분 영상 보기
            </LandingButton>
          </div>
          <ul className="text-landing-label-ink m-0 flex list-none flex-col gap-2 p-0 text-sm sm:flex-row sm:flex-wrap sm:gap-x-[18px]">
            {HERO_CHECKS.map((item) => (
              <li key={item}>
                <span aria-hidden="true">✓ </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <HeroVideo />
      </div>
    </section>
  );
}
