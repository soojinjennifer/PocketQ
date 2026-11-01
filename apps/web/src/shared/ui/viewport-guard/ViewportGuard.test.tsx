import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { beforeEach, describe, expect, it } from "vitest";
import { PHONE_NOTICE, ViewportGuard } from "./ViewportGuard";

function setViewport(width: number, height: number) {
  Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
  Object.defineProperty(window, "innerHeight", {
    writable: true,
    configurable: true,
    value: height,
  });
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

function setScreen(width: number, height: number) {
  Object.defineProperty(window.screen, "width", { configurable: true, value: width });
  Object.defineProperty(window.screen, "height", { configurable: true, value: height });
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/solve"]}>
      <ViewportGuard>
        <Routes>
          <Route path="*" element={<LocationDisplay />} />
        </Routes>
      </ViewportGuard>
    </MemoryRouter>,
  );
}

describe("ViewportGuard", () => {
  beforeEach(() => {
    setScreen(1366, 1024);
  });

  it.each([
    ["세로", 390, 844],
    ["가로", 844, 390],
  ])("휴대폰(%s)에서는 회전 안내 대신 지원 기기를 안내한다", (_, width, height) => {
    setScreen(width, height);
    renderGuard();
    setViewport(width, height);

    expect(screen.getByTestId("viewport-guard-overlay")).toHaveTextContent(PHONE_NOTICE);
    expect(PHONE_NOTICE).toBe("iPad, 갤럭시 패드, PC에서 접속하시면 바로 보실 수 있습니다.");
  });

  it("iPad mini 세로(744)는 휴대폰이 아니므로 가로 회전 안내를 표시한다", () => {
    setScreen(744, 1133);
    renderGuard();
    setViewport(744, 1133);

    expect(screen.getByTestId("viewport-guard-overlay")).toHaveTextContent("기기를 가로로 돌려주세요");
  });

  it("iPad Split View처럼 창만 좁으면 휴대폰 안내를 띄우지 않는다", () => {
    setScreen(1366, 1024);
    renderGuard();
    setViewport(507, 1024);

    expect(screen.getByTestId("viewport-guard-overlay")).not.toHaveTextContent(PHONE_NOTICE);
  });

  it("세로 모드에서는 가로 회전 안내를 표시한다", () => {
    renderGuard();
    setViewport(768, 1024);

    expect(screen.getByTestId("viewport-guard-overlay")).toHaveTextContent(
      "기기를 가로로 돌려주세요",
    );
  });

  it("가로 모드이고 1024px 미만이면 전체 화면 안내를 표시한다", () => {
    renderGuard();
    setViewport(900, 700);

    expect(screen.getByTestId("viewport-guard-overlay")).toHaveTextContent(
      "전체 화면에서 이용해 주세요",
    );
  });

  it("가로 모드이고 1024px 이상이면 오버레이 없이 정상 표시한다", () => {
    renderGuard();
    setViewport(1194, 834);

    expect(screen.queryByTestId("viewport-guard-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/solve");
  });

  it("안내 화면 표시 여부와 무관하게 URL(라우트 위치)은 변경되지 않는다", () => {
    renderGuard();
    expect(screen.getByTestId("location")).toHaveTextContent("/solve");

    setViewport(768, 1024);
    expect(screen.getByTestId("viewport-guard-overlay")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/solve");

    setViewport(1194, 834);
    expect(screen.queryByTestId("viewport-guard-overlay")).not.toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/solve");
  });
});
