import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "social-kakao" | "social-google" | "primary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant: ButtonVariant;
  children: ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  "social-kakao": "bg-kakao-bg text-kakao-label",
  "social-google": "bg-bg-elevated border border-label-quaternary text-label-primary",
  primary: "bg-brand text-label-on-dark",
};

/**
 * Figma `Button/Login` 컴포넌트(fileKey `ltyPrCk8UT8DsB3tFuw7Sr`, node `35:22`) 실측 스타일.
 * 소셜 로그인/가입 버튼과 이메일 제출 버튼에서 공용으로 사용한다.
 */
export function Button({ variant, children, className, ...rest }: ButtonProps) {
  const variantClassName = VARIANT_STYLES[variant];
  const combinedClassName = className
    ? `${variantClassName} ${className}`
    : variantClassName;

  return (
    <button
      type="button"
      className={`w-full rounded-[14px] p-[14px] flex items-center justify-center text-[17px] font-semibold leading-[22px] disabled:opacity-50 ${combinedClassName}`}
      {...rest}
    >
      {children}
    </button>
  );
}
