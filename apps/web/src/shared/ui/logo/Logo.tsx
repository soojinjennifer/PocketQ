import logoSrc from "../../../assets/logo/PocketQLogo.png";

interface LogoProps {
  size?: "large" | "small";
}

const SIZE_PX: Record<NonNullable<LogoProps["size"]>, number> = {
  large: 76,
  small: 52,
};

const RADIUS_CLASS: Record<NonNullable<LogoProps["size"]>, string> = {
  large: "rounded-[18px]",
  small: "rounded-[10px]",
};

const OBJECT_FIT_CLASS: Record<NonNullable<LogoProps["size"]>, string> = {
  large: "object-cover",
  small: "object-contain",
};

/**
 * 포켓큐 로고 (Figma `get_design_context` 실측 스타일 그대로 적용).
 * `size="large"`(76px, 기본, `radius` 18px, `object-cover`) / `size="small"`(52px, `radius` 10px,
 * `object-contain`) variant를 지원한다 — 두 값 모두 Figma가 사이즈별로 다르게 지정해서 그대로
 * 따른다(현재 원본 이미지가 정사각형이라 시각적 차이는 없지만, 향후 비정사각 이미지로 바뀌어도
 * Figma와 어긋나지 않도록 미리 분기해둔다). 보더는 Figma 실측 `accent/cyan`(`border-accent-cyan`,
 * 1px)을 두 사이즈 모두 동일하게 적용한다.
 */
export function Logo({ size = "large" }: LogoProps) {
  const px = SIZE_PX[size];
  const radiusClass = RADIUS_CLASS[size];
  const objectFitClass = OBJECT_FIT_CLASS[size];

  return (
    <div
      className={`border-accent-cyan overflow-clip border border-solid shadow-[0px_2px_4px_0px_rgba(0,0,0,0.1)] ${radiusClass}`}
      style={{ width: px, height: px }}
    >
      <img
        src={logoSrc}
        alt="수풀잉 로고"
        className={`size-full ${objectFitClass} ${radiusClass}`}
      />
    </div>
  );
}
