import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SolveScroll } from "./SolveScroll";
import type { HandwritingCanvasHandle } from "./HandwritingCanvas";

function createMockHandle(isPenActive: boolean): {
  ref: { current: HandwritingCanvasHandle };
  scrollToRatio: ReturnType<typeof vi.fn>;
} {
  const scrollToRatio = vi.fn();
  const handle: HandwritingCanvasHandle = {
    scrollToRatio,
    isPenActive: () => isPenActive,
    isScrollable: () => true,
  };
  return { ref: { current: handle }, scrollToRatio };
}

describe("SolveScroll", () => {
  it("마커를 탭하면 해당 비율로 scrollToRatio를 호출한다", () => {
    const { ref, scrollToRatio } = createMockHandle(false);
    const { getByLabelText } = render(<SolveScroll canvasRef={ref} currentRatio={0} />);

    fireEvent.click(getByLabelText("풀이 100% 지점으로 스크롤 이동"));

    expect(scrollToRatio).toHaveBeenCalledTimes(1);
    expect(scrollToRatio).toHaveBeenCalledWith(1);
  });

  it("펜이 그리는 중(isPenActive=true)이면 마커 탭을 무시한다", () => {
    const { ref, scrollToRatio } = createMockHandle(true);
    const { getByLabelText } = render(<SolveScroll canvasRef={ref} currentRatio={0} />);

    fireEvent.click(getByLabelText("풀이 100% 지점으로 스크롤 이동"));

    expect(scrollToRatio).not.toHaveBeenCalled();
  });

  it("currentRatio와 가장 가까운 마커에 aria-pressed=true를 표시한다", () => {
    const { ref } = createMockHandle(false);
    const { getByLabelText } = render(<SolveScroll canvasRef={ref} currentRatio={0.7} />);

    // 2/3 ≈ 0.667이 0.7과 가장 가까우므로 해당 마커가 활성화된다.
    expect(getByLabelText("풀이 67% 지점으로 스크롤 이동")).toHaveAttribute("aria-pressed", "true");
    expect(getByLabelText("풀이 100% 지점으로 스크롤 이동")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("canvasRef.current가 없어도(마운트 전 등) 에러 없이 무시한다", () => {
    const ref: { current: HandwritingCanvasHandle | null } = { current: null };
    const { getByLabelText } = render(<SolveScroll canvasRef={ref} currentRatio={0} />);

    expect(() => fireEvent.click(getByLabelText("풀이 0% 지점으로 스크롤 이동"))).not.toThrow();
  });

  it("disabled=true면 마커를 탭해도 scrollToRatio를 호출하지 않고 aria-disabled를 표시한다", () => {
    const { ref, scrollToRatio } = createMockHandle(false);
    const { getByLabelText } = render(
      <SolveScroll canvasRef={ref} currentRatio={0} disabled />,
    );

    const marker = getByLabelText("풀이 100% 지점으로 스크롤 이동");
    expect(marker).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(marker);

    expect(scrollToRatio).not.toHaveBeenCalled();
  });
});
