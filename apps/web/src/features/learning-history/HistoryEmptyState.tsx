import { Button } from "../../shared/ui/button/Button";

interface HistoryEmptyStateProps {
  /** "문제 풀러 가기" CTA. 이동 경로는 페이지 레이어가 결정한다. */
  onStartSolve: () => void;
}

/**
 * 풀이 이력이 한 건도 없을 때의 안내(MYPAGE-3).
 *
 * **Figma 없음 — 결정 필요**: 빈 상태 디자인이 Figma에 정의돼 있지 않다. 새 일러스트/이미지 자산을
 * 만들지 않고 안내 문구 + 기존 `Button`(pill-primary) CTA만 사용한다. 문구/여백(py-[48px])은
 * 임시값이며 오너 확인 후 조정할 수 있다.
 */
export function HistoryEmptyState({ onStartSolve }: HistoryEmptyStateProps) {
  return (
    <div className="bg-bg-elevated flex flex-col items-center gap-3 rounded-[16px] px-[18px] py-[48px] text-center">
      <p className="text-label-primary text-[17px] font-[590]">아직 풀이한 문제가 없어요</p>
      <p className="text-label-secondary text-[15px]">
        문제를 촬영하거나 직접 써서 첫 풀이를 시작해 보세요
      </p>
      <Button variant="pill-primary" onClick={onStartSolve}>
        문제 풀러 가기
      </Button>
    </div>
  );
}
