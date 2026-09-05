import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResumeModeBar } from "./ResumeModeBar";

describe("ResumeModeBar", () => {
  it("두 모드 버튼을 모두 렌더링한다", () => {
    render(<ResumeModeBar mode="own" onModeChange={() => {}} />);

    expect(screen.getByRole("button", { name: "내 방법으로 계속" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다른 방법으로" })).toBeInTheDocument();
  });

  it("버튼 클릭 시 onModeChange가 해당 모드로 호출된다", () => {
    const handleChange = vi.fn();
    render(<ResumeModeBar mode="own" onModeChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "다른 방법으로" }));
    expect(handleChange).toHaveBeenCalledWith("alternative");
  });

  it("ownModeDisabled면(RESUME-4) '내 방법으로 계속'이 비활성화된다", () => {
    render(<ResumeModeBar mode="alternative" onModeChange={() => {}} ownModeDisabled />);

    expect(screen.getByRole("button", { name: "내 방법으로 계속" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다른 방법으로" })).not.toBeDisabled();
  });
});
