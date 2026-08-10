import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ActionBar } from "./ActionBar";

/** ActionBar는 controlled 컴포넌트라 테스트에서도 선택 상태를 직접 관리하는 얇은 래퍼가 필요하다. */
function ControlledActionBar({ hasProblem = true }: { hasProblem?: boolean }) {
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <ActionBar
      hasProblem={hasProblem}
      selectedOptionIds={selectedOptionIds}
      onToggleOption={toggle}
    />
  );
}

describe("ActionBar", () => {
  it("초기 상태(0개 선택)에서는 풀기 버튼이 비활성화된다(SOLVE-1)", () => {
    render(<ControlledActionBar />);

    expect(screen.getByRole("checkbox", { name: "개념설명해주기" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "풀이해주기" })).not.toBeChecked();
    expect(screen.getByRole("button", { name: "풀기" })).toBeDisabled();
  });

  it("체크박스를 1개 이상 선택하면 풀기 버튼이 활성화된다", () => {
    render(<ControlledActionBar />);

    fireEvent.click(screen.getByRole("checkbox", { name: "개념설명해주기" }));

    expect(screen.getByRole("checkbox", { name: "개념설명해주기" })).toBeChecked();
    expect(screen.getByRole("button", { name: "풀기" })).not.toBeDisabled();
  });

  it("사진이 없으면(hasProblem=false) 체크박스를 선택해도 풀기 버튼이 비활성화된다", () => {
    render(<ControlledActionBar hasProblem={false} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "개념설명해주기" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "풀이해주기" }));

    expect(screen.getByRole("button", { name: "풀기" })).toBeDisabled();
  });

  it("선택했던 체크박스를 다시 클릭하면 해제되고, 0개가 되면 다시 비활성화된다", () => {
    render(<ControlledActionBar />);

    const checkbox = screen.getByRole("checkbox", { name: "풀이해주기" });
    fireEvent.click(checkbox);
    expect(screen.getByRole("button", { name: "풀기" })).not.toBeDisabled();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("button", { name: "풀기" })).toBeDisabled();
  });

  it("isSubmitting이 true면 선택이 있어도 풀기 버튼이 비활성화된다", () => {
    render(
      <ActionBar
        hasProblem
        selectedOptionIds={new Set(["explain"])}
        onToggleOption={() => {}}
        isSubmitting
      />,
    );

    expect(screen.getByRole("button", { name: "풀기" })).toBeDisabled();
  });
});
