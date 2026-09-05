/**
 * `ResultCard`/`RecognizedProblemBar`(Figma 실측 완료)가 쓰는 elevated 카드 래퍼 톤과 동일한
 * Tailwind 조합. WORK/DIAG/RESUME 목업 컴포넌트(`WorkLineList`/`DiagnosisCard`/`ResumeResultCard`,
 * `docs/FRONTEND_IMPLEMENTATION_PLAN.md` §1.3.1 2단계)가 이 상수를 공유해서 동일한 조합이
 * 3회 이상 반복되지 않게 한다(`.claude/rules/frontend.md` §2). 이미 구현·검수를 마친
 * `ResultCard.tsx`/`RecognizedProblemBar.tsx`는 이번 작업 범위 밖이라 값을 그대로 복사해두는 데
 * 그치고 별도로 리팩터링하지 않는다.
 */
export const ELEVATED_CARD_STYLE =
  "bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]";
