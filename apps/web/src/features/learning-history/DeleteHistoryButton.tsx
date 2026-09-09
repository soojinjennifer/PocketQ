interface DeleteHistoryButtonProps {
  /** 선택된 항목이 하나도 없으면 `true` — 언마운트되지 않고 항상 렌더링된 채 비활성화만 된다. */
  disabled: boolean;
  onClick: () => void;
}

/**
 * Figma(`40:34` "MyPage/Nonselect", `279:1176` "MyPage/Selected", fileKey `ltyPrCk8UT8DsB3tFuw7Sr`)
 * 실측: 필터 Pill 바로 아래·리스트 바로 위에 우측 정렬로 항상 노출되는 "풀이 내역 지우기" 버튼
 * (약 157×28px). 두 프레임은 체크박스/버튼 활성 여부만 다른 variant 쌍이라 별도의 "편집모드 진입"
 * 트리거 없이 이 버튼도 항상 렌더링되고, 선택된 항목이 있을 때만 활성 스타일로 바뀐다.
 *
 * `shared/ui/button`의 pill 계열(`px-[26px] py-[11px]`)은 높이가 28px보다 훨씬 커서 그대로
 * 재사용하면 실측 크기와 크게 어긋나므로, 이 버튼 전용 28px 높이로 새로 만들었다(재사용 대신 신규
 * 소형 마크업을 쓴 이유).
 *
 * (design-agent 사후검수 확정, 2026-09) 배경 색상은 처음엔 기존 등록 토큰으로 근사했으나, Figma
 * MCP `get_design_context`로 이 버튼 인스턴스를 직접 조회해 정확값을 확인했다:
 * - 활성 배경: `#6c8693`(Figma 변수명 `accent/steel`, 인스턴스 `279:1202`) — `--color-brand-deep`
 *   (`#46536a`)과는 확연히 다른 톤이라 `--color-accent-steel` 토큰을 신규 등록해 사용한다.
 * - 비활성 배경: `#d9d7d2`(Figma 변수명 `bg/scrim`, 인스턴스 `279:930`) — 앱 공용 pill 비활성 패턴
 *   (`--color-icon-default`, `shared/ui/button`의 `PILL_DISABLED_STYLE`)과는 다른 이 화면 전용
 *   값이라 `--color-bg-scrim` 토큰을 신규 등록해 사용한다.
 * - 텍스트: 흰색(`--color-label-on-dark`)은 기존 구현이 맞았다.
 * - 폰트 크기: Figma 텍스트 스타일이 `Text/Subheadline Semibold`(15px/590/lineHeight 20)로
 *   확인됐다 — `shared/ui/button`의 pill 텍스트 규격과도 동일하다. 기존 `text-[13px]`는 임의값이라
 *   `text-[15px]`로 정정한다.
 */
export function DeleteHistoryButton({ disabled, onClick }: DeleteHistoryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`focus-visible:ring-brand inline-flex h-[28px] shrink-0 items-center justify-center rounded-full px-[16px] text-[15px] font-[590] outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed ${
        disabled ? "bg-bg-scrim text-label-on-dark" : "bg-accent-steel text-label-on-dark"
      }`}
    >
      풀이 내역 지우기
    </button>
  );
}
