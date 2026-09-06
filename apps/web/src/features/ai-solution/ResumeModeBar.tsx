import type { ResumeMode } from "shared-types";
import { Button } from "../../shared/ui/button/Button";

interface ResumeModeBarProps {
  mode: ResumeMode;
  onModeChange: (mode: ResumeMode) => void;
  /** RESUME-4: 학생의 해법이 문제에 적용 불가능한 경우(조건 미충족) "내 방법으로 계속"을
   *  비활성화하고, 그 아래에 인라인 안내 문구를 보여준다. @default false */
  ownModeDisabled?: boolean;
  /**
   * RESUME-4: LLM이 생성한 구체적 적용 불가 사유(`Diagnosis.methodApplicabilityNote`).
   * `ownModeDisabled`가 true이면서 이 값이 있으면 고정 문구 대신 이 실제 사유를 보여준다.
   * 값이 없으면(`null`/`undefined`) 기존 고정 문구로 폴백한다(stage-qa-agent 회귀 지적 수정,
   * 2026-09).
   */
  applicabilityNote?: string | null;
}

/**
 * `docs/COMPONENT_MAP.md` §2 `features/ai-solution/ResumeModeBar` — "내 방법으로 계속"(RESUME-1)
 * / "다른 방법으로"(METHOD, RESUME-4 대안 해법 안내) 두 모드를 전환하는 바.
 *
 * 2026-09 design-agent Figma 실측(`255:87`) 결과에 맞춰 재작성했다 — 이전 구현은 `ActionBar`와
 * 같은 glass pill 컨테이너(배경/보더 있는 캡슐)로 톤을 추정했지만, 실측 결과 바깥 컨테이너에는
 * 배경/보더가 전혀 없고 두 버튼이 `gap-[8px]`로 나란히 배치되며 각각 `flex-1`로 균등 2분할된다
 * (384px 프레임 기준 각 188px). 선택된 버튼은 `pill-primary`(브랜드 인디고)가 아니라
 * `pill-dark`(`bg-label-primary` — Figma 실측 `label/primary #232b38`와 일치)를 쓴다. 비선택
 * 버튼(`pill-glass`)은 기존 실측과 일치해 그대로 둔다.
 */
export function ResumeModeBar({
  mode,
  onModeChange,
  ownModeDisabled = false,
  applicabilityNote,
}: ResumeModeBarProps) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-start gap-2">
        <Button
          variant={mode === "own" ? "pill-dark" : "pill-glass"}
          disabled={ownModeDisabled}
          onClick={() => onModeChange("own")}
          className="flex-1"
        >
          내 방법으로 계속
        </Button>
        <Button
          variant={mode === "alternative" ? "pill-dark" : "pill-glass"}
          onClick={() => onModeChange("alternative")}
          className="flex-1"
        >
          다른 방법으로
        </Button>
      </div>
      {/* RESUME-4: 식별된 해법을 이 문제에 적용할 수 없을 때만 보여주는 인라인 안내(별도 모달/카드/
          배지 없음, 오너 확정). 노출 여부는 호출 측(`ownModeDisabled` = `!diagnosis.isMethodApplicable`)이
          결정한다. `applicabilityNote`(LLM이 생성한 구체적 사유)가 있으면 그 실제 문구를, 없으면
          고정 문구로 폴백한다(stage-qa-agent 회귀 RESUME-4 HIGH 결함 수정, 2026-09). */}
      {ownModeDisabled ? (
        <p className="text-label-secondary text-[13px] leading-[18px]">
          {applicabilityNote ?? "이 방법으로는 이어갈 수 없어요"}
        </p>
      ) : null}
    </div>
  );
}
