import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";
import { CameraRailButton } from "./CameraRailButton";

function renderCameraRailButton() {
  return render(
    <MemoryRouter initialEntries={["/solve/pencilcanvas"]}>
      <Routes>
        <Route path="/solve/pencilcanvas" element={<CameraRailButton />} />
        <Route path="/camera" element={<div>CameraPage</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CameraRailButton", () => {
  it("aria-label='사진'인 버튼을 렌더링한다", () => {
    renderCameraRailButton();

    expect(screen.getByRole("button", { name: "사진" })).toBeInTheDocument();
  });

  it("클릭하면 /camera로 이동한다", () => {
    renderCameraRailButton();

    fireEvent.click(screen.getByRole("button", { name: "사진" }));

    expect(screen.getByText("CameraPage")).toBeInTheDocument();
  });
});
