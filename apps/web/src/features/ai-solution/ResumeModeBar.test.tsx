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

  it("ownModeDisabled면(RESUME-4) '내 방법으로 계속'이 비활성화되고 인라인 안내 문구가 보인다", () => {
    render(<ResumeModeBar mode="alternative" onModeChange={() => {}} ownModeDisabled />);

    expect(screen.getByRole("button", { name: "내 방법으로 계속" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "다른 방법으로" })).not.toBeDisabled();
    expect(screen.getByText("이 방법으로는 이어갈 수 없어요")).toBeInTheDocument();
  });

  it("ownModeDisabled가 아니면 인라인 안내 문구를 보여주지 않는다", () => {
    render(<ResumeModeBar mode="own" onModeChange={() => {}} />);

    expect(screen.queryByText("이 방법으로는 이어갈 수 없어요")).not.toBeInTheDocument();
  });

  it("ownModeDisabled이고 applicabilityNote가 있으면 고정 문구 대신 실제 사유를 보여준다(RESUME-4)", () => {
    render(
      <ResumeModeBar
        mode="alternative"
        onModeChange={() => {}}
        ownModeDisabled
        applicabilityNote="이 방법은 판별식이 음수인 경우에는 적용할 수 없습니다."
      />,
    );

    expect(
      screen.getByText("이 방법은 판별식이 음수인 경우에는 적용할 수 없습니다."),
    ).toBeInTheDocument();
    expect(screen.queryByText("이 방법으로는 이어갈 수 없어요")).not.toBeInTheDocument();
  });

  it("ownModeDisabled이지만 applicabilityNote가 없으면 기존 고정 문구로 폴백한다", () => {
    render(<ResumeModeBar mode="alternative" onModeChange={() => {}} ownModeDisabled applicabilityNote={null} />);

    expect(screen.getByText("이 방법으로는 이어갈 수 없어요")).toBeInTheDocument();
  });
});
