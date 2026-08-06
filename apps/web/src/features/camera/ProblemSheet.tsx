interface ProblemSheetProps {
  message: string;
}

/**
 * Figma `Camera/Problem Sheet`(node `48:110`/`51:129` 공유) — `/camera`, `/camera/preview`에서
 * 재사용하는 하단 안내 카드. 실제 문제 인식 텍스트는 아직 없으므로 짧은 안내 문구만 표시한다.
 */
export function ProblemSheet({ message }: ProblemSheetProps) {
  return (
    <div className="bg-bg-elevated w-full rounded-[4px] px-[34px] py-[30px] drop-shadow-[0px_3px_0px_rgba(35,43,56,0.16),0px_10px_20px_rgba(35,43,56,0.14),0px_22px_40px_rgba(35,43,56,0.09)]">
      <p className="text-label-primary text-center text-[15px] font-medium">{message}</p>
    </div>
  );
}
