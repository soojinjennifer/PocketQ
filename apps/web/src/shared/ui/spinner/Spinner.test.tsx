import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

describe("Spinner", () => {
  it("기본(announce 미지정)은 기존과 같이 role=status·aria-live=polite", () => {
    render(<Spinner label="처리 중" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toHaveTextContent("처리 중");
  });

  it("announce=false면 role·aria-live가 없고 문구는 보인다", () => {
    const { container } = render(<Spinner label="그림을 준비하는 중" announce={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(container.querySelector("[aria-live]")).toBeNull();
    expect(screen.getByText("그림을 준비하는 중")).toBeInTheDocument();
  });
});
