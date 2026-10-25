import appIconUrl from "../../assets/landing/app-icon-120.webp";
import wordmarkUrl from "../../assets/landing/wordmark.png";
import { LandingButton } from "./LandingButton";
import { LANDING_CONTAINER, LANDING_FOCUS_RING, LANDING_HIT_AREA } from "./landingStyles";

const NAV_LINKS = [
  { href: "#how", label: "사용 방법" },
  { href: "#video", label: "영상" },
  { href: "#why", label: "왜 수풀잉?" },
] as const;

/**
 * Figma Nav(`446:9`) — 높이 64 + hairline, `bg/nav`(88%). 상단 고정(sticky)과 backdrop-blur는 D-10 잠정이다.
 * 767 이하에서는 앵커 3개를 숨기고 로고와 `무료로 시작`만 둔다(§6.2).
 */
export function LandingNav() {
  return (
    <header className="bg-landing-bg-nav border-landing-border-hairline sticky top-0 z-20 border-b backdrop-blur-md">
      <a
        href="#main"
        className={`bg-bg-elevated text-landing-brand-deep sr-only rounded-full px-4 py-2 text-sm font-semibold focus:not-sr-only focus:absolute focus:top-3 focus:left-3 ${LANDING_FOCUS_RING}`}
      >
        본문으로 건너뛰기
      </a>
      <div className={`${LANDING_CONTAINER} flex items-center justify-between gap-4 py-3`}>
        <a
          href="#top"
          aria-label="수풀잉 홈"
          className={`flex items-center gap-2.5 rounded-landing-icon ${LANDING_HIT_AREA} ${LANDING_FOCUS_RING}`}
        >
          <img src={appIconUrl} alt="" width={40} height={40} className="rounded-landing-icon size-10" />
          <img src={wordmarkUrl} alt="" width={68} height={26} className="h-[26px] w-auto" />
        </a>
        <nav aria-label="주요 메뉴" className="flex items-center gap-2 md:gap-[22px]">
          <ul className="m-0 hidden list-none items-center gap-[22px] p-0 md:flex">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={`text-landing-label-ink inline-flex items-center rounded-landing-icon-sm text-sm font-semibold ${LANDING_HIT_AREA} ${LANDING_FOCUS_RING}`}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <LandingButton as="a" href="#start" variant="primary-s">
            무료로 시작
          </LandingButton>
        </nav>
      </div>
    </header>
  );
}
