interface FilterPillProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

/** 포커스 키보드 사용자를 위한 공용 focus-visible 스타일(`shared/ui/button/Button`과 동일 규칙). */
const FOCUS_STYLE =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2";

const BASE_STYLE = `inline-flex items-center justify-center rounded-full px-[16px] py-[7px] text-[15px] font-[590] ${FOCUS_STYLE}`;

/**
 * Figma `4 · MyPage` 필터 Pill 행(node `40:56`) 실측 스타일. 선택 상태는 브랜드 채움
 * (`bg-brand`/`text-label-on-dark`), 비선택 상태는 카드와 같은 흰 배경(`bg-bg-elevated`) +
 * 보조 라벨색이며 **보더가 없다**(`NavTabBar`의 유리 탭과는 다른 컴포넌트다 — 그쪽은 탭 전환,
 * 이쪽은 목록 필터라 시각/의미가 모두 달라 별도 공통 컴포넌트로 분리했다).
 *
 * 실제 라벨은 호출 측이 데이터에서 동적으로 만들어 전달한다(Figma의 정적 예시 문구를 하드코딩하지
 * 않는다). 선택 여부/클릭 동작도 이 컴포넌트가 소유하지 않는다.
 */
export function FilterPill({ label, selected, onClick }: FilterPillProps) {
  const variantClassName = selected
    ? "bg-brand text-label-on-dark"
    : "bg-bg-elevated text-label-secondary";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`${BASE_STYLE} ${variantClassName}`}
    >
      {label}
    </button>
  );
}
