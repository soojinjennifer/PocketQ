/**
 * Stage 4 WU11 — 계획 §7.2 필기 회귀(실제 라우터 + Provider, `VITE_FIGURES_ENABLED=true`).
 *
 * - 도형이 있는 결과 패널에서 보드·단계 버튼에 pen/touch pointer → `commitStroke` 0회
 * - 캔버스에 pen 획 → 정확히 1회 커밋
 * - 단계 전환·도형 수신 전후 커밋 수 불변
 * - 배치(S4-8): 단계별 풀이 → 그림 → 최종 답
 *
 * 커밋 수는 `useDrawingStrokes`를 실제 구현 그대로 감싸 `commitStroke` 호출만 세어 확인한다.
 * 보드는 JSXGraph 청크를 불러오기 전 상태(보드 상자·컨테이너 div)로 둔다 — 실제 JSXGraph 보드 위 이벤트는
 * 헤드리스 시나리오(장부 §7)에서 확인한다.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FigureSpec } from "shared-types";
import { figureSpecSchema } from "validation";
import { F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { createFakeSession } from "../test/supabaseTestUtils";

vi.stubEnv("VITE_FIGURES_ENABLED", "true");

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

describe("도형 패널과 필기 이벤트 분리(계획 §7.2, 실제 라우터 + Provider)", () => {
  it("보드·단계 버튼 pointer → 커밋 0, 캔버스 pen 획 → 커밋 1, 단계 전환·도형 수신 전후 커밋 불변, 배치는 풀이 → 그림 → 답", async () => {
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
    expect(commits.count).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).not.toBeDisabled());
    fireEvent.click(screen.getByRole("button", { name: "아직 못 풀겠어요" }));
    await screen.findByText("풀이 결과");
    const beforeFigures = commits.count;

    // 도형 수신(done 뒤 figures).
    await act(async () => {
      solveGate.release();
      await Promise.resolve();
    });
    const caption = await screen.findByText("그림");
    expect(commits.count).toBe(beforeFigures);

    // 배치: 단계별 풀이 카드 → 그림 카드 → 최종 답.
    const body = caption.closest("[aria-live='polite']");
    const order = [...(body?.children ?? [])].map((child) =>
      child.textContent?.includes("단계별 풀이") ? "steps" : child.querySelector("section") ? "figures" : child.textContent?.includes("-1") ? "answer" : "other",
    );
    expect(order.indexOf("steps")).toBeLessThan(order.indexOf("figures"));
    expect(order.indexOf("figures")).toBeLessThan(order.indexOf("answer"));

    // 보드 상자·보드 컨테이너에 pen/touch pointer.
    const board = container.querySelector("[id^='figboard']");
    if (!board?.parentElement) throw new Error("board");
    stroke(board, "pen", 11);
    stroke(board, "touch", 12);
    stroke(board.parentElement, "pen", 13);
    // 단계 버튼: pointer + 클릭으로 단계 전환(최종 → 3 → 2).
    const prev = screen.getByRole("button", { name: "이전" });
    stroke(prev, "pen", 14);
    stroke(prev, "touch", 15);
    fireEvent.click(prev);
    fireEvent.click(prev);
    expect(screen.getByText("2단계 / 3")).toBeInTheDocument();
    expect(container.querySelector("li[aria-current='step']")?.textContent).toContain("2단계");
    expect(commits.count).toBe(beforeFigures);

    // 결과 화면의 캔버스에 pen 획 → 정확히 1회 커밋.
    const canvas = container.querySelector("canvas");
    if (!canvas) throw new Error("landscape canvas");
    stroke(canvas, "pen", 21);
    expect(commits.count).toBe(beforeFigures + 1);
  });
});
