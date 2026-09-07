import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HandwritingHighlightOverlay } from "./HandwritingHighlightOverlay";
import type { HighlightRegion } from "../../shared/lib/solve/deriveHighlightRegion";

describe("HandwritingHighlightOverlay", () => {
  it("region이 null이면 아무것도 렌더링하지 않는다", () => {
    const { container } = render(<HandwritingHighlightOverlay region={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("region이 있으면 좌표에 맞춰 반투명 밴드를 렌더링한다", () => {
    const region: HighlightRegion = { minX: 10, maxX: 110, minY: 20, maxY: 60, confidence: "exact" };

    const { container } = render(<HandwritingHighlightOverlay region={region} />);

    const wrapper = container.firstElementChild;
    expect(wrapper).toHaveAttribute("aria-hidden", "true");

    const band = wrapper?.firstElementChild as HTMLElement;
    expect(band).toHaveClass("bg-fill-tint-red/60");
    expect(band).toHaveClass("rounded-[10px]");
    expect(band.style.left).toBe("10px");
    expect(band.style.top).toBe("20px");
    expect(band.style.width).toBe("100px");
    expect(band.style.height).toBe("40px");
  });

  it("pointer-events-none으로 클릭/필기 입력을 가로채지 않는다", () => {
    const region: HighlightRegion = { minX: 0, maxX: 50, minY: 0, maxY: 20, confidence: "approximate" };

    const { container } = render(<HandwritingHighlightOverlay region={region} />);

    expect(container.firstElementChild).toHaveClass("pointer-events-none");
  });
});
