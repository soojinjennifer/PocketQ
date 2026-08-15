import type { ReactNode } from "react";

type BadgeVariant = "tint-blue" | "tint-green";
/** `"pill"`(기본): 카테고리/"새 문제"(Figma `39:33`/`39:35`) — 완전 라운드, 13px/590.
 *  `"chip"`: "인식됨"(Figma `39:39`) — 사각 chip(`rounded-[6px]`), 11px/Regular. */
type BadgeSize = "pill" | "chip";

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
  "tint-blue": "bg-fill-tint-brand text-brand",
  "tint-green": "bg-fill-tint-green text-accent-green",
};

const SIZE_STYLES: Record<BadgeSize, string> = {
  pill: "rounded-full px-3 py-1 text-[13px] font-[590]",
  chip: "rounded-[6px] px-[7px] py-[3px] text-[11px] font-normal",
};

const BASE_STYLE = "inline-flex items-center justify-center leading-4";

/**
 * Figma 배지 공통 컴포넌트 — Result Panel의 카테고리/"새 문제"/"인식됨" 배지에서 재사용한다
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
