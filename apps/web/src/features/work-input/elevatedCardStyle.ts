/**
 * `ResultCard`/`RecognizedProblemBar`(Figma 실측 완료, `features/ai-solution`)가 쓰는 elevated
 * 카드 래퍼 톤과 동일한 Tailwind 조합. `features/ai-solution/elevatedCardStyle.ts`와 값이
 * 동일하지만, feature 간 직접 참조는 금지되어 있어(`.claude/rules/frontend.md` §1) 그 파일을
 * 이 feature에서 import할 수 없다 — 값만 복제해서 별도로 둔다.
 *
 * 소비처가 `ai-solution`(3곳) + `work-input`(1곳)으로 이미 2개 feature를 넘어섰으므로, 원칙적으로는
 * `shared/lib/katex/renderMathText.tsx`가 같은 이유로 이동한 선례처럼 `shared/ui`로 끌어올리는
 * 것이 맞다. 다만 이번 work-order(3단계, `WorkLineEditor` 신규 구현)는 이미 완료·검수된
 * `features/ai-solution` 파일들을 수정하는 것을 승인 범위로 포함하지 않아 이번에는 손대지 않았다
 * — 후속 작업에서 오너 승인 하에 `shared/ui`로 승격하는 것을 권장한다.
 */
export const ELEVATED_CARD_STYLE =
  "bg-bg-elevated rounded-[14px] p-4 drop-shadow-[0px_2px_0px_rgba(35,43,56,0.18),0px_7px_13px_rgba(35,43,56,0.11)]";
