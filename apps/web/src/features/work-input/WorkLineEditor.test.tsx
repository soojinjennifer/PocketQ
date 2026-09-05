import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkLineEditor, type WorkInputLine } from "./WorkLineEditor";

const RECOGNIZED_LINE: WorkInputLine = { lineNo: 1, latex: "x^2 - 4x + 3 = 0", isLowConfidence: false };
const LOW_CONFIDENCE_LINE: WorkInputLine = { lineNo: 2, latex: "(x-1)(x-3) = 0", isLowConfidence: true };
const MOCK_LINES: WorkInputLine[] = [RECOGNIZED_LINE, LOW_CONFIDENCE_LINE];

describe("WorkLineEditor", () => {
  it("빈 배열이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<WorkLineEditor lines={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("각 줄을 줄 번호와 함께 렌더링한다", () => {
    render(<WorkLineEditor lines={MOCK_LINES} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("신뢰도가 정상인 줄에는 '인식됨' 배지를 보여준다", () => {
    render(<WorkLineEditor lines={MOCK_LINES} />);

    expect(screen.getByText("인식됨")).toBeInTheDocument();
  });

  it("저신뢰도 줄에는 '확인 필요' 경고를 보여주고 '인식됨' 배지는 보여주지 않는다", () => {
    render(<WorkLineEditor lines={[LOW_CONFIDENCE_LINE]} />);

    expect(screen.getByText("확인 필요")).toBeInTheDocument();
    expect(screen.queryByText("인식됨")).not.toBeInTheDocument();
  });

  it("줄마다 '수정' 링크를 보여준다", () => {
    render(<WorkLineEditor lines={MOCK_LINES} />);

    expect(screen.getAllByRole("button", { name: "수정" })).toHaveLength(2);
  });

  it("'수정'을 누르면 해당 줄이 입력 필드로 바뀌고 '저장'/'취소'가 나타난다", () => {
    render(<WorkLineEditor lines={MOCK_LINES} />);

    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[0]!);

    expect(screen.getByRole("textbox", { name: "1번째 줄 수정" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "저장" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "취소" })).toBeInTheDocument();
  });

  it("텍스트를 수정하고 저장하면 수정된 내용이 반영되고 onSaveLine이 호출된다", () => {
    const savedLines: Array<{ lineNo: number; latex: string }> = [];
    render(
      <WorkLineEditor
        lines={MOCK_LINES}
        onSaveLine={(lineNo, latex) => savedLines.push({ lineNo, latex })}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[0]!);
    const input = screen.getByRole("textbox", { name: "1번째 줄 수정" });
    fireEvent.change(input, { target: { value: "x^2 - 4x + 4 = 0" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    expect(screen.getByText("x^2 - 4x + 4 = 0")).toBeInTheDocument();
    expect(savedLines).toEqual([{ lineNo: 1, latex: "x^2 - 4x + 4 = 0" }]);
    expect(screen.queryByRole("textbox", { name: "1번째 줄 수정" })).not.toBeInTheDocument();
  });

  it("취소하면 원래 텍스트가 유지되고 onSaveLine이 호출되지 않는다", () => {
    const onSaveLine = () => {
      throw new Error("취소 시에는 onSaveLine이 호출되면 안 된다");
    };
    render(<WorkLineEditor lines={MOCK_LINES} onSaveLine={onSaveLine} />);

    fireEvent.click(screen.getAllByRole("button", { name: "수정" })[0]!);
    const input = screen.getByRole("textbox", { name: "1번째 줄 수정" });
    fireEvent.change(input, { target: { value: "x^2 - 4x + 4 = 0" } });
    fireEvent.click(screen.getByRole("button", { name: "취소" }));

    expect(screen.getByText("x^2 - 4x + 3 = 0")).toBeInTheDocument();
    expect(screen.queryByText("x^2 - 4x + 4 = 0")).not.toBeInTheDocument();
  });
});
