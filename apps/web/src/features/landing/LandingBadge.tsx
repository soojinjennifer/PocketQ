import type { ReactNode } from "react";

/**
 * Figma `Landing/Badge`(`444:49`) — 정적 표시용(상호작용 없음). 앱 `shared/ui/badge`는 블루그레이 톤이라
 * 그린 팔레트(Tint/Outline/Error)를 랜딩 전용으로 둔다(D-13 잠정). 크기 수치는 `docs/LANDING_DESIGN.md` §2.2·§2.3.
 */
type LandingBadgeVariant = "tint-l" | "tint-m" | "tint-s" | "tag" | "error-s" | "outline-l";

const VARIANT_STYLES: Record<LandingBadgeVariant, string> = {
  "tint-l": "rounded-full bg-landing-brand-tint text-landing-brand-deep px-3 py-[7px] text-[13px]",
  "tint-m": "rounded-full bg-landing-brand-tint text-landing-brand-deep px-2.5 py-[5px] text-xs",
  "tint-s": "rounded-full bg-landing-brand-tint text-landing-brand-deep px-[9px] py-0.5 text-[11px]",
  tag: "rounded-landing-icon-sm bg-landing-brand-tint text-landing-brand-deep px-[9px] py-[3px] text-[11px]",
  "error-s": "rounded-full bg-fill-tint-red text-landing-status-error px-[9px] py-0.5 text-[11px]",
  "outline-l":
    "rounded-full bg-bg-canvas border border-landing-border-edge text-landing-label-ink px-3 py-[7px] text-sm font-semibold",
};

interface LandingBadgeProps {
  variant: LandingBadgeVariant;
  children: ReactNode;
  className?: string;
}

export function LandingBadge({ variant, children, className }: LandingBadgeProps) {
  const weight = variant === "outline-l" ? "" : "font-bold";
  const classes = ["inline-flex items-center leading-none", weight, VARIANT_STYLES[variant], className]
    .filter(Boolean)
    .join(" ");
  return <span className={classes}>{children}</span>;
}
