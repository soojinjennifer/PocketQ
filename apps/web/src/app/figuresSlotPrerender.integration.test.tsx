/**
 * Stage 4 후속 정리 N-2 — 페이지 `figureSlotContent`의 래퍼 사전 렌더 규칙(실제 라우터 + Provider, 플래그 on).
 * 단계 표지가 있으면 도형 단계가 아닐 때(`idle`·`empty`)도 `null`을 넘겨 `aria-live="off"` 래퍼를 미리 렌더하고,
 * 도형 단계(waiting) → 종료(empty)로 바뀌어도 **같은 래퍼 노드**가 남는다. 표지가 없으면 도형 단계가 끝나면 래퍼가 없다.
 * 결과 패널은 done 뒤에만 보이므로(그때 phase는 이미 waiting) 페이지에서 관찰되는 "도형 단계 아님"은 `empty`다 —
 * `idle`과 같은 분기(`!active`)를 탄다.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeSession } from "../test/supabaseTestUtils";

vi.stubEnv("VITE_FIGURES_ENABLED", "true");

const plan = vi.hoisted(() => ({ withMarkers: true }));

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
const solveGate = vi.hoisted(() => ({ release: (): void => undefined }));

vi.mock("../shared/api/solveProblem", () => ({
  solveProblemStream: vi.fn(function mockSolveProblemStream() {
    async function* generate() {
      await Promise.resolve();
      const md = plan.withMarkers ? SOLUTION_MD : "그래프를 그리고 꼭짓점을 구합니다.";
      yield { type: "chunk" as const, delta: `## 풀이\n${md}\n\n## 최종 답\n-1` };
      yield {
        type: "done" as const,
        result: { conceptMd: null, solutionMd: md, answerMd: "-1", conceptTags: [], aiProvider: "openai" as const, aiModel: "m" },
      };
      // 도형 없이 스트림 종료(서버가 도형을 버림) → figuresPhase waiting → empty.
      await new Promise<void>((resolve) => {
        solveGate.release = resolve;
      });
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

async function toResult(): Promise<HTMLElement> {
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
  return container;
}

describe("페이지 래퍼 사전 렌더 규칙(N-2)", () => {
  it("단계 표지가 있으면 도형 단계가 끝나도(empty) aria-live=off 래퍼가 같은 노드로 남고 내용은 비어 있다", async () => {
    plan.withMarkers = true;
    const container = await toResult();
    const during = await waitFor(() => {
      const node = container.querySelector("[data-figure-slot]");
      if (!node) throw new Error("slot");
      return node;
    });
    await act(async () => {
      solveGate.release();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    const after = container.querySelector("[data-figure-slot]");
    expect(after).not.toBeNull();
    expect(after).toBe(during);
    expect(after?.getAttribute("aria-live")).toBe("off");
    expect(after?.childElementCount).toBe(0);
    // 배치: 단계별 풀이 카드 다음, 최종 답 앞.
    expect(after?.previousElementSibling?.textContent).toContain("단계별 풀이");
    expect(after?.nextElementSibling?.textContent).toContain("-1");
  });

  it("단계 표지가 없으면 도형 단계가 끝난 뒤 래퍼가 없다(기존 DOM)", async () => {
    plan.withMarkers = false;
    const container = await toResult();
    await act(async () => {
      solveGate.release();
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(container.querySelector("[data-figure-slot]")).toBeNull();
    expect(container.querySelector("ol")).toBeNull();
  });
});
