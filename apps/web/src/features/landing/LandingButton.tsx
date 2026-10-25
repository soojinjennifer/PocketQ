import type { MouseEventHandler, ReactNode } from "react";
import { LANDING_FOCUS_RING, LANDING_HIT_AREA, LANDING_PRIMARY_SURFACE } from "./landingStyles";

/**
 * Figma `Landing/Button`(`444:36`) variant. 앱 `shared/ui/button`의 블루그레이 variant와 색·크기·그림자가 달라
 * 랜딩 전용으로 둔다(D-13 잠정).
 */
type LandingButtonVariant =
  | "primary-s"
  | "primary-m"
  | "primary-l"
  | "primary-block"
  | "secondary-m"
  | "secondary-l"
  | "secondary-block"
  | "kakao-m";

/** 라벨 줄높이는 Figma `normal`(Landing/Label·Button 스타일). */
const BASE = "inline-flex items-center justify-center gap-2 rounded-full leading-normal whitespace-nowrap";

const VARIANT_STYLES: Record<LandingButtonVariant, string> = {
  "primary-s":
    `${LANDING_PRIMARY_SURFACE} shadow-landing-rest px-[18px] py-2.5 text-sm font-semibold`,
  "primary-m":
    `${LANDING_PRIMARY_SURFACE} shadow-landing-button-deep px-[26px] py-3 text-[15px] font-bold`,
  "primary-l":
    `${LANDING_PRIMARY_SURFACE} shadow-landing-button-deep px-[30px] py-4 text-[17px] font-bold`,
  "primary-block":
    `${LANDING_PRIMARY_SURFACE} shadow-landing-button-deep w-full px-4 py-3 text-sm font-bold`,
  "secondary-m":
    "bg-bg-canvas text-landing-brand-deep border border-landing-border-edge shadow-landing-chip px-[26px] py-[15px] text-base font-semibold",
  "secondary-l":
    "bg-bg-canvas text-landing-brand-deep border border-landing-border-edge shadow-landing-rest px-6 py-4 text-base font-semibold",
  "secondary-block":
    "bg-bg-elevated text-landing-brand-deep border border-landing-border-edge shadow-landing-rest w-full px-4 py-3 text-sm font-bold",
  "kakao-m":
    "bg-kakao-bg text-kakao-label shadow-landing-chip px-[26px] py-[15px] text-base font-bold",
};

interface CommonProps {
  variant: LandingButtonVariant;
  children: ReactNode;
  className?: string;
}

type LandingButtonProps = CommonProps &
  (
    | { as: "a"; href: string; onClick?: MouseEventHandler<HTMLAnchorElement> }
    | {
        as: "button";
        onClick: MouseEventHandler<HTMLButtonElement>;
        disabled?: boolean;
        "aria-busy"?: boolean;
      }
    /** 일러스트(Step 카드, Demo 카드) — 버튼처럼 보이지만 상호작용하지 않는다(탭 순서에 들어가지 않음, §7). */
    | { as: "span" }
  );

export function LandingButton(props: LandingButtonProps) {
  const classes = [BASE, VARIANT_STYLES[props.variant], props.className].filter(Boolean).join(" ");

  if (props.as === "a") {
    return (
      <a href={props.href} onClick={props.onClick} className={`${classes} ${LANDING_HIT_AREA} ${LANDING_FOCUS_RING}`}>
        {props.children}
      </a>
    );
  }
  if (props.as === "button") {
    return (
      <button
        type="button"
        onClick={props.onClick}
        disabled={props.disabled}
        aria-busy={props["aria-busy"]}
        className={`${classes} ${LANDING_HIT_AREA} cursor-pointer disabled:cursor-default disabled:opacity-50 ${LANDING_FOCUS_RING}`}
      >
        {props.children}
      </button>
    );
  }
  return <span className={classes}>{props.children}</span>;
}
