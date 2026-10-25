interface SpinnerProps {
  label?: string;
  /**
   * 스크린리더 알림 여부(기본 true = 기존 동작: `role="status"` + `aria-live="polite"`). false면 두 속성을 빼서
   * 라이브 영역으로 읽히지 않는다 — 조상이 `aria-live="off"`인 도형 슬롯처럼 대기를 알리지 않아야 하는 곳에서 쓴다
   * (Stage 4 오너 승인 SP, `docs/FIGURE_DESIGN.md` §17.7). 보이는 문구는 같다.
   */
  announce?: boolean;
}

/**
 * 최소 기능 로딩 인디케이터. 최종 디자인 스킨은 이번 단계 범위 밖이며,
 * 인증 상태 로딩/제출 로딩 등 기능 검증을 위한 자리표시 컴포넌트다.
 */
export function Spinner({ label = "로딩 중", announce = true }: SpinnerProps) {
  return (
    <div
      role={announce ? "status" : undefined}
      aria-live={announce ? "polite" : undefined}
      className="inline-flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className="border-fill-quaternary border-t-brand h-4 w-4 animate-spin rounded-full border-2"
      />
      <span className="text-label-secondary text-sm">{label}</span>
    </div>
  );
}
