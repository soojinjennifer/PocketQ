import type { MouseEvent } from "react";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 스크린리더 전용 라벨. 화면에 별도 텍스트 라벨이 없는 아이콘형 체크박스라 필수로 받는다. */
  "aria-label": string;
  /** 부모 요소(예: 클릭 가능한 행)로 클릭이 전파되지 않게 막고 싶을 때 추가로 넘긴다. */
  onClick?: (event: MouseEvent<HTMLInputElement>) => void;
  className?: string;
}

/**
 * 마이페이지 개선 3번(History Row 일괄 삭제) 전용 신규 공용 체크박스.
 * Figma(`40:34` "MyPage/Nonselect", `279:1176` "MyPage/Selected", fileKey `ltyPrCk8UT8DsB3tFuw7Sr`)
 * 실측 크기 24×24를 그대로 따른다. 두 프레임은 체크박스 선택 여부만 다른 variant 쌍이라 항상
 * 상시 노출되고(별도 "편집모드" 없음), 이 컴포넌트도 그 전제로 selected/unselected 두 상태만 그린다.
 *
 * (design-agent 사후검수 확정, 2026-09) 체크됨/미선택 색상은 처음엔 기존 등록 토큰으로 근사했으나,
 * Figma MCP `get_design_context`로 체크박스 컴포넌트 인스턴스를 직접 조회해 정확값을 확인했다
 * (unchecked: `I279:1113;279:839`, checked: `I279:1204;279:839`):
 * - 체크됨 배경/보더: `#3e4c5f`(Figma 변수명 `color-brand-rest`) — 기존 `--color-brand-deep`
 *   (`#46536a`)과는 다른 별도 톤이라 `--color-brand-rest` 토큰을 신규 등록해 사용한다.
 * - 미선택 보더: `#d3dce4`(Figma 변수명 `color-stroke-1`, 불투명 블루그레이) — `--color-label-
 *   quaternary`(반투명 다크 그레이)와는 다른 색이라 `--color-stroke-1` 토큰을 신규 등록했다.
 * - 보더 두께 1px(`size-stroke-thin`), radius 2px(`radius/sm`) — 기존 `border-2`/`rounded-[6px]`는
 *   Figma 실측과 맞지 않는 임의값이었다.
 *
 * 네이티브 `<input type="checkbox">`를 시각적으로만 커스터마이즈한다(`appearance-none`) —
 * 키보드 포커스/스페이스 토글/폼 시맨틱을 그대로 유지하기 위함이다.
 */
export function Checkbox({
  checked,
  onChange,
  onClick,
  className,
  ...rest
}: CheckboxProps) {
  const wrapperClassName = className
    ? `relative inline-flex h-6 w-6 shrink-0 items-center justify-center ${className}`
    : "relative inline-flex h-6 w-6 shrink-0 items-center justify-center";

  return (
    <span className={wrapperClassName}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        onClick={onClick}
        className="peer border-stroke-1 checked:border-brand-rest checked:bg-brand-rest bg-bg-elevated focus-visible:ring-brand absolute inset-0 h-6 w-6 cursor-pointer appearance-none rounded-[2px] border outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        {...rest}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="stroke-label-on-dark pointer-events-none absolute h-4 w-4 fill-none opacity-0 peer-checked:opacity-100"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="5 13 10 18 19 7" />
      </svg>
    </span>
  );
}
