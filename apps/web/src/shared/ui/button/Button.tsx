import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant =
  | "social-kakao"
  | "social-google"
  | "primary"
  | "pill-dark"
  | "pill-primary"
  | "pill-glass";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  "social-kakao": "bg-kakao-bg text-kakao-label",
  "social-google": "bg-bg-elevated border border-label-quaternary text-label-primary",
  primary: "bg-brand text-label-on-dark",
  "pill-dark": "bg-label-primary text-bg-elevated",
  "pill-primary": "bg-brand text-bg-elevated",
  "pill-glass": "bg-glass-fill border border-glass-border text-label-primary",
};

const PILL_VARIANTS: ReadonlySet<ButtonVariant> = new Set([
  "pill-dark",
  "pill-primary",
  "pill-glass",
]);

/** Figma `Button/Pill` `Style=Disable`(node `113:202`) — pill 계열 버튼의 disabled 공용 스타일. */
const PILL_DISABLED_STYLE = "bg-icon-default text-bg-elevated";

/** 포커스 키보드 사용자를 위한 공용 focus-visible 스타일. 브랜드 토큰(`--color-brand`)을 재사용한다. */
const FOCUS_STYLE = "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

const BASE_STYLE =
  `w-full rounded-[14px] p-[14px] flex items-center justify-center text-[17px] font-semibold leading-[22px] disabled:opacity-50 ${FOCUS_STYLE}`;
const PILL_BASE_STYLE =
  `inline-flex items-center justify-center rounded-full px-[26px] py-[11px] text-[15px] font-semibold leading-[20px] ${FOCUS_STYLE}`;

/**
 * Figma `Button/Login`(fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, node `35:22`)과 `Button/Pill`(node `35:31`)
 * 실측 스타일. 소셜 로그인/가입/이메일 제출 버튼과 `풀기`/`재촬영`/`사진 사용` 등 pill 버튼에서
 * 공용으로 사용한다. pill 계열은 `disabled`일 때 variant 색상 대신 Figma `Style=Disable` 스타일을
 * 적용한다(기존 소셜/`primary` 버튼의 `disabled:opacity-50` 동작은 그대로 유지).
 */
export function Button({ variant, children, className, disabled, ...rest }: ButtonProps) {
  const isPill = PILL_VARIANTS.has(variant);
  const variantClassName = isPill && disabled ? PILL_DISABLED_STYLE : VARIANT_STYLES[variant];
  const baseClassName = isPill ? PILL_BASE_STYLE : BASE_STYLE;
  const combinedClassName = className
    ? `${baseClassName} ${variantClassName} ${className}`
    : `${baseClassName} ${variantClassName}`;

  return (
    <button type="button" disabled={disabled} className={combinedClassName} {...rest}>
      {children}
    </button>
  );
}
