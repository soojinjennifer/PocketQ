import hero560Url from "../../assets/landing/hero-560.webp";
import hero1120Url from "../../assets/landing/hero-1120.webp";
import hero1600Url from "../../assets/landing/hero-1600.webp";
import { LandingBadge } from "./LandingBadge";
import { LandingButton } from "./LandingButton";
import { ChipErrorIcon, ChipSuccessIcon, PlaySmallIcon } from "./LandingIcons";
import {
  LANDING_CANVAS_SURFACE,
  LANDING_CONTAINER,
  LANDING_PRIMARY_SURFACE,
  LANDING_SCROLL_MARGIN,
} from "./landingStyles";

const HERO_CHECKS = ["설치 없이 브라우저에서 “홈화면 추가”로", "5초 소셜 로그인", "3번 터치로 진단까지"] as const;

/** Status Chip 공통(Figma `Landing/Status Chip` `444:72`): radius 18, px 14, py 10, gap 10, 14 SemiBold. */
const CHIP_BASE = "rounded-landing-chip shadow-landing-chip inline-flex items-center gap-2.5 text-sm font-semibold";
const CHIP_LIGHT = `${CHIP_BASE} bg-bg-elevated text-landing-brand-deep px-3.5 py-2.5`;
const CHIP_ACTION = `${CHIP_BASE} ${LANDING_PRIMARY_SURFACE} px-4 py-[11px]`;

/** Figma Lead의 줄 경계 — 1024 이상에서만 줄을 바꾸고(6줄), 그 아래 폭에서는 이어서 흘린다. */
const LEAD_BREAK = <br className="hidden lg:inline" />;

/**
 * Hero(`446:20`). 1024 이상은 2열(Figma), 그 아래는 카피 → 비주얼 1열로 쌓는다(§6.2 잠정).
 * 비주얼의 Status Chip은 Figma 절대 좌표(586×440 기준)를 퍼센트로 바꿨고, 768 미만에서는 이미지 아래 세로 목록이 된다.
 */
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
            className="text-landing-brand-deep m-0 text-4xl leading-[1.1] font-extrabold tracking-[-2px] md:text-5xl lg:text-6xl xl:text-[66px]"
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

        <div
          role="img"
          aria-label="수풀잉 풀이 진단 화면 예시: 2번째 줄까지 정확해요, 3번째 줄 부등호 방향 오류, 내 방법으로 계속"
          className="relative w-full min-w-0 lg:flex-1"
        >
          <div aria-hidden="true" className="relative md:aspect-[586/440]">
            <div
              className={`${LANDING_CANVAS_SURFACE} rounded-landing-media shadow-landing-raised overflow-hidden md:absolute md:top-[6%] md:right-0 md:h-[88%] md:w-[95.7%]`}
            >
              <img
                src={hero1120Url}
                srcSet={`${hero560Url} 560w, ${hero1120Url} 1120w, ${hero1600Url} 1600w`}
                sizes="(min-width: 1280px) 560px, (min-width: 1024px) 45vw, calc(100vw - 48px)"
                alt=""
                width={1120}
                height={782}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="block aspect-[1120/782] h-auto w-full object-cover md:h-full"
              />
            </div>
            <div className="mt-4 flex flex-col items-start gap-2 md:contents">
              <span className={`${CHIP_LIGHT} md:absolute md:top-[13.9%] md:left-0`}>
                <ChipSuccessIcon />
                2번째 줄까지 정확해요
              </span>
              <span className={`${CHIP_LIGHT} md:absolute md:top-[45%] md:right-[2%]`}>
                <ChipErrorIcon />
                3번째 줄: 부등호 방향 오류
              </span>
              <span className={`${CHIP_ACTION} md:absolute md:top-[85%] md:left-[7.5%]`}>
                내 방법으로 계속<span aria-hidden="true"> →</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
