import wordmarkUrl from "../../assets/landing/wordmark.png";
import { LANDING_CONTAINER, LANDING_FOCUS_RING, LANDING_HIT_AREA } from "./landingStyles";

/** 법적 고지 페이지(Round 2 F). 오너가 `public/{privacy,terms}.html`로 올린다 — 공개 전 두 페이지가 있어야 한다. */
const LEGAL_LINKS = [
  { href: "/privacy.html", label: "개인정보처리방침" },
  { href: "/terms.html", label: "이용약관" },
] as const;

/**
 * Footer(`447:143`) — 상단 hairline, py 26, 양 끝 정렬. 푸터만 SF Pro(Figma 원본, D-9).
 * 개인정보처리방침·이용약관은 같은 탭에서 여는 정적 페이지 링크다(D-19 → Round 2 F). SW가 가로채지 않는다(vite.config).
 */
export function LandingFooter() {
  return (
    <footer className="border-landing-border-hairline font-landing-system border-t">
      <div
        className={`${LANDING_CONTAINER} text-landing-label-ink flex flex-col gap-3 py-[26px] text-[13px] leading-[18px] sm:flex-row sm:items-center sm:justify-between`}
      >
        <p className="m-0 flex items-center gap-2.5">
          <img src={wordmarkUrl} alt="수풀잉" width={47} height={18} loading="lazy" className="h-[18px] w-auto" />
          <span>· 수학 풀이 진단 튜터</span>
        </p>
        <ul className="m-0 flex list-none gap-[18px] p-0">
          {LEGAL_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className={`text-landing-label-ink -mx-1 inline-flex items-center rounded-landing-icon-sm px-1 ${LANDING_HIT_AREA} ${LANDING_FOCUS_RING}`}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
