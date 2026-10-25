/**
 * 랜딩 섹션들이 함께 쓰는 Tailwind 조합. 같은 조합을 섹션마다 복사하지 않는다(frontend.md §2).
 * 수치는 `docs/LANDING_DESIGN.md`의 Figma 실측값이고, 1024 미만 폭의 축소값은 Tailwind 기본 스케일을 쓴 잠정값이다
 * (Figma 확정 대기, D-14).
 */

/** 키보드 포커스 링. 랜딩 그린 팔레트의 `brand/deep`을 쓴다(D-12 잠정). */
export const LANDING_FOCUS_RING =
  "outline-none focus-visible:ring-2 focus-visible:ring-landing-brand-deep focus-visible:ring-offset-2";

/**
 * 터치 히트 영역 44×44 보장(§7). 보이는 크기는 Figma 그대로 두고, 가운데 정렬한 `::after`로 클릭 영역만 넓힌다
 * (예: Nav `무료로 시작` 37px, Nav 링크 "영상" 24px 폭).
 */
export const LANDING_HIT_AREA =
  "relative after:absolute after:top-1/2 after:left-1/2 after:h-full after:min-h-11 after:w-full after:min-w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

/** `brand/deep` 면 + 흰 글자(Primary 버튼, Action Chip, 선택된 토글). */
export const LANDING_PRIMARY_SURFACE = "bg-landing-brand-deep text-label-on-dark";

/** 콘텐츠 컨테이너(Figma 1180, 좌우 padding 24). */
export const LANDING_CONTAINER = "mx-auto w-full max-w-[1180px] px-6";

/** Eyebrow(`Landing/Eyebrow` 13 Bold, 자간 1.5). 색은 섹션이 정한다. */
export const LANDING_EYEBROW = "text-[13px] font-bold tracking-[1.5px]";

/** 고정 Nav(64 + hairline 1)에 앵커 이동 시 제목이 가려지지 않게 하는 여백. */
export const LANDING_SCROLL_MARGIN = "scroll-mt-[65px]";

/** 카드 표면(`bg/canvas` + `border/edge`). 그림자·모서리는 카드마다 다르다. */
export const LANDING_CANVAS_SURFACE = "bg-bg-canvas border border-landing-border-edge";

/** 본문(`Landing/Body L` 17/1.65). */
export const LANDING_BODY_L = "text-base leading-[1.65] md:text-[17px]";
