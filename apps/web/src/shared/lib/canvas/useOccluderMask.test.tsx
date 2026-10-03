import { useRef } from "react";
import { render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CANVAS_OCCLUDER_PROPS, useOccluderMask } from "./useOccluderMask";

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) };
}

function Harness({ enabled, showOccluder = true }: { enabled: boolean; showOccluder?: boolean }) {
  const targetRef = useRef<HTMLDivElement>(null);
  useOccluderMask(targetRef, enabled);
  return (
    <div>
      <div ref={targetRef} data-testid="target" />
      {showOccluder ? (
        <div {...CANVAS_OCCLUDER_PROPS} data-testid="occluder">
          <span style={{ borderTopLeftRadius: "6px" }} />
        </div>
      ) : null}
    </div>
  );
}

describe("useOccluderMask", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      window.setTimeout(() => callback(0), 0),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.testid === "occluder" ? rect(100, 20, 200, 40) : rect(0, 0, 1000, 800);
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("표식 요소 영역을 뚫은 mask-image를 대상 요소에 적용한다", async () => {
    const { getByTestId } = render(<Harness enabled />);
    await waitFor(() => {
      const mask = decodeURIComponent(getByTestId("target").style.getPropertyValue("mask-image"));
      expect(mask).toContain("width='1000' height='800'");
      expect(mask).toContain("<rect x='100' y='20' width='200' height='40' rx='6' fill='black'/>");
    });
  });

  it("enabled=false면 mask를 적용하지 않는다", () => {
    const { getByTestId } = render(<Harness enabled={false} />);
    expect(getByTestId("target").style.getPropertyValue("mask-image")).toBe("");
  });

  it("표식 요소가 사라지면 mask를 제거한다", async () => {
    const { getByTestId, rerender } = render(<Harness enabled />);
    await waitFor(() => {
      expect(getByTestId("target").style.getPropertyValue("mask-image")).not.toBe("");
    });
    rerender(<Harness enabled showOccluder={false} />);
    await waitFor(() => {
      expect(getByTestId("target").style.getPropertyValue("mask-image")).toBe("");
    });
  });

  it("대상 요소의 원점이 (0,0)이 아니어도 구멍 좌표를 대상 기준으로 환산한다", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.dataset.testid === "occluder" ? rect(130, 70, 200, 40) : rect(30, 50, 1000, 800);
    });
    const { getByTestId } = render(<Harness enabled />);
    await waitFor(() => {
      const mask = decodeURIComponent(getByTestId("target").style.getPropertyValue("mask-image"));
      expect(mask).toContain("<rect x='100' y='20' width='200' height='40'");
    });
  });

  it("언마운트 시 mask를 제거한다", async () => {
    const { getByTestId, unmount } = render(<Harness enabled />);
    const target = getByTestId("target");
    await waitFor(() => {
      expect(target.style.getPropertyValue("mask-image")).not.toBe("");
    });
    unmount();
    expect(target.style.getPropertyValue("mask-image")).toBe("");
    expect(target.style.getPropertyValue("-webkit-mask-image")).toBe("");
  });
});
