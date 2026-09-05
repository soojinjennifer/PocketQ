import { Button } from "../../shared/ui/button/Button";

export type ResumeMode = "own" | "alternative";

interface ResumeModeBarProps {
  mode: ResumeMode;
  onModeChange: (mode: ResumeMode) => void;
  /** RESUME-4: 학생의 해법이 문제에 적용 불가능한 경우(조건 미충족) "내 방법으로 계속"을
   *  비활성화한다. @default false */
  ownModeDisabled?: boolean;
}

/**
 * `docs/COMPONENT_MAP.md` §2 `features/ai-solution/ResumeModeBar` — "내 방법으로 계속"(RESUME-1)
 * / "다른 방법으로"(METHOD, RESUME-4 대안 해법 안내) 두 모드를 전환하는 바. PRD 핵심 시나리오
 * 2.2 7~8단계의 버튼 문구를 그대로 사용한다.
 *
 * `ActionBar`(같은 폭 3분할 pill 컨테이너, `features/solve-session/ActionBar`)와 동일한 glass pill
 * 컨테이너 톤을 재사용한다(정확한 RESUME 단계 Figma는 §7 기준 미확인 — 톤/구조만 기존 화면에서
 * 합리적으로 도출). 컨테이너 패딩/간격(`gap-[2px] p-[6px]`)은 2026-09-05 `ActionBar` Figma
 * 실측(`Solve/Action Bar` `260:101`) 정정에 맞춰 함께 갱신했다 — 세그먼트 구분선/강조 로직까지
 * 가져올 필요는 없어 그 부분은 그대로 둔다. 이번 단계는 controlled 목업 컴포넌트로만 구현하고,
 * 백엔드 연동은 5단계 범위다.
 */
export function ResumeModeBar({ mode, onModeChange, ownModeDisabled = false }: ResumeModeBarProps) {
  return (
    <div className="bg-glass-fill border-glass-border flex w-fit items-center gap-[2px] rounded-full border p-[6px]">
      <Button
        variant={mode === "own" ? "pill-primary" : "pill-glass"}
        disabled={ownModeDisabled}
        onClick={() => onModeChange("own")}
      >
        내 방법으로 계속
      </Button>
      <Button
        variant={mode === "alternative" ? "pill-primary" : "pill-glass"}
        onClick={() => onModeChange("alternative")}
      >
        다른 방법으로
      </Button>
    </div>
  );
}
