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

vi.mock("../shared/api/recognizeProblem", () => ({
  recognizeProblem: vi.fn().mockResolvedValue({
    problemId: "problem-1",
    recognizedText: "1+1=?",
    recognizedLatex: null,
    createdAt: "2026-08-01T00:00:00.000Z",
  }),
}));

vi.mock("../shared/api/solveProblem", () => ({
  solveProblemStream: vi.fn(function mockSolveProblemStream() {
    async function* generate() {
      await Promise.resolve();
      yield { type: "chunk" as const, delta: "테스트 스트리밍 텍스트" };
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

interface MockContext2D {
  fillStyle: string;
  globalCompositeOperation: string;
  fillCallCount: number;
  setTransform: (...args: number[]) => void;
  clearRect: (...args: number[]) => void;
  fillRect: (...args: number[]) => void;
  translate: (...args: number[]) => void;
  drawImage: (...args: unknown[]) => void;
  fill: () => void;
}

function createMockContext(): MockContext2D {
  const ctx: MockContext2D = {
    fillStyle: "",
    globalCompositeOperation: "source-over",
    fillCallCount: 0,
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    translate: vi.fn(),
    drawImage: vi.fn(),
    fill: () => {
      ctx.fillCallCount += 1;
    },
  };
  return ctx;
}

function renderApp(initialEntries: string[]) {
  const router = createMemoryRouter(routeConfig, { initialEntries });
  return render(
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>,
  );
}

let mockCtx: MockContext2D;

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx = createMockContext();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
    () => mockCtx as unknown as CanvasRenderingContext2D,
  );
  // `exportStrokesToPngBlob`(사진 없이 필기만 있을 때 제출 직전 PNG로 export)이 호출하는 `toBlob`.
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(
    this: HTMLCanvasElement,
    callback: BlobCallback,
  ) {
    callback(new Blob(["fake-png"], { type: "image/png" }));
  });

  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
    data: { subscription: { id: "test-subscription", callback: () => {}, unsubscribe: vi.fn() } },
  });
  vi.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: createFakeSession({ user_metadata: { grade: "M2" } }) },
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function drawOneStroke(canvas: Element) {
  fireEvent.pointerDown(canvas, {
    pointerId: 1,
    pointerType: "pen",
    clientX: 10,
    clientY: 10,
    pressure: 0.5,
  });
  fireEvent.pointerMove(canvas, {
    pointerId: 1,
    pointerType: "pen",
    clientX: 20,
    clientY: 20,
    pressure: 0.5,
  });
  fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 20, clientY: 20 });
}

describe("필기 상태가 /solve/pencilcanvas ↔ /solve/landscape 이동 간 유지된다(P0 회귀)", () => {
  it("pencilcanvas에서 그린 획이 landscape로 이동해도 사라지지 않고 다시 렌더링된다", async () => {
    const { container } = renderApp(["/solve/pencilcanvas"]);

    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });

    drawOneStroke(canvas);

    // 필기만으로도(사진 없이) "풀기" 버튼이 활성화될 수 있어야 한다 — 옵션을 1개 선택한다.
    fireEvent.click(screen.getByRole("checkbox", { name: "풀이해주기" }));
    expect(screen.getByRole("button", { name: "풀기" })).not.toBeDisabled();

    // 이 시점 이후의 fill() 호출만 세면, landscape로 이동한 뒤 새로 마운트되는 canvas가
    // 방금 그린 획을 전달받아 다시 그리는지(=상태가 유지되는지)를 정확히 검증할 수 있다.
    mockCtx.fillCallCount = 0;

    fireEvent.click(screen.getByRole("button", { name: "풀기" }));

    await waitFor(() => expect(mockCtx.fillCallCount).toBeGreaterThan(0));
  });

  it("pencilcanvas에서 선택한 옵션(체크박스)이 landscape에서도 그대로 유지된다", async () => {
    const { container } = renderApp(["/solve/pencilcanvas"]);

    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);

    fireEvent.click(screen.getByRole("checkbox", { name: "개념설명해주기" }));
    expect(screen.getByRole("checkbox", { name: "개념설명해주기" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "풀기" }));

    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: "개념설명해주기" })).toBeChecked(),
    );
  });
});

describe("recognize/solve API 연동(모킹) — 최소 결과 표시", () => {
  it("풀기 클릭 후 landscape 화면에 스트리밍 텍스트가 표시된다", async () => {
    const { container } = renderApp(["/solve/pencilcanvas"]);

    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);
    fireEvent.click(screen.getByRole("checkbox", { name: "풀이해주기" }));

    fireEvent.click(screen.getByRole("button", { name: "풀기" }));

    expect(await screen.findByText("테스트 스트리밍 텍스트")).toBeInTheDocument();
  });

  it("recognize가 실패하면 landscape 화면에 공통 에러 팝업(Modal)이 표시되고, 확인을 누르면 닫혀서 재시도할 수 있다", async () => {
    const { recognizeProblem } = await import("../shared/api/recognizeProblem");
    const { ApiError } = await import("../shared/api/ApiError");
    vi.mocked(recognizeProblem).mockRejectedValueOnce(
      new ApiError("recognition_failed", "문제를 인식할 수 없습니다.", 422),
    );

    const { container } = renderApp(["/solve/pencilcanvas"]);
    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);
    fireEvent.click(screen.getByRole("checkbox", { name: "풀이해주기" }));

    fireEvent.click(screen.getByRole("button", { name: "풀기" }));

    expect(await screen.findByText("문제를 인식하지 못했습니다")).toBeInTheDocument();
    expect(
      screen.getByText("사진이나 손글씨가 선명하게 보이는지 확인하고 다시 시도해 주세요."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.queryByText("문제를 인식하지 못했습니다")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "풀기" })).not.toBeDisabled();
  });
});

describe("문제 입력 없이 /solve/landscape에 직접 진입하면 /camera로 리다이렉트된다", () => {
  it("새로고침/딥링크 시나리오(초기 진입) — 사진/필기 데이터가 없으므로 /camera로 이동한다", async () => {
    renderApp(["/solve/landscape"]);

    await waitFor(() =>
      expect(screen.getByText("문제가 잘 보이게 맞춰 주세요")).toBeInTheDocument(),
    );
  });
});
