import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkLineList, type WorkLine } from "./WorkLineList";

const MOCK_LINES: WorkLine[] = [
  { lineNo: 1, latex: "x^2 - 4x + 3 = 0", isValid: true },
  { lineNo: 2, latex: "(x-1)(x-3) = 0", isValid: true },
  { lineNo: 3, latex: "x < 1 \\text{ 또는 } x < 3", isValid: false },
];

describe("WorkLineList", () => {
  it("빈 배열이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<WorkLineList lines={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("각 줄을 줄 번호와 함께 렌더링한다", () => {
    render(<WorkLineList lines={MOCK_LINES} />);

    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("정답으로 확인된 줄에는 '확인' 배지를 보여준다", () => {
    render(<WorkLineList lines={MOCK_LINES} />);

    expect(screen.getAllByText("확인")).toHaveLength(2);
  });

  it("막힌 지점으로 판정된 줄에는 '막힌 지점' 배지를 보여준다", () => {
    render(<WorkLineList lines={MOCK_LINES} />);

    expect(screen.getByText("막힌 지점")).toBeInTheDocument();
  });

  it("아직 판정 전(isValid=null)인 줄에는 판정 배지를 보여주지 않는다", () => {
    render(<WorkLineList lines={[{ lineNo: 1, latex: "x = 1", isValid: null }]} />);

    expect(screen.queryByText("확인")).not.toBeInTheDocument();
    expect(screen.queryByText("막힌 지점")).not.toBeInTheDocument();
  });
});
