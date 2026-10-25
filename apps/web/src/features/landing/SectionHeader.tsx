import type { ReactNode } from "react";
import { LANDING_EYEBROW } from "./landingStyles";

type HeadingWeight = "bold" | "extrabold" | "black";

interface SectionHeaderProps {
  eyebrow: string;
  title: ReactNode;
  /** `id`를 주면 섹션의 `aria-labelledby`가 이 제목을 가리킬 수 있다. */
  titleId?: string;
  subtitle?: ReactNode;
  align?: "left" | "center";
  /** `dark`는 `brand/deep` 배경(Video 섹션) 위. */
  tone?: "light" | "dark";
  /**
   * Figma 원본 굵기 유지(D-9): Why = Bold, How = Black, Video·Demo = ExtraBold(`Landing/H2`).
   * @default "extrabold"
   */
  weight?: HeadingWeight;
  /** Why eyebrow만 16 SemiBold다(Figma 원본, §2.2). */
  eyebrowSize?: "default" | "large";
}

const WEIGHT_STYLES: Record<HeadingWeight, string> = {
  bold: "font-bold",
  extrabold: "font-extrabold",
  black: "font-black",
};

/**
 * Eyebrow + H2 + 부제 묶음(Why, How, Video, Demo 4회 반복 → 공통화, frontend.md §2).
 * Eyebrow 색은 대비 기준(4.5:1)을 맞추려고 밝은 배경에서 `brand/green` 대신 `brand/deep`을 쓴다(D-16, 오케스트레이터 결정).
 */
export function SectionHeader({
  eyebrow,
  title,
  titleId,
  subtitle,
  align = "left",
  tone = "light",
  weight = "extrabold",
  eyebrowSize = "default",
}: SectionHeaderProps) {
  const isDark = tone === "dark";
  const alignClass = align === "center" ? "items-center text-center" : "items-start text-left";
  const eyebrowClass =
    eyebrowSize === "large" ? "text-sm font-semibold tracking-[1.5px] md:text-base" : LANDING_EYEBROW;
  const eyebrowColor = isDark ? "text-landing-brand-mint" : "text-landing-brand-deep";
  const titleColor = isDark ? "text-landing-label-on-deep" : "text-landing-brand-deep";

  return (
    <div className={`flex flex-col gap-2.5 ${alignClass}`}>
      <p className={`${eyebrowClass} ${eyebrowColor} m-0`}>{eyebrow}</p>
      <h2
        id={titleId}
        className={`${titleColor} ${WEIGHT_STYLES[weight]} m-0 text-3xl leading-[1.25] tracking-[-1px] text-balance lg:text-[42px]`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p
          className={`m-0 text-base leading-[1.5] ${isDark ? "text-landing-label-on-deep-secondary" : "text-landing-label-ink"}`}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
