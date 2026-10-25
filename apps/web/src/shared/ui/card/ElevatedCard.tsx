import type { HTMLAttributes, ReactNode } from "react";

type ElevatedCardTag = "div" | "section" | "article";

interface ElevatedCardProps extends Omit<HTMLAttributes<HTMLElement>, "className" | "children"> {
  /** 루트 태그. 기본 `div`(기존 사용처와 같은 태그). */
  as?: ElevatedCardTag;
  /**
   * **레이아웃 전용**(`flex`·`flex-col`·`gap-*`·`items-*` 등). 카드 표면(배경·모서리·여백·그림자)을 바꾸는 클래스는 넣지
   * 않는다 — 표면은 `Elevation/Card` 하나로 고정이다(design P3-2, `docs/COMPONENT_MAP.md`). 표면 클래스 뒤에 붙는다.
   */
  className?: string;
  children?: ReactNode;
}

/**
 * Figma `Elevation/Card` 표면 — 흰 카드 배경 + 14px 모서리 + 16px 안쪽 여백 + 카드 그림자.
 * 결과 패널·WORK/DIAG/RESUME 카드·그림 카드가 공유한다(`docs/FIGURE_DESIGN.md` §17.10, D-6).
 * 값은 이전 `ELEVATED_CARD_STYLE` 상수와 같다(시각 변화 0 — 클래스 토큰 집합 동일).
 */
export const ELEVATED_CARD_SURFACE =
  "bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]";

export function ElevatedCard({ as: Tag = "div", className, children, ...rest }: ElevatedCardProps) {
  return (
    <Tag className={className ? `${ELEVATED_CARD_SURFACE} ${className}` : ELEVATED_CARD_SURFACE} {...rest}>
      {children}
    </Tag>
  );
}
