/**
 * Stage 4 S4-10(jsdom 범위) — `VITE_FIGURES_ENABLED` 미설정이면 서버가 도형을 보내도 결과 화면에 도형 UI가 0이고
 * 도형 슬롯 모듈(`SolutionFigures`)을 import하지도 않는다. 단계 표지가 있는 풀이는 데이터 기준으로 블록이 된다(§17.12).
 * 빌드 산출물의 청크·커널 문자열 0은 장부 §7 빌드 검사로 확인한다.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FigureSpec } from "shared-types";
import { figureSpecSchema } from "validation";
import { F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { createFakeSession } from "../test/supabaseTestUtils";

vi.stubEnv("VITE_FIGURES_ENABLED", "");

const slotImports = vi.hoisted(() => ({ count: 0 }));
vi.mock("../features/figure-visualization/SolutionFigures", async (importOriginal) => {
  slotImports.count += 1;
  return await importOriginal<typeof import("../features/figure-visualization/SolutionFigures")>();
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

describe("플래그 off(S4-10)", () => {
  it("figures 이벤트가 와도 그림 카드·슬롯·스테퍼 0, 슬롯 모듈 import 0, 단계 블록은 표시(강조 없음)", async () => {
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
    await act(async () => {
      solveGate.release();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByText("그림")).toBeNull();
    expect(container.querySelector("[aria-live='off']")).toBeNull();
    expect(screen.queryByRole("group", { name: "그림 단계 이동" })).toBeNull();
    expect(slotImports.count).toBe(0);
    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    expect(container.querySelector("[aria-current='step']")).toBeNull();
    expect(container.textContent).not.toContain("**1단계**");
  });
});
