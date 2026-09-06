interface EmptyStateHintProps {
  title: string;
  subtitle: string;
}

/**
 * `/solve/pencilcanvas` 캔버스가 비어 있을 때(문제 입력 전/풀이 입력 전) 가운데에 표시하는 안내
 * 문구. `pointer-events-none`이라 아래 캔버스의 필기 입력을 막지 않는다.
 */
export function EmptyStateHint({ title, subtitle }: EmptyStateHintProps) {
  return (
    <div className="pointer-events-none flex flex-col items-center gap-[10px] text-center">
      <p className="text-label-tertiary text-[20px]">{title}</p>
      <p className="text-label-quaternary text-[15px] leading-[20px]">{subtitle}</p>
    </div>
  );
}
