import { useEffect, type ReactNode } from "react";
import { Button } from "../../shared/ui/button/Button";

interface HistoryDetailPanelProps {
  /** 오버레이를 닫고 목록으로 돌아간다. */
  onClose: () => void;
  /** 오버레이 본문. `ResultPanel`(features/ai-solution) 등 다른 feature의 컴포넌트는 여기에
   *  페이지 레이어(`pages/mypage/MyPage`)가 주입한다 — `features/learning-history`가 다른
   *  feature를 직접 import하면 `.claude/rules/frontend.md` §1 위반이기 때문이다
   *  (`SolveLandscapePage`가 `ResultPanelShell`에 children을 주입하는 것과 동일한 패턴). */
  children: ReactNode;
}

/**
 * 마이페이지 "이전 풀이 다시 보기" 오버레이 셸(MYPAGE-2). 오너 확정대로 새 라우트로 이동하지 않고
 * `/mypage` 내부 오버레이로 표시한다.
 *
 * **Figma 없음 — 결정 필요**: 이 조회 뷰의 시각 디자인은 Figma에 정의돼 있지 않다. 새 색상/픽셀값을
 * 발명하지 않기 위해 다음만 기존 값에서 그대로 가져왔다.
 * - 유리 패널 배경/보더/모서리/그림자: `features/ai-solution/ResultPanelShell`이 쓰는 클래스
 *   (`bg-glass-fill`/`border-glass-border`/`rounded-[24px]` + Figma `Elevation/Glass Panel`
 *   그림자)를 문자 그대로 재사용했다. `ResultPanelShell` 자체는 재사용하지 않는다 — resize 콜백
 *   4개가 필수인 `/solve` 전용 인터랙션 셸이라 read-only 조회에 맞지 않는다.
 * - 배경 딤: `shared/ui/modal/Modal`과 동일한 `bg-black/40`.
 * - 패널 폭 `w-[min(720px,100%)]`/최대 높이는 Figma 근거 없는 임시값이다(결정 필요). 목록 컬럼
 *   폭(760px)보다 살짝 좁게 잡아 오버레이임이 드러나게 했다.
 *
 * 닫기 경로는 3가지다: 헤더 좌측 "목록으로" 버튼, `Escape` 키, 배경(딤) 클릭.
 */
export function HistoryDetailPanel({ onClose, children }: HistoryDetailPanelProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      {/* 배경 클릭으로도 닫히게 하되, 키보드/스크린리더 사용자는 "목록으로" 버튼과 Escape를
          쓰므로 이 요소는 보조 수단이며 접근성 트리에서 제외한다. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={onClose}
        className="absolute inset-0 cursor-default"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="지난 풀이 다시 보기"
        className="bg-glass-fill border-glass-border relative flex max-h-full w-[min(720px,100%)] flex-col overflow-hidden rounded-[24px] border shadow-[0px_4px_0px_rgba(35,43,56,0.21),0px_13px_24px_rgba(35,43,56,0.18),0px_25px_45px_rgba(35,43,56,0.1),inset_0px_2px_0px_rgba(255,255,255,0.9),inset_0px_-2px_0px_rgba(35,43,56,0.07)]"
      >
        <div className="flex shrink-0 items-center px-5 pt-4">
          <Button variant="select" onClick={onClose}>
            목록으로
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}
