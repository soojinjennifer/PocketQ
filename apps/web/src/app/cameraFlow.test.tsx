import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../features/auth/AuthProvider";
import { supabase } from "../shared/lib/supabase/client";
import { createFakeSession } from "../test/supabaseTestUtils";
import { routeConfig } from "./routes";

vi.mock("../shared/lib/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));

vi.mock("../features/camera/captureVideoFrame", () => ({
  captureVideoFrame: vi.fn(() =>
    Promise.resolve(new Blob(["fake-frame"], { type: "image/jpeg" })),
  ),
}));

vi.mock("../shared/lib/image/resizeImageBlob", () => ({
  resizeImageBlob: vi.fn((blob: Blob) => Promise.resolve(blob)),
}));

const stopTrack = vi.fn();
const getUserMedia = vi.fn();

function renderApp(initialEntries: string[]) {
  const router = createMemoryRouter(routeConfig, { initialEntries });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia.mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] });
  Object.defineProperty(globalThis.navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() } },
  });
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: createFakeSession() },
    error: null,
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis.navigator, "mediaDevices");
});

describe("사진 문제 입력 흐름", () => {
  it("촬영 → 미리보기 → 사진 사용 확정 시 /solve가 촬영 이미지를 보여준다", async () => {
    renderApp(["/camera"]);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    const shutterButton = await screen.findByRole("button", { name: "촬영" });

    fireEvent.click(shutterButton);

    await waitFor(() => expect(stopTrack).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: "사진 사용" })).toBeInTheDocument();
    expect(screen.getByAltText("촬영한 문제 미리보기")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "사진 사용" }));

    await waitFor(() => expect(screen.getByAltText("촬영한 문제")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "풀기" })).toBeInTheDocument();
  });

  it("미리보기에서 '재촬영'을 누르면 objectURL을 해제하고 /camera로 돌아가며 상태가 초기화된다", async () => {
    renderApp(["/camera"]);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    const shutterButton = await screen.findByRole("button", { name: "촬영" });
    fireEvent.click(shutterButton);

    await screen.findByRole("button", { name: "재촬영" });
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL");

    fireEvent.click(screen.getByRole("button", { name: "재촬영" }));

    expect(revokeSpy).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByText("문제가 잘 보이게 맞춰 주세요")).toBeInTheDocument(),
    );
    // 재진입 시 촬영 데이터가 초기화되어 셔터를 다시 눌러야 미리보기 버튼이 나타난다.
    expect(screen.queryByRole("button", { name: "재촬영" })).not.toBeInTheDocument();

    revokeSpy.mockRestore();
  });

  it("풀기 버튼은 사진과 체크박스 선택이 모두 있어야 활성화된다", async () => {
    renderApp(["/camera"]);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "촬영" }));
    fireEvent.click(await screen.findByRole("button", { name: "사진 사용" }));

    await waitFor(() => expect(screen.getByAltText("촬영한 문제")).toBeInTheDocument());

    const solveButton = screen.getByRole("button", { name: "풀기" });
    expect(solveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: "풀이해주기" }));

    expect(solveButton).not.toBeDisabled();
  });
});
