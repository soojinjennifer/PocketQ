import wordmarkUrl from "../../assets/landing/wordmark.png";
import { LANDING_CONTAINER } from "./landingStyles";

/**
 * Footer(`447:143`) — 상단 hairline, py 26, 양 끝 정렬. 푸터만 SF Pro(Figma 원본, D-9).
 * 개인정보처리방침·이용약관 페이지가 아직 없어 링크 없이 글자로만 둔다(D-19 결정 필요).
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
          <li>개인정보처리방침</li>
          <li>이용약관</li>
        </ul>
      </div>
    </footer>
  );
}
