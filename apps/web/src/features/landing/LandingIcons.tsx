/**
 * 랜딩 아이콘(Figma `3. Landing Page` SVG 에셋 A6~A11). 경로는 Figma 내보내기 그대로이고,
 * 하드코딩 색은 랜딩 토큰(`fill-*`/`stroke-*` 유틸리티)으로 바꿨다. 모두 장식용이라 `aria-hidden`이다.
 */

interface IconProps {
  className?: string;
}

/** A7 — 버튼 재생 아이콘 22(`1분 영상 보기`). */
export function PlaySmallIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" className={className}>
      <circle cx="11" cy="11" r="11" className="fill-landing-brand-mint" />
      <path d="M9 7.2V14.8L14.8 11L9 7.2Z" className="fill-landing-brand-deep" />
    </svg>
  );
}

/** A6 — 영상 패널 재생 원 72. */
export function VideoPlayIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" width="72" height="72" viewBox="0 0 72 72" className={className}>
      <circle cx="36" cy="36" r="36" className="fill-landing-label-on-deep" />
      <path d="M29 23.5V48.5L49 36L29 23.5Z" className="fill-landing-brand-deep" />
    </svg>
  );
}

/** A8 — Check Item Negative(X) 16. */
export function CheckNegativeIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M4.66667 4.66667L8 8M8 8L11.3333 11.3333M8 8L11.3333 4.66667M8 8L4.66667 11.3333"
        strokeWidth="2.13333"
        strokeLinecap="round"
        className="stroke-landing-status-error"
      />
    </svg>
  );
}

/** A9 — Check Item Positive(체크) 16. */
export function CheckPositiveIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className={className}>
      <path
        d="M3 8.33333L6.33333 11.6667L13 4.66667"
        strokeWidth="2.13333"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-landing-brand-mint"
      />
    </svg>
  );
}

/** A10 — Status Chip Success 26. */
export function ChipSuccessIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" fill="none" className={className}>
      <circle cx="13" cy="13" r="13" className="fill-landing-brand-tint" />
      <path
        d="M8.5 13.3L11.5 16.3L17.5 10"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="stroke-landing-brand-deep"
      />
    </svg>
  );
}

/** A11 — Status Chip Error 26(원 = `status/error-tint`, 느낌표 = `status/error`). */
export function ChipErrorIcon({ className }: IconProps) {
  return (
    <svg aria-hidden="true" width="26" height="26" viewBox="0 0 26 26" fill="none" className={className}>
      <circle cx="13" cy="13" r="13" className="fill-fill-tint-red" />
      <path d="M13 7.5V14" strokeWidth="2.6" strokeLinecap="round" className="stroke-landing-status-error" />
      <circle cx="13" cy="18.3" r="1.5" className="fill-landing-status-error" />
    </svg>
  );
}
