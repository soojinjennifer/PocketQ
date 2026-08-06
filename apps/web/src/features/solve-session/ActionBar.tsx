import { useState } from "react";
import { Button } from "../../shared/ui/button/Button";

interface ActionOption {
  id: string;
  label: string;
}

const OPTIONS: ActionOption[] = [
  { id: "explain", label: "개념설명해주기" },
  { id: "solve", label: "풀이해주기" },
];

interface ActionBarProps {
  /** 문제 사진이 없으면 선택 개수와 무관하게 "풀기" 버튼을 항상 비활성화한다. */
  hasProblem: boolean;
}

/**
 * Figma `Action Bar`(node `38:48`) — 개념설명/풀이 체크박스 2개 + `풀기` 버튼.
 * SOLVE-1: 0개 선택 시 풀기 버튼을 비활성화한다(초기값은 둘 다 미체크).
 * AI가 아직 연결되지 않았으므로 버튼 클릭은 아무 동작도 하지 않는다.
 */
export function ActionBar({ hasProblem }: ActionBarProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const disabled = !hasProblem || selectedIds.size === 0;

  return (
    <div className="bg-glass-fill border-glass-border w-fit self-center flex items-center gap-[12px] rounded-full border py-[8px] pl-[18px] pr-[10px] shadow-[0px_7px_6.5px_rgba(35,43,56,0.11),0px_2px_0px_rgba(35,43,56,0.18)]">
      {OPTIONS.map((option) => {
        const checked = selectedIds.has(option.id);
        return (
          <label
            key={option.id}
            className="text-label-primary flex items-center gap-[7px] text-[13px] font-semibold leading-[18px]"
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(option.id)}
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
      <Button variant="pill-dark" disabled={disabled}>
        풀기
      </Button>
    </div>
  );
}
