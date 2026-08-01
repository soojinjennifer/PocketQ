import logoSrc from "../../../assets/logo/WhyMathLogo.png";

interface LogoProps {
  size?: "large" | "small";
}

const SIZE_PX: Record<NonNullable<LogoProps["size"]>, number> = {
  large: 76,
  small: 52,
};

/**
 * 왜수학 로고 (Figma `get_design_context` 실측 스타일 그대로 적용).
 * `size="large"`(76px, 기본) / `size="small"`(52px) variant를 지원한다.
 */
export function Logo({ size = "large" }: LogoProps) {
  const px = SIZE_PX[size];

  return (
    <div
      className="overflow-clip rounded-[18px] shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)]"
      style={{ width: px, height: px }}
    >
      <img src={logoSrc} alt="왜수학 로고" className="size-full rounded-[18px] object-cover" />
    </div>
  );
}
