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
  "primary-s": `${LANDING_PRIMARY_SURFACE} px-[18px] py-2.5 text-sm font-semibold`,
  "primary-m": `${LANDING_PRIMARY_SURFACE} px-[26px] py-3 text-[15px] font-bold`,
  "primary-l": `${LANDING_PRIMARY_SURFACE} px-[30px] py-4 text-[17px] font-bold`,
  "primary-block": `${LANDING_PRIMARY_SURFACE} w-full px-4 py-3 text-sm font-bold`,
  "secondary-m":
    "bg-bg-canvas text-landing-brand-deep border border-landing-border-edge px-[26px] py-[15px] text-base font-semibold",
  "secondary-l":
    "bg-bg-canvas text-landing-brand-deep border border-landing-border-edge px-6 py-4 text-base font-semibold",
  "secondary-block":
    "bg-bg-elevated text-landing-brand-deep border border-landing-border-edge w-full px-4 py-3 text-sm font-bold",
  "kakao-m": "bg-kakao-bg text-kakao-label px-[26px] py-[15px] text-base font-bold",
};

/**
 * 눌리는 버튼(`a`·`button`)에만 주는 입체 그림자. 일러스트(`span`)는 눌릴 것처럼 보이지 않도록 그림자 없이 평평하게
 * 그린다(Figma 2026-11-11 갱신 — How Step 3 `봐 주세요`, Demo `Choice` 버튼의 effect 제거).
 */
const INTERACTIVE_SHADOW: Record<LandingButtonVariant, string> = {
  "primary-s": "shadow-landing-rest",
  "primary-m": "shadow-landing-button-deep",
  "primary-l": "shadow-landing-button-deep",
  "primary-block": "shadow-landing-button-deep",
  "secondary-m": "shadow-landing-chip",
  "secondary-l": "shadow-landing-rest",
  "secondary-block": "shadow-landing-rest",
  "kakao-m": "shadow-landing-chip",
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
    /** 일러스트(Step 카드, Demo 카드) — 상호작용하지 않는다(탭 순서에 들어가지 않음, §7). 그림자 없이 평평하다. */
    | { as: "span" }
  );

export function LandingButton(props: LandingButtonProps) {
  const isIllustration = props.as === "span";
  const classes = [
    BASE,
    VARIANT_STYLES[props.variant],
    isIllustration ? null : INTERACTIVE_SHADOW[props.variant],
    props.className,
  ]
    .filter(Boolean)
    .join(" ");

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
