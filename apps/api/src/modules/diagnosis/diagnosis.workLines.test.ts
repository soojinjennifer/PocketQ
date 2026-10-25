/**
 * Stage 5 WU2c(계획 §12.2) — 진단 라우터가 진단에 쓴 줄을 `diagnosedWorkLines`로 남긴다.
 * 진단 응답·resume 프롬프트(어댑터 요청)·priorWork는 바이트 단위로 그대로다(이 줄은 resume 저장의 workContext 출처로만 쓴다).
 * 비교 방법: 같은 입력을 `setDiagnosedWorkLines`를 무력화한 실행(= 변경 전 동작)과 실제 실행으로 각각 돌려 문자열을 비교한다.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { GenerateFiguresRequest, ResumeRequest } from "../../infrastructure/ai/adapter";

const getUserMock = vi.fn();
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ auth: { getUser: getUserMock } })) }));

const { createApp } = await import("../../app");
const { FakeLLMAdapter } = await import("../../infrastructure/ai/fake-adapter");
const { OpenAIAdapter } = await import("../../infrastructure/ai/openai-adapter");
const { inMemoryProblemStore } = await import("../../infrastructure/store/inMemoryProblemStore");
const { createResumeRouter } = await import("../resume/resume.router");
const express = (await import("express")).default;

const AUTH = { Authorization: "Bearer t" };
const PID = "12121212-1212-4121-8121-121212121212";
// 인식 원본(workLines)과 학생이 고쳐 진단에 보낸 줄이 다르다.
const OCR_LINES = [
  { lineNo: 1, latex: "y = x^{2} - 4x + 3", isLowConfidence: false },
  { lineNo: 2, latex: "y = (x - 2)^{2} - l", isLowConfidence: true },
];
const EDITED = [
  { lineNo: 1, latex: "y = x^{2} - 4x + 3" },
  { lineNo: 2, latex: "y = (x - 2)^{2} - 1" },
];

function cas() {
  return {
    verifyWorkLines: vi.fn(() => Promise.resolve([{ lineNo: 1, isValid: true }, { lineNo: 2, isValid: false }])),
    verifyFinalAnswer: vi.fn(() => Promise.resolve({ verified: true })),
  };
}

function seed(): void {
  inMemoryProblemStore.clear();
  inMemoryProblemStore.set({
    problemId: PID,
    userId: "user-1",
    grade: "M2",
    problem: { recognizedText: "이차함수의 최솟값", recognizedLatex: null },
    createdAt: "2026-10-25T00:00:00.000Z",
    workLines: OCR_LINES,
  });
}

async function run(disableNewLine: boolean) {
  seed();
  const restore = disableNewLine
    ? vi.spyOn(inMemoryProblemStore, "setDiagnosedWorkLines").mockImplementation(() => undefined)
    : null;
  const adapter = new FakeLLMAdapter();
  const resumeSpy = vi.spyOn(adapter, "resume");
  const figureSpy = vi.spyOn(adapter, "generateFigures");
  const diagnose = await request(createApp(adapter, cas())).post(`/api/problems/${PID}/diagnose`).set(AUTH).send({ workLines: EDITED });
  const resumeApp = express();
  resumeApp.use(express.json());
  resumeApp.use("/api", createResumeRouter(adapter, cas(), { figuresEnabled: true, keepAliveMs: 5, resumePersistEnabled: false }));
  const resume = await request(resumeApp).post(`/api/problems/${PID}/resume`).set(AUTH).send({ mode: "own" });
  restore?.mockRestore();
  const resumeRequest = resumeSpy.mock.calls[0]?.[0] as ResumeRequest;
  const figureRequest: GenerateFiguresRequest | undefined = figureSpy.mock.calls[0]?.[0];
  return {
    diagnoseText: diagnose.text,
    resumeText: resume.text,
    resumeRequest: JSON.stringify(resumeRequest),
    priorWork: JSON.stringify(figureRequest?.priorWork ?? null),
    stored: inMemoryProblemStore.get(PID),
  };
}

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: "user-1", user_metadata: { grade: "M2" } } }, error: null });
});

describe("WU2c diagnosedWorkLines", () => {
  it("진단에 보낸 줄(isLowConfidence false)을 저장하고 인식 원본 workLines는 그대로 둔다", async () => {
    const { stored } = await run(false);
    expect(stored?.diagnosedWorkLines).toEqual(EDITED.map((l) => ({ ...l, isLowConfidence: false })));
    expect(stored?.workLines).toEqual(OCR_LINES);
  });

  it("진단 응답·resume SSE·resume 어댑터 요청·priorWork가 변경 전 동작과 바이트 동일", async () => {
    const before = await run(true);
    const after = await run(false);
    expect(before.stored?.diagnosedWorkLines).toBeUndefined();
    expect(after.diagnoseText).toBe(before.diagnoseText);
    expect(after.resumeText).toBe(before.resumeText);
    expect(after.resumeRequest).toBe(before.resumeRequest);
    expect(after.priorWork).toBe(before.priorWork);
    // resume 프롬프트 입력은 여전히 인식 원본 줄이다.
    expect(JSON.parse(after.resumeRequest).workLines).toEqual(OCR_LINES);
  });

  it("OpenAI resume 요청 본문도 diagnosedWorkLines와 무관하다(같은 ResumeRequest → 같은 본문)", async () => {
    const createMock = vi.fn(() =>
      Promise.resolve(
        (async function* stream() {
          await Promise.resolve();
          yield { type: "response.completed" };
        })(),
      ),
    );
    const adapter = new OpenAIAdapter("m", "k");
    (adapter as unknown as { client: { responses: { create: typeof createMock } } }).client = { responses: { create: createMock } };
    const { resumeRequest } = await run(false);
    const req = JSON.parse(resumeRequest) as ResumeRequest;
    for await (const event of adapter.resume(req)) void event;
    const body = JSON.stringify(createMock.mock.calls[0]);
    expect(body).toContain("y = (x - 2)^{2} - l");
    expect(body).not.toContain("y = (x - 2)^{2} - 1\"");
  });
});
