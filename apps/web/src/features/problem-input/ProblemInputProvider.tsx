import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router";
import type { Grade } from "shared-types";
import { useSolveStream } from "../ai-solution/useSolveStream";
import { useChatMessages } from "../follow-up-chat/useChatMessages";
import { useRecognizeProblem } from "../problem-recognition/useRecognizeProblem";
import { exportStrokesToPngBlob } from "../../shared/lib/canvas/exportStrokesToPngBlob";
import { useDrawingStrokes } from "../../shared/lib/canvas/useDrawingStrokes";
import { getSuggestedQuestions } from "../../shared/api/suggestedQuestions";
import { blobToObjectUrl, revokeObjectUrl } from "../../shared/lib/image/objectUrl";
import { ProblemInputContext, type CapturedImage } from "./ProblemInputContext";
import { normalizeProblemInput } from "./normalizeProblemInput";

interface ProblemInputProviderProps {
  /** 로그인한 사용자의 학년. 인증 관련 로직은 `features/auth`(다른 feature) 소관이므로 이 컴포넌트는
   *  직접 조회하지 않고 상위(app 레이어, `ProblemInputRoute`)에서 주입받는다. */
  grade: Grade | null;
}

/**
 * `/solve/pencilcanvas`, `/solve/landscape`, `/camera`, `/camera/preview` 4개 라우트를 감싸는
 * route-scoped Provider. 사진 Blob과 필기 획(strokes) 상태를 메모리로만 보존해 라우트 전환 간
 * 유실되지 않게 한다(이전에는 페이지마다 각자 `useCameraSession`/`useDrawingStrokes`를 호출해서
 * 화면을 옮기면 상태가 사라지는 문제가 있었다).
 */
export function ProblemInputProvider({ grade }: ProblemInputProviderProps) {
  // 사진 입력
  const [capturedImage, setCapturedImageState] = useState<CapturedImage | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const setCapturedImage = useCallback((blob: Blob) => {
    if (previewUrlRef.current) {
      revokeObjectUrl(previewUrlRef.current);
    }
    const previewUrl = blobToObjectUrl(blob);
    previewUrlRef.current = previewUrl;
    setCapturedImageState({ blob, previewUrl });
  }, []);

  // recognize → solve 제출 오케스트레이션 — `clearCapturedImage`가 새 문제 시작 시점마다 채팅도
  // 함께 초기화해야 해서(PRD CHAT-9, 아래 참고) `problemId`/`resetChat`보다 먼저 선언한다.
  const {
    status: recognizeStatus,
    problemId,
    recognizedText,
    errorMessage: recognizeErrorMessage,
    recognize,
    resumeFromHistory: recognizeResumeFromHistory,
    reset: resetRecognize,
  } = useRecognizeProblem();
  const {
    status: solveStatus,
    streamedText,
    result: solveResult,
    errorMessage: solveErrorMessage,
    solve,
    reset: resetSolve,
  } = useSolveStream();

  // 후속 질문(채팅) — 이 Provider가 유일하게 `useChatMessages`를 호출한다(필기 획을
  // `useDrawingStrokes`로 옮긴 것과 동일한 패턴).
  const {
    messages: chatMessages,
    status: chatStatus,
    errorMessage: chatErrorMessage,
    sendMessage: sendChatMessage,
    reset: resetChat,
  } = useChatMessages(problemId);

  const clearCapturedImage = useCallback(() => {
    if (previewUrlRef.current) {
      revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setCapturedImageState(null);
    // 사진 재촬영(`CameraPreviewPage`)/새 촬영 시작(`CameraCapturePage` 마운트)/성공적인 제출 직후
    // (아래 `submitProblem`)가 모두 이 함수를 거친다 — 이전 문제의 대화가 다음 문제로 이어지지
    // 않도록 항상 채팅 상태도 함께 초기화한다(PRD CHAT-9, plan-agent 지적 반영).
    resetChat();
  }, [resetChat]);

  // 컴포넌트가 완전히 해제될 때(예: /solve 서브트리를 완전히 벗어남)도 objectURL을 해제한다.
  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        revokeObjectUrl(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  // 필기 입력 — 이 Provider가 유일하게 `useDrawingStrokes`를 호출한다(필기 유실 버그 근본 수정).
  const {
    strokes,
    tool,
    setTool,
    startStroke,
    addPoint,
    undo: undoStroke,
    clear: clearStrokes,
  } = useDrawingStrokes();

  const hasCaptureData = capturedImage !== null;
  const hasProblemInput = hasCaptureData || strokes.length > 0;

  // 마지막으로 제출한 입력이 사진/필기 중 무엇이었는지 — "수정"(다시 입력) 흐름에서 어느 입력을
  // 초기화할지 판단하는 데 쓴다. 풀이가 성공하면 `capturedImage`는 지워지지만(아래
  // `clearCapturedImage` 호출) 이 값은 남아 있어야 결과 화면에서도 모달리티를 알 수 있다.
  const [lastInputType, setLastInputType] = useState<"photo" | "handwriting" | null>(null);

  // 후속 질문 제안 pill(Final QA MEDIUM-4) — 풀이 성공 직후 별도 AI 호출로 문제/풀이에 맞는 짧은
  // 질문 2개를 받는다. 선택적 보조 UI라 실패해도 조용히 숨긴다(별도 에러 UI 없음, 로딩 상태도
  // 노출하지 않는다 — "간단하게" 요청 반영).
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[] | null>(null);
  const fetchSuggestedQuestions = useCallback(async (targetProblemId: string) => {
    try {
      const response = await getSuggestedQuestions(targetProblemId);
      setSuggestedQuestions(response.questions);
    } catch {
      setSuggestedQuestions(null);
    }
  }, [setSuggestedQuestions]);

  // "수정"(다시 입력) 흐름 전용 플래그. `resetSubmission`/`beginReinput`이 `problemId`/`recognizeStatus`를
  // idle로 되돌리면, 그 시점엔 아직 새 입력(사진/필기)이 없어 `hasProblemInput`도 false다 —
  // `RequireProblemInputGuard`가 이 순간을 "입력 없음"으로 오해해 `/camera`로 튕겨버리면 사용자가
  // Result Panel의 "수정" 안내(Problem Card의 "다시 찍어 주세요" 등)를 보기도 전에 페이지를
  // 떠나게 된다. 이 플래그가 켜져 있는 동안은 가드가 계속 `/solve/landscape` 접근을 허용한다.
  const [isRequestingReinput, setIsRequestingReinput] = useState(false);

  const beginReinput = useCallback(() => {
    resetRecognize();
    resetSolve();
    resetChat();
    setSuggestedQuestions(null);
    setIsRequestingReinput(true);
  }, [resetRecognize, resetSolve, resetChat, setSuggestedQuestions]);

  const submitProblem = useCallback(async () => {
    if (!grade) {
      return;
    }

    // 새 제출이 시작됐으니 "수정" 대기 상태는 끝난다(가드가 이제 `hasProblemInput`/`problemId`
    // 자체로 접근을 판단하면 된다).
    setIsRequestingReinput(false);

    // "풀기" 클릭 즉시(=새 제출 시작 시점) 이전 문제의 채팅을 초기화한다(PRD CHAT-9). recognize가
    // 진행되는 동안에는 `solveStatus`/`solveResult`가 아직 이전 문제 값 그대로 남아있어(solve()
    // 시작 시점에야 리셋됨, `useSolveStream.ts` 참고) `isResultReady`가 계속 true이고 이전 결과
    // 패널이 그대로 보인다 — 그 사이에도 최소한 채팅만은 섞이지 않도록 여기서 먼저 비운다.
    resetChat();
    setSuggestedQuestions(null);

    const normalized = await normalizeProblemInput({
      photoBlob: capturedImage?.blob ?? null,
      strokes,
      grade,
      exportStrokes: exportStrokesToPngBlob,
    });
    if (!normalized) {
      return;
    }
    setLastInputType(normalized.inputType);

    // 훅이 반환하는 값을 바로 쓴다(위 컨텍스트로 노출하는 `problemId` 상태는 아직 이 렌더에 반영되지
    // 않았을 수 있어 비동기 타이밍에 의존하지 않기 위함 — 기존 `submitProblem`의 `solution` 처리와
    // 같은 이유).
    const recognizedProblemId = await recognize({
      imageBlob: normalized.imageBlob,
      inputType: normalized.inputType,
      grade: normalized.grade,
    });
    if (!recognizedProblemId) {
      return;
    }

    // v2.0(SOLVE-1 폐기)부터는 개념설명/풀이를 사용자가 체크박스로 고르지 않는다 — `resumeFromHistory`
    // (아래)와 동일하게 항상 개념 + 풀이를 모두 요청한다.
    const solution = await solve({
      problemId: recognizedProblemId,
      options: { concept: true, solution: true },
    });
    // 오너 확정: 풀이 스트리밍이 성공적으로 끝나면 더 이상 필요 없는 사진 Blob 참조를 정리한다
    // (실패 시에는 재시도할 수 있어야 하므로 그대로 유지한다). `solve()`의 반환값으로 바로 판단해서
    // 훅 상태 업데이트의 비동기 타이밍(effect)에 의존하지 않는다.
    if (solution) {
      clearCapturedImage();
      void fetchSuggestedQuestions(recognizedProblemId);
    }
  }, [
    grade,
    capturedImage,
    strokes,
    recognize,
    solve,
    clearCapturedImage,
    resetChat,
    fetchSuggestedQuestions,
    setSuggestedQuestions,
  ]);

  /**
   * 마이페이지 "다시 풀기" 경로. 사진/필기가 전혀 없는 상태에서 시작하므로 `normalizeProblemInput`을
   * 거치지 않고, 서버에 저장된 인식 결과를 그대로 재수화(`reopen`)한 뒤 곧바로 solve를 실행한다.
   * 그 외에는 `submitProblem`과 동일한 흐름·상태·에러 UI를 공유한다.
   */
  const resumeFromHistory = useCallback(
    async (historyProblemId: string): Promise<boolean> => {
      if (!grade) {
        return false;
      }

      // 새 문제를 시작하는 시점이므로 이전 문제의 대화를 먼저 비운다(PRD CHAT-9, `submitProblem` 동일).
      resetChat();
      setSuggestedQuestions(null);

      const resumedProblemId = await recognizeResumeFromHistory(historyProblemId);
      if (!resumedProblemId) {
        return false;
      }

      // 결정 필요(오너 확인 필요): "다시 풀기"에는 `ActionBar`의 개념설명/풀이 체크박스를 거치는 UX가
      // 없어 확정된 옵션 기준이 없다. 우선 개념 + 풀이를 모두 받는 것을 기본값으로 한다.
      const solution = await solve({
        problemId: resumedProblemId,
        options: { concept: true, solution: true },
      });
      if (solution) {
        void fetchSuggestedQuestions(resumedProblemId);
      }
      return solution !== null;
    },
    [grade, resetChat, recognizeResumeFromHistory, solve, fetchSuggestedQuestions, setSuggestedQuestions],
  );

  const resetSubmission = useCallback(() => {
    resetRecognize();
    resetSolve();
    // 에러 팝업 "확인"(재시도) 경로 — 이전 시도의 채팅(있었다면)도 함께 초기화한다(PRD CHAT-9).
    resetChat();
  }, [resetRecognize, resetSolve, resetChat]);

  const submitErrorMessage = recognizeErrorMessage ?? solveErrorMessage;

  const value = useMemo(
    () => ({
      capturedImage,
      setCapturedImage,
      clearCapturedImage,
      hasCaptureData,
      strokes,
      tool,
      setTool,
      startStroke,
      addPoint,
      undoStroke,
      clearStrokes,
      hasProblemInput,
      lastInputType,
      isRequestingReinput,
      beginReinput,
      recognizeStatus,
      problemId,
      recognizedText,
      solveStatus,
      streamedText,
      solveResult,
      suggestedQuestions,
      submitErrorMessage,
      submitProblem,
      resumeFromHistory,
      resetSubmission,
      chatMessages,
      chatStatus,
      chatErrorMessage,
      sendChatMessage,
      resetChat,
    }),
    [
      capturedImage,
      setCapturedImage,
      clearCapturedImage,
      hasCaptureData,
      strokes,
      tool,
      setTool,
      startStroke,
      addPoint,
      undoStroke,
      clearStrokes,
      hasProblemInput,
      lastInputType,
      isRequestingReinput,
      beginReinput,
      recognizeStatus,
      problemId,
      recognizedText,
      solveStatus,
      streamedText,
      solveResult,
      suggestedQuestions,
      submitErrorMessage,
      submitProblem,
      resumeFromHistory,
      resetSubmission,
      chatMessages,
      chatStatus,
      chatErrorMessage,
      sendChatMessage,
      resetChat,
    ],
  );

  return (
    <ProblemInputContext.Provider value={value}>
      <Outlet />
    </ProblemInputContext.Provider>
  );
}
