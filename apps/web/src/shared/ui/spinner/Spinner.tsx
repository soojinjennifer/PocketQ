interface SpinnerProps {
  label?: string;
}

/**
 * 최소 기능 로딩 인디케이터. 최종 디자인 스킨은 이번 단계 범위 밖이며,
 * 인증 상태 로딩/제출 로딩 등 기능 검증을 위한 자리표시 컴포넌트다.
 */
export function Spinner({ label = "로딩 중" }: SpinnerProps) {
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <span
        aria-hidden="true"
        className="border-fill-quaternary border-t-brand h-4 w-4 animate-spin rounded-full border-2"
      />
      <span className="text-label-secondary text-sm">{label}</span>
    </div>
  );
}
