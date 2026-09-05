import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, type InitialEntry } from "react-router";
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

vi.mock("../shared/api/chatMessage", () => ({
  sendChatMessage: vi.fn(),
}));

vi.mock("../shared/api/suggestedQuestions", () => ({
  getSuggestedQuestions: vi.fn().mockResolvedValue({ questions: ["다른 방법도 있나요?", "비슷한 문제 더 풀래요"] }),
}));

// 마이페이지 "다시 풀기" 재수화 경로(`POST /api/problems/:id/reopen`). 같은 모듈의 나머지 export도
// `MyPage`가 import하고 있어(라우트 트리 전체를 렌더링한다) 함께 mock해 둔다.
vi.mock("../shared/api/problemHistory", () => ({
  listProblemHistory: vi.fn(),
  getProblemHistoryDetail: vi.fn(),
  reopenProblemHistory: vi.fn().mockResolvedValue({
    problemId: "problem-reopened",
    recognizedText: "저장돼 있던 문제 원문",
    recognizedLatex: null,
    createdAt: "2026-08-16T11:00:00.000Z",
  }),
}));

vi.mock("../shared/api/solveProblem", () => ({
  // 기본 mock: 헤더가 붙은 delta 하나만 오고 바로 done — `parseStreamingSolve`가 헤더 기준으로
  // 파싱하므로, 헤더 없는 raw 텍스트는 더 이상 화면에 그대로 노출되지 않는다(P0 회귀 테스트들은
  // 이 기본 동작만 필요하고, 스트리밍 중간 상태 자체를 검증하는 테스트는 아래에서 별도로
  // `mockImplementationOnce`로 재정의한다).
  solveProblemStream: vi.fn(function mockSolveProblemStream() {
    async function* generate() {
      await Promise.resolve();
      yield { type: "chunk" as const, delta: "## 최종 답\n테스트 스트리밍 텍스트" };
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

function renderApp(initialEntries: InitialEntry[]) {
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

  // jsdom은 `Element.prototype.scrollIntoView`를 아예 구현하지 않는다(속성 자체가 없어
  // `vi.spyOn`이 실패한다) — `SolveLandscapePage`의 채팅 스크롤 앵커
  // (`chatEndRef.current?.scrollIntoView(...)`)가 새 메시지/로딩 시 실제로 호출되는지만
  // 검증하기 위해 직접 할당해서 최소 모킹한다.
  Element.prototype.scrollIntoView = vi.fn();
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

    // 필기만으로도(사진 없이) "문제 인식하기" 버튼이 활성화될 수 있어야 한다(v2.0, ~~SOLVE-1~~
    // 체크박스 옵션 선택은 더 이상 필요 없다).
    expect(screen.getByRole("button", { name: "문제 인식하기" })).not.toBeDisabled();

    // 이 시점 이후의 fill() 호출만 세면, landscape로 이동한 뒤 새로 마운트되는 canvas가
    // 방금 그린 획을 전달받아 다시 그리는지(=상태가 유지되는지)를 정확히 검증할 수 있다.
    mockCtx.fillCallCount = 0;

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    await waitFor(() => expect(mockCtx.fillCallCount).toBeGreaterThan(0));
  });
});

describe("recognize/solve API 연동(모킹) — Result Panel 표시", () => {
  it("풀기 클릭 후 solve가 성공(done)하면 landscape 화면에 정식 Result Panel이 표시된다", async () => {
    const { container } = renderApp(["/solve/pencilcanvas"]);

    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    // done 이벤트 수신 후에는 raw 스트리밍 텍스트 대신 구조화된 Result Panel로 전환된다
    // (recognizeProblem mock의 recognizedText="1+1=?", solveProblemStream mock의 answerMd="답").
    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();
    expect(screen.getByText("1+1=?")).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName.toLowerCase() === "p" && element.textContent === "최종 답 · 답",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("테스트 스트리밍 텍스트")).not.toBeInTheDocument();
  });

  it("풀이 성공 후 AI가 만들어준 제안 질문 pill이 표시되고, 누르면 입력창을 채운다(Final QA MEDIUM-4)", async () => {
    const { getSuggestedQuestions } = await import("../shared/api/suggestedQuestions");
    const { container } = renderApp(["/solve/pencilcanvas"]);

    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);
    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();
    expect(vi.mocked(getSuggestedQuestions)).toHaveBeenCalledWith("problem-1");

    const pill = await screen.findByText("다른 방법도 있나요?");
    expect(screen.getByText("비슷한 문제 더 풀래요")).toBeInTheDocument();

    fireEvent.click(pill);
    expect(screen.getByPlaceholderText("궁금증이 풀릴 때까지 물어보세요")).toHaveValue("다른 방법도 있나요?");
  });

  it("결과 화면에서 '수정'을 누르면 안내 후 필기 캔버스를 지우고 Result Panel을 닫는다(필기 입력, MEDIUM-3)", async () => {
    const { container } = renderApp(["/solve/pencilcanvas"]);

    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);
    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "수정" }));

    expect(await screen.findByText("문제를 다시 입력해주세요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    // 안내를 확인하면 이전 결과는 더 이상 유효하지 않으므로 Result Panel이 사라진다 —
    // 사용자는 캔버스에 새로 그린 뒤 평소처럼 "풀기"를 눌러 다시 제출한다.
    await waitFor(() => expect(screen.queryByText("풀이 결과")).not.toBeInTheDocument());
    expect(screen.queryByText("문제를 다시 입력해주세요")).not.toBeInTheDocument();
  });

  it("done 이전 스트리밍 도중에도 지금까지 도착한 헤더 섹션이 완료 후와 같은 카드 구조로 실시간 표시된다", async () => {
    const { solveProblemStream } = await import("../shared/api/solveProblem");
    let releaseDone: (() => void) | undefined;
    vi.mocked(solveProblemStream).mockImplementationOnce(function mockStreamingSolve() {
      async function* generate() {
        await Promise.resolve();
        yield { type: "chunk" as const, delta: "## 풀이\n1단계: 스트리밍 중간 표시 확인" };
        // done을 테스트가 명시적으로 release할 때까지 보류해서, 스트리밍 중간 상태를 확정적으로
        // 관찰할 수 있게 한다.
        await new Promise<void>((resolve) => {
          releaseDone = resolve;
        });
        yield {
          type: "done" as const,
          result: {
            conceptMd: null,
            solutionMd: "1단계: 스트리밍 중간 표시 확인",
            answerMd: "답",
            conceptTags: [],
            aiProvider: "openai" as const,
            aiModel: "gpt-5.6-terra",
          },
        };
      }
      return generate();
    });

    const { container } = renderApp(["/solve/pencilcanvas"]);
    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    // done 이벤트가 아직 오지 않았지만, "## 풀이" 헤더까지 도착한 내용이 바로 카드에 채워진다.
    expect(await screen.findByText("1단계: 스트리밍 중간 표시 확인")).toBeInTheDocument();
    expect(screen.queryByText("풀이 결과")).not.toBeInTheDocument();

    releaseDone?.();

    // done 수신 후에는 정식 Result Panel로 자연스럽게 전환된다.
    await waitFor(() => expect(screen.getByText("풀이 결과")).toBeInTheDocument());
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

    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("문제를 인식하지 못했습니다")).toBeInTheDocument();
    expect(
      screen.getByText("사진이나 손글씨가 선명하게 보이는지 확인하고 다시 시도해 주세요."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "확인" }));

    expect(screen.queryByText("문제를 인식하지 못했습니다")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "문제 인식하기" })).not.toBeDisabled();
  });
});

describe("후속 질문(채팅) 연동 — problemId 노출 및 chat API 연결", () => {
  it("풀이가 완료되면 recognize가 반환한 problemId로 채팅 API를 호출하고, 응답을 대화 버블로 표시한다", async () => {
    const { sendChatMessage } = await import("../shared/api/chatMessage");
    vi.mocked(sendChatMessage).mockResolvedValue({ answerMd: "이렇게 풀면 됩니다." });

    const { container } = renderApp(["/solve/pencilcanvas"]);
    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);
    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();

    const input = screen.getByLabelText("후속 질문 입력");
    fireEvent.change(input, { target: { value: "왜 이렇게 풀어요?" } });
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    // recognizeProblem mock(파일 상단)의 problemId="problem-1"이 그대로 chat 요청에 쓰인다 —
    // `ProblemInputContext`가 `problemId`를 노출하고 `useChatMessages`가 이를 참조한다는 뜻.
    await waitFor(() =>
      expect(sendChatMessage).toHaveBeenCalledWith({
        problemId: "problem-1",
        question: "왜 이렇게 풀어요?",
        history: [],
      }),
    );

    expect(await screen.findByText("이렇게 풀면 됩니다.")).toBeInTheDocument();
    expect(screen.getByText("왜 이렇게 풀어요?")).toBeInTheDocument();
  });

  it("새 질문을 보내면(로딩 인디케이터 추가 → 응답 도착) 채팅 스크롤 앵커로 자동 스크롤된다", async () => {
    const { sendChatMessage } = await import("../shared/api/chatMessage");
    let resolveChat: ((value: { answerMd: string }) => void) | undefined;
    vi.mocked(sendChatMessage).mockReturnValue(
      new Promise((resolve) => {
        resolveChat = resolve;
      }),
    );

    const { container } = renderApp(["/solve/pencilcanvas"]);
    const canvas = await waitFor(() => {
      const found = container.querySelector("canvas");
      if (!found) throw new Error("canvas not found");
      return found;
    });
    drawOneStroke(canvas);
    fireEvent.click(screen.getByRole("button", { name: "문제 인식하기" }));

    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();

    const scrollIntoViewMock = vi.mocked(Element.prototype.scrollIntoView);
    scrollIntoViewMock.mockClear();

    const input = screen.getByLabelText("후속 질문 입력");
    fireEvent.change(input, { target: { value: "왜 이렇게 풀어요?" } });
    fireEvent.click(screen.getByRole("button", { name: "질문 보내기" }));

    // 사용자 질문 버블이 추가되는 시점(chatMessages.length 변화)에 한 번 스크롤된다.
    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());
    scrollIntoViewMock.mockClear();

    resolveChat?.({ answerMd: "이렇게 풀면 됩니다." });

    // 응답 도착(chatStatus 변화 + 메시지 추가) 시점에도 다시 스크롤된다.
    await waitFor(() => expect(scrollIntoViewMock).toHaveBeenCalled());
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

describe("마이페이지 '다시 풀기' — 사진/필기 없이 재수화 후 곧바로 풀이한다", () => {
  it("resumeProblemId가 담긴 state로 /solve/landscape에 진입하면 reopen → solve가 자동 실행된다", async () => {
    const { reopenProblemHistory } = await import("../shared/api/problemHistory");
    const { solveProblemStream } = await import("../shared/api/solveProblem");

    renderApp([{ pathname: "/solve/landscape", state: { resumeProblemId: "problem-history-1" } }]);

    await waitFor(() =>
      expect(reopenProblemHistory).toHaveBeenCalledWith("problem-history-1"),
    );
    // 가드가 사진/필기가 없다고 /camera로 튕기지 않는다.
    expect(screen.queryByText("문제가 잘 보이게 맞춰 주세요")).not.toBeInTheDocument();

    // reopen이 돌려준 새 problemId로 solve가 이어진다(개념 + 풀이 모두 요청).
    await waitFor(() =>
      expect(solveProblemStream).toHaveBeenCalledWith({
        problemId: "problem-reopened",
        options: { concept: true, solution: true },
      }),
    );

    expect(await screen.findByText("풀이 결과")).toBeInTheDocument();
    expect(screen.getByText("저장돼 있던 문제 원문")).toBeInTheDocument();
  });

  it("재수화가 실패하면 기존 인식 실패 에러 팝업을 그대로 재사용한다", async () => {
    const { reopenProblemHistory } = await import("../shared/api/problemHistory");
    const { ApiError } = await import("../shared/api/ApiError");
    // 404의 실제 `code` 문자열은 계약에 없고 `ErrorCode`에도 없어 타입에 존재하는 코드로 대신한다.
    vi.mocked(reopenProblemHistory).mockRejectedValueOnce(
      new ApiError("internal_error", "기록을 찾을 수 없습니다.", 404),
    );

    renderApp([{ pathname: "/solve/landscape", state: { resumeProblemId: "problem-x" } }]);

    expect(await screen.findByText("문제를 인식하지 못했습니다")).toBeInTheDocument();
  });
});
