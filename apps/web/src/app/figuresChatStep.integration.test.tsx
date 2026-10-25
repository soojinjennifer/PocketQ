/**
 * Stage 5 WU6 — 웹 CHAT 단계 전달(실제 라우터 + Provider, `VITE_FIGURES_ENABLED=true`). API 모듈 `sendChatMessage`가 받는 인자를 본다.
 * on: 지금 보이는 결과의 단계를 보낸다 — 최종이면 `{ step: null }`, 스테퍼로 2단계에 두면 `{ step: 2 }`. 도형은 보내지 않는다.
 * 장부 §8.16 B-1: 어느 결과의 단계인지(`source`)도 함께 보낸다 — AI 풀이 분기는 "solve", 진단·이어풀기 분기는 "resume".
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FigureSpec } from "shared-types";
import { figureSpecSchema } from "validation";
import { F09_STEPWISE_AUXILIARY } from "validation/fixtures";
import { createFakeSession } from "../test/supabaseTestUtils";

vi.stubEnv("VITE_FIGURES_ENABLED", "true");

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
vi.mock("../shared/api/chatMessage", () => ({ sendChatMessage: vi.fn().mockResolvedValue({ answerMd: "답변" }) }));
// 진단·이어풀기 분기(B-1) — "봐 주세요"(recognizeWork → diagnose) → "내 방법으로 계속"(resume).
vi.mock("../shared/api/recognizeWork", () => ({
  recognizeWork: vi.fn().mockResolvedValue({ workLines: [{ lineNo: 1, latex: "y = x^{2} + 1", isLowConfidence: false }] }),
}));
vi.mock("../shared/api/diagnoseProblem", () => ({
  diagnoseProblem: vi.fn().mockResolvedValue({
    lastValidLine: 1,
    stallLine: null,
    errorTypeLabel: null,
    errorDetail: null,
    relatedConcepts: [],
    reachedAnswerWithNotes: false,
    isLowConfidence: false,
    conceptExplanations: [],
    identifiedMethod: { methodId: "perfect-square", methodName: "완전제곱식" },
    isMethodApplicable: true,
    methodApplicabilityNote: null,
    problemAnswerLatex: "-1",
  }),
}));
vi.mock("../shared/api/resumeProblem", () => ({
  resumeProblemStream: vi.fn(function mockResumeProblemStream() {
    async function* generate() {
      await Promise.resolve();
      yield { type: "chunk" as const, delta: "2번째 줄부터 이어서 진행합니다." };
      yield {
        type: "done" as const,
        result: { mode: "own" as const, methodName: "2번째 줄부터 이어가기", solutionMd: "2번째 줄부터 이어서 진행합니다.", answerMd: "-1", verified: true },
      };
    }
    return generate();
  }),
}));

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
const { sendChatMessage } = await import("../shared/api/chatMessage");
const { routeConfig } = await import("./routes");

beforeEach(() => {
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
  vi.mocked(sendChatMessage).mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function toResultWithFigures(): Promise<void> {
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
  fireEvent.pointerDown(inputCanvas, { pointerId: 1, pointerType: "pen", clientX: 10, clientY: 10, pressure: 0.5, button: 0, buttons: 1 });
  fireEvent.pointerMove(inputCanvas, { pointerId: 1, pointerType: "pen", clientX: 30, clientY: 40, pressure: 0.5, buttons: 1 });
  fireEvent.pointerUp(inputCanvas, { pointerId: 1, pointerType: "pen", clientX: 30, clientY: 40 });
  fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).not.toBeDisabled());
  fireEvent.click(screen.getByRole("button", { name: "아직 못 풀겠어요" }));
  await screen.findByText("풀이 결과");
  await act(async () => {
    solveGate.release();
    await Promise.resolve();
  });
}

async function send(question: string): Promise<void> {
  fireEvent.change(screen.getByLabelText("후속 질문 입력"), { target: { value: question } });
  fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));
  await waitFor(() => expect(screen.getByText("답변")).toBeInTheDocument());
}

describe("CHAT 단계 전달(on)", () => {
  it("최종이면 step null, 스테퍼로 2단계에 두면 step 2 — 도형은 보내지 않는다", async () => {
    await toResultWithFigures();
    await screen.findByText("그림");
    await send("최종 그림 질문");
    expect(vi.mocked(sendChatMessage).mock.calls[0]?.[0]).toEqual({
      problemId: "problem-1",
      question: "최종 그림 질문",
      history: [],
      figureContext: { step: null, source: "solve" },
    });

    const prev = screen.getByRole("button", { name: "이전" });
    fireEvent.click(prev);
    fireEvent.click(prev);
    expect(screen.getByText("2단계 / 3")).toBeInTheDocument();
    await send("H는 왜?");
    const second = vi.mocked(sendChatMessage).mock.calls[1]?.[0];
    expect(second?.figureContext).toEqual({ step: 2, source: "solve" });
    expect(JSON.stringify(second)).not.toContain("fig-f09");
  });

  it("진단·이어풀기 분기에서 보낸 요청 본문에는 source \"resume\"이 있다(B-1)", async () => {
    // 이 사례만 실제 `sendChatMessage`로 fetch 본문을 본다.
    const actual = await vi.importActual<typeof import("../shared/api/chatMessage")>("../shared/api/chatMessage");
    vi.mocked(sendChatMessage).mockImplementation(actual.sendChatMessage);
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        bodies.push(typeof init?.body === "string" ? init.body : "");
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ answerMd: "답변" }) } as Response);
      }),
    );
    try {
      const router = createMemoryRouter(routeConfig, { initialEntries: ["/solve/pencilcanvas"] });
      const { container } = render(
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>,
      );
      const drawOn = async () => {
        const canvas = await waitFor(() => {
          const found = container.querySelector("canvas");
          if (!found) throw new Error("canvas");
          return found;
        });
        fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: "pen", clientX: 10, clientY: 10, pressure: 0.5, button: 0, buttons: 1 });
        fireEvent.pointerMove(canvas, { pointerId: 1, pointerType: "pen", clientX: 30, clientY: 40, pressure: 0.5, buttons: 1 });
        fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: "pen", clientX: 30, clientY: 40 });
      };
      await drawOn();
      fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));
      await waitFor(() => expect(screen.getByRole("button", { name: "아직 못 풀겠어요" })).not.toBeDisabled());
      await drawOn();
      await waitFor(() => expect(screen.getByRole("button", { name: "봐 주세요" })).not.toBeDisabled());
      fireEvent.click(screen.getByRole("button", { name: "봐 주세요" }));
      await screen.findByText("풀이 결과");
      fireEvent.click(screen.getByRole("button", { name: "내 방법으로 계속" }));
      await screen.findByText("2번째 줄부터 이어가기");

      await send("이어풀기 질문");
      expect(vi.mocked(sendChatMessage).mock.calls[0]?.[0]?.figureContext).toEqual({ step: null, source: "resume" });
      expect(bodies).toEqual(['{"question":"이어풀기 질문","history":[],"figureContext":{"step":null,"source":"resume"}}']);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
