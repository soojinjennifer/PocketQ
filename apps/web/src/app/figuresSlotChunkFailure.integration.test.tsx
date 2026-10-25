/**
 * Stage 4 재작업 1 H-1 — 플래그 on에서 도형 슬롯 지연 청크(`SolutionFigures`)를 받지 못해도(import reject) 결과 화면 전체가
 * 오류가 되지 않는다: 도형 슬롯만 비고 결과 카드·단계 블록·최종 답·채팅 입력은 유지된다(실제 라우터 + Provider).
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FigureSpec } from "shared-types";
import { figureSpecSchema } from "validation";
import { F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { createFakeSession } from "../test/supabaseTestUtils";

vi.stubEnv("VITE_FIGURES_ENABLED", "true");

const slotImports = vi.hoisted(() => ({ count: 0 }));
// 청크 요청 실패(오프라인·배포 뒤 해시 불일치)를 흉내: 모듈 로드 자체가 reject된다.
vi.mock("../features/figure-visualization/SolutionFigures", () => {
  slotImports.count += 1;
  throw new Error("Failed to fetch dynamically imported module");
});

const commits = vi.hoisted(() => ({ count: 0 }));
vi.mock("../shared/lib/canvas/useDrawingStrokes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../shared/lib/canvas/useDrawingStrokes")>();
  return {
    ...actual,
    useDrawingStrokes: () => {
      const result = actual.useDrawingStrokes();
      return {
        ...result,
        commitStroke: (...args: Parameters<typeof result.commitStroke>) => {
          commits.count += 1;
          result.commitStroke(...args);
        },
      };
    },
  };
});

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
vi.mock("../features/figure-visualization/jsxgraphAdapter", () => ({ loadJsxGraph: () => new Promise(() => {}) }));
vi.mock("../shared/api/recognizeProblem", () => ({
  recognizeProblem: vi.fn().mockResolvedValue({ problemId: "problem-1", recognizedText: "삼각형 ABC", recognizedLatex: null, createdAt: "2026-10-25T00:00:00.000Z" }),
}));
vi.mock("../shared/api/suggestedQuestions", () => ({ getSuggestedQuestions: vi.fn().mockResolvedValue({ questions: [] }) }));
vi.mock("../shared/api/chatMessage", () => ({ sendChatMessage: vi.fn() }));

const SOLUTION_MD = "**1단계** 삼각형을 그립니다.\n**2단계** 수선의 발 H를 구합니다.\n**3단계** 중점 M을 구합니다.";
const F09: FigureSpec = figureSpecSchema.parse(F09_STEPWISE_AUXILIARY.raw);
const solveGate = vi.hoisted(() => ({ release: (): void => undefined }));

vi.mock("../shared/api/solveProblem", () => ({
  solveProblemStream: vi.fn(function mockSolveProblemStream() {
    async function* generate() {
      await Promise.resolve();
      yield { type: "chunk" as const, delta: `## 풀이\n${SOLUTION_MD}\n\n## 최종 답\n-1` };
      yield {
        type: "done" as const,
        result: { conceptMd: null, solutionMd: SOLUTION_MD, answerMd: "-1", conceptTags: [], aiProvider: "openai" as const, aiModel: "m" },
      };
      await new Promise<void>((resolve) => {
        solveGate.release = resolve;
      });
      yield { type: "figures" as const, figures: [F09], stepFigureRefs: [] };
    }
    return generate();
  }),
}));

const { AuthProvider } = await import("../features/auth/AuthProvider");
const { supabase } = await import("../shared/lib/supabase/client");
const { routeConfig } = await import("./routes");

beforeEach(() => {
  commits.count = 0;
  const ctx = { setTransform: vi.fn(), clearRect: vi.fn(), fillRect: vi.fn(), translate: vi.fn(), drawImage: vi.fn(), fill: vi.fn(), fillStyle: "", globalCompositeOperation: "source-over" };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ctx as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(this: HTMLCanvasElement, callback: BlobCallback) {
    callback(new Blob(["x"], { type: "image/jpeg" }));
  });
  vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({ data: { subscription: { id: "s", callback: () => {}, unsubscribe: vi.fn() } } });
  vi.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: createFakeSession({ user_metadata: { grade: "M2" } }) }, error: null });
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  });
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function stroke(target: Element, pointerType: "pen" | "touch", pointerId: number): void {
  fireEvent.pointerDown(target, { pointerId, pointerType, clientX: 10, clientY: 10, pressure: 0.5, button: 0, buttons: 1 });
  fireEvent.pointerMove(target, { pointerId, pointerType, clientX: 30, clientY: 40, pressure: 0.5, buttons: 1 });
  fireEvent.pointerUp(target, { pointerId, pointerType, clientX: 30, clientY: 40 });
}

describe("도형 슬롯 청크 실패(H-1)", () => {
  it("lazy import가 reject돼도 결과 카드·단계 블록·최종 답·채팅 입력이 유지되고 라우터 오류 화면이 뜨지 않는다", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const router = createMemoryRouter(routeConfig, { initialEntries: ["/solve/pencilcanvas"] });
    const { container } = render(
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>,
    );
    const inputCanvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas");
      return found;
    });
    stroke(inputCanvas, "pen", 1);
    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "아직 못 풀겠어요" }));
    await screen.findByText("풀이 결과");
    // done 직후 waiting → 슬롯 지연 로딩 시도(reject), 이어서 figures 수신.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      solveGate.release();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    await waitFor(() => expect(slotImports.count).toBeGreaterThan(0));

    expect(screen.queryByText(/Unexpected Application Error/)).toBeNull();
    expect(screen.getByText("풀이 결과")).toBeInTheDocument();
    expect(screen.getByText("단계별 풀이")).toBeInTheDocument();
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(container.querySelector("textarea, input[type='text']")).not.toBeNull();
    // 도형 슬롯만 비어 있다(래퍼는 남고 내용 없음).
    const slot = container.querySelector("[data-figure-slot]");
    expect(slot).not.toBeNull();
    expect(slot?.childElementCount).toBe(0);
    expect(screen.queryByText("그림")).toBeNull();
    consoleError.mockRestore();
  });
});
