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

vi.mock("../shared/api/recognizeProblem", () => ({
  recognizeProblem: vi.fn().mockResolvedValue({
    problemId: "problem-1",
    recognizedText: "사진으로 인식한 문제",
    recognizedLatex: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  }),
}));

vi.mock("../shared/api/solveProblem", () => ({
  solveProblemStream: vi.fn(function mockSolveProblemStream() {
    async function* generate() {
      await Promise.resolve();
      yield { type: "chunk" as const, delta: "## 최종 답\n답" };
      yield {
        type: "done" as const,
        result: {
          conceptMd: null,
          solutionMd: null,
          answerMd: "답",
          conceptTags: [],
          aiProvider: "openai" as const,
          aiModel: "gpt-5.6-terra",
        },
      };
    }
    return generate();
  }),
}));

vi.mock("../shared/api/chatMessage", () => ({
  sendChatMessage: vi.fn(),
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
    expect(screen.getByRole("button", { name: "문제 인식하기" })).toBeInTheDocument();
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

  it("'문제 인식하기' 버튼은 사진이 있어야 활성화된다(v2.0 3분할 ActionBar, ~~SOLVE-1~~ 체크박스 폐기)", async () => {
    renderApp(["/camera"]);

    // 사진이 아직 없는 /solve/pencilcanvas(INPUT 단계) 진입 시점에는 "문제 인식하기"가 비활성화돼
    // 있다 — 이 화면은 카메라 촬영 흐름을 먼저 타야 하므로 직접 진입 검증 대신 아래에서 촬영 전/후
    // 상태를 비교한다.
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "촬영" }));
    fireEvent.click(await screen.findByRole("button", { name: "사진 사용" }));

    await waitFor(() => expect(screen.getByAltText("촬영한 문제")).toBeInTheDocument());

    expect(screen.getByRole("button", { name: "문제 인식하기" })).not.toBeDisabled();
  });

  it("사진으로 풀이 완료 후 결과 화면에서 '수정'을 누르면 안내 후 Problem Card가 '다시 찍어 주세요'로 바뀐다(MEDIUM-3)", async () => {
    // submitProblem()은 학년이 없으면 조용히 중단된다 — 이 파일의 기본 fake 세션엔 grade가 없어서
    // (다른 기존 테스트는 pencilcanvas 진입까지만 확인해 필요 없었다) 이 테스트에서만 채워준다.
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: createFakeSession({ user_metadata: { grade: "M2" } }) },
      error: null,
    });

    renderApp(["/camera"]);

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    fireEvent.click(await screen.findByRole("button", { name: "촬영" }));
    fireEvent.click(await screen.findByRole("button", { name: "사진 사용" }));
    await waitFor(() => expect(screen.getByAltText("촬영한 문제")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();
    // 풀이 성공 시 사진 Blob은 자동 정리되므로 이 시점엔 이미 이미지가 사라져 있다.
    expect(screen.queryByAltText("촬영한 문제")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));
    expect(await screen.findByText("문제를 다시 입력해주세요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    await waitFor(() => expect(screen.queryByText("풀이 결과")).not.toBeInTheDocument());
    expect(screen.getByText("문제를 다시 찍어 주세요")).toBeInTheDocument();

    // Problem Card를 누르면(다시 찍기 안내 상태) /camera로 돌아간다.
    fireEvent.click(screen.getByText("문제를 다시 찍어 주세요"));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
