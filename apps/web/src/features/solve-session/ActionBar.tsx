import { SOLVE_ACTION_OPTIONS } from "../../shared/lib/solve/solveOptions";
import { Button } from "../../shared/ui/button/Button";

interface ActionBarProps {
  /** 문제 사진이 없으면 선택 개수와 무관하게 "풀기" 버튼을 항상 비활성화한다. */
  hasProblem: boolean;
  /** 선택된 옵션 id 집합(controlled) — `ProblemInputProvider`가 소유해 pencilcanvas↔landscape 이동
   *  간에도 선택 상태가 유지된다. */
  selectedOptionIds: ReadonlySet<string>;
  onToggleOption: (id: string) => void;
  /** "풀기" 버튼 클릭 시 호출된다. 전달하지 않으면 클릭해도 아무 동작이 없다. */
  onSolve?: () => void;
  /** recognize/solve 요청이 진행 중이면 true — 중복 제출을 막기 위해 버튼을 비활성화한다. */
  isSubmitting?: boolean;
}

/**
 * Figma `Action Bar`(node `38:48`) — 개념설명/풀이 체크박스 2개 + `풀기` 버튼.
 * SOLVE-1: 0개 선택 시 풀기 버튼을 비활성화한다.
 * 옵션 선택 상태는 이 컴포넌트가 소유하지 않는다(controlled) — pencilcanvas/landscape 두 화면이
 * 각자 `useState`를 갖고 있으면 화면 전환 시 선택값이 유실되는 문제가 있었다.
 */
export function ActionBar({
  hasProblem,
  selectedOptionIds,
  onToggleOption,
  onSolve,
  isSubmitting = false,
}: ActionBarProps) {
  const disabled = !hasProblem || selectedOptionIds.size === 0 || isSubmitting;

  return (
    <div className="bg-glass-fill border-glass-border flex w-fit items-center gap-[12px] rounded-full border py-[8px] pl-[18px] pr-[10px] shadow-[0px_7px_6.5px_rgba(35,43,56,0.11),0px_2px_0px_rgba(35,43,56,0.18)]">
      {SOLVE_ACTION_OPTIONS.map((option) => {
        const checked = selectedOptionIds.has(option.id);
        return (
          <label
            key={option.id}
            className="text-label-primary flex items-center gap-[7px] text-[13px] font-semibold leading-[18px]"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onToggleOption(option.id)}
              className="sr-only"
            />
            <span
              aria-hidden="true"
              className={
                checked
                  ? "bg-brand text-bg-elevated flex size-[19px] items-center justify-center rounded-[6px] text-[11px] leading-[13px]"
                  : "border-label-quaternary flex size-[19px] items-center justify-center rounded-[6px] border"
              }
            >
              {checked ? "✓" : null}
            </span>
            {option.label}
          </label>
        );
      })}
      <Button variant="pill-dark" disabled={disabled} onClick={onSolve}>
        풀기
      </Button>
    </div>
  );
}
