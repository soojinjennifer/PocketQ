import type { ReactNode } from "react";

/** `"outline"`(신규, Figma `174:614` 제안 질문 pill) — 배경 없음, `border-brand` 보더/텍스트.
 *  `"tint-blue-flat"`(신규, Figma `4 · MyPage` History Row 개념 태그 chip `36:2`) — `tint-blue`와
 *  같은 톤이지만 **보더가 없다**. `tint-blue`는 2026-08-16 Figma 재실측으로 보더가 추가됐고 여러
 *  화면이 이미 그 모습을 쓰고 있어 수정하지 않고, 보더 없는 MyPage 실측값을 별도 variant로 추가했다. */
type BadgeVariant = "tint-blue" | "tint-blue-flat" | "tint-green" | "outline";
/** `"pill"`(기본): 카테고리/"새 문제"(Figma `39:33`/`39:35`) — 완전 라운드, 13px/590.
 *  `"chip"`: "인식됨"(Figma `39:39`) — 사각 chip(`rounded-[6px]`), 11px/Regular.
 *  `"tag"`(신규, Figma `174:618~625` 해시태그 pill): 완전 라운드, `px-[11px] py-[5px]`,
 *  12px/590(Caption 1 Semibold).
 *  `"footnote"`(신규, Figma `174:614` 제안 질문 pill): 완전 라운드, `px-[14px] py-[7px]`,
 *  13px/590(Footnote Semibold).
 *  `"tag-sm"`(신규, Figma `4 · MyPage` History Row 개념 태그 chip): 완전 라운드,
 *  `px-[10px] py-[2px]`, 12px/590 — `tag`보다 좌우/상하 여백이 좁다. */
type BadgeSize = "pill" | "chip" | "tag" | "footnote" | "tag-sm";

interface BadgeProps {
  variant: BadgeVariant;
  /** @default "pill" */
  size?: BadgeSize;
  children: ReactNode;
  /** 전달하면 클릭 가능한 배지(`<button>`)로, 생략하면 정적 표시용(`<span>`)으로 렌더링한다. */
  onClick?: () => void;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  // design-agent Figma 재실측 결과 `tint-blue`(카테고리/"새 문제"/해시태그 pill 공용 톤)도 원래
  // 보더가 있어야 했다(2026-08-16 오너 확인) — 기존 사용처(ResultPanel 카테고리/"새 문제" 배지,
  // 해시태그 pill)에 시각 변화가 생기는 것은 의도된 것이다.
  "tint-blue": "bg-fill-tint-brand text-brand border border-brand",
  // Figma `4 · MyPage` History Row 개념 태그 chip 실측 — 같은 톤이지만 보더가 없다(위 타입 주석 참고).
  "tint-blue-flat": "bg-fill-tint-brand text-brand",
  "tint-green": "bg-fill-tint-green text-accent-green",
  outline: "border border-brand text-brand",
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  pill: "rounded-full px-3 py-1 text-[13px] font-[590]",
  chip: "rounded-[6px] px-[7px] py-[3px] text-[11px] font-normal",
  tag: "rounded-full px-[11px] py-[5px] text-[12px] font-[590]",
  // Figma `174:614`(제안 질문 pill) 실측 line-height는 18px인데, BASE_STYLE의 `leading-4`(16px)를
  // 그대로 두면 2px 작게 렌더링된다(design-agent 사후검수 발견, 2026-08-16) — 명시적으로 오버라이드.
  footnote: "rounded-full px-[14px] py-[7px] text-[13px] leading-[18px] font-[590]",
  "tag-sm": "rounded-full px-[10px] py-[2px] text-[12px] font-[590]",
};

const BASE_STYLE = "inline-flex items-center justify-center leading-4";

/**
 * Figma 배지 공통 컴포넌트 — Result Panel의 카테고리/"새 문제"/"인식됨" 배지, 후속 질문(채팅)의
 * 제안 질문 pill(`outline`/`footnote`)·해시태그 pill(`tint-blue`/`tag`)에서 재사용한다
 * (`docs/COMPONENT_MAP.md`에는 아직 별도 항목이 없어 이번에 신규로 `shared/ui`에 추가했다).
 * `onClick`이 있으면 `Button`처럼 상호작용 가능한 요소로, 없으면 순수 표시용 `span`으로 렌더링해서
 * "인식됨"처럼 비상호작용 배지에 불필요한 버튼 시맨틱이 붙지 않게 한다.
 */
export function Badge({ variant, size = "pill", children, onClick, className }: BadgeProps) {
  const combinedClassName = className
    ? `${BASE_STYLE} ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]} ${className}`
    : `${BASE_STYLE} ${SIZE_STYLES[size]} ${VARIANT_STYLES[variant]}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={combinedClassName}>
        {children}
      </button>
    );
  }

  return <span className={combinedClassName}>{children}</span>;
}
