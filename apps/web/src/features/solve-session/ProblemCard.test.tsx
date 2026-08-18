import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProblemCard } from "./ProblemCard";

describe("ProblemCard", () => {
  it("data가 null이면 초기 안내 문구를 보여준다", () => {
    render(<ProblemCard data={null} />);

    expect(screen.getByText("사진을 찍어 문제를 입력해 주세요")).toBeInTheDocument();
  });

  it("imageUrl이 있으면 촬영한 사진을 보여준다", () => {
    render(<ProblemCard data={{ imageUrl: "blob:preview" }} />);

    expect(screen.getByAltText("촬영한 문제")).toHaveAttribute("src", "blob:preview");
  });

  it("recognitionFailed면 인식 실패 문구를 보여준다", () => {
    render(<ProblemCard data={{ recognitionFailed: true }} />);

    expect(screen.getByText("문제가 인식되지 않았습니다")).toBeInTheDocument();
  });

  it("needsRetake면 다시 찍어 달라는 안내를 보여주고, 누르면 onRequestRetake를 호출한다(결과 화면 '수정')", () => {
    const handleRequestRetake = vi.fn();
    render(<ProblemCard data={{ needsRetake: true }} onRequestRetake={handleRequestRetake} />);

    expect(screen.getByText("문제를 다시 찍어 주세요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(handleRequestRetake).toHaveBeenCalledTimes(1);
  });
});
