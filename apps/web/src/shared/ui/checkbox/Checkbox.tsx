import type { MouseEvent } from "react";

interface CheckboxBaseProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** 부모 요소(예: 클릭 가능한 행)로 클릭이 전파되지 않게 막고 싶을 때 추가로 넘긴다. */
  onClick?: (event: MouseEvent<HTMLInputElement>) => void;
  /** 제출 중처럼 조작을 막아야 할 때. `Button primary`와 같은 `opacity-50` 비활성 표현을 쓴다. */
  disabled?: boolean;
  className?: string;
}

/**
 * 접근 가능한 이름은 둘 중 하나로만 준다(`docs/SIGNUP_CONSENT_DESIGN.md` §3.3).
 * - 아이콘형(화면에 라벨 텍스트 없음, MyPage `HistoryRow`): `aria-label` 필수.
 * - 보이는 라벨이 있는 경우(`<label htmlFor={id}>`, 가입 동의 체크리스트): `id`만 주고 `aria-label`은 금지한다.
 *   `aria-label`이 보이는 문구를 덮어쓰면 WCAG 2.5.3(Label in Name) 위반이 된다.
 */
type CheckboxLabelProps =
  | { "aria-label": string; id?: string }
  | { id: string; "aria-label"?: never };

type CheckboxProps = CheckboxBaseProps & CheckboxLabelProps;

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
  disabled = false,
  className,
  ...rest
}: CheckboxProps) {
  // 비활성 표현(`opacity-50`)은 체크 아이콘까지 함께 흐려지도록 input이 아닌 래퍼에 건다.
  const baseClassName = disabled
    ? "relative inline-flex h-6 w-6 shrink-0 items-center justify-center opacity-50"
    : "relative inline-flex h-6 w-6 shrink-0 items-center justify-center";
  const wrapperClassName = className ? `${baseClassName} ${className}` : baseClassName;

  return (
    <span className={wrapperClassName}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        onClick={onClick}
        disabled={disabled}
        className="peer border-stroke-1 checked:border-brand-rest checked:bg-brand-rest bg-bg-elevated focus-visible:ring-brand absolute inset-0 h-6 w-6 cursor-pointer appearance-none rounded-[2px] border outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed"
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
