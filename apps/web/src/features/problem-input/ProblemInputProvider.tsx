import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router";
import type { Grade } from "shared-types";
import { useSolveStream } from "../ai-solution/useSolveStream";
import { useChatMessages } from "../follow-up-chat/useChatMessages";
import { useRecognizeProblem } from "../problem-recognition/useRecognizeProblem";
import { exportStrokesToPngBlob } from "../../shared/lib/canvas/exportStrokesToPngBlob";
import { useDrawingStrokes } from "../../shared/lib/canvas/useDrawingStrokes";
import { blobToObjectUrl, revokeObjectUrl } from "../../shared/lib/image/objectUrl";
import { toSolveOptions } from "../../shared/lib/solve/solveOptions";
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

  // "풀기" 옵션(개념설명/풀이) 선택 상태
  const [selectedOptionIds, setSelectedOptionIds] = useState<Set<string>>(new Set());
  const toggleOption = useCallback((id: string) => {
    setSelectedOptionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const hasCaptureData = capturedImage !== null;
  const hasProblemInput = hasCaptureData || strokes.length > 0;

  const submitProblem = useCallback(async () => {
    if (!grade) {
      return;
    }

    // "풀기" 클릭 즉시(=새 제출 시작 시점) 이전 문제의 채팅을 초기화한다(PRD CHAT-9). recognize가
    // 진행되는 동안에는 `solveStatus`/`solveResult`가 아직 이전 문제 값 그대로 남아있어(solve()
    // 시작 시점에야 리셋됨, `useSolveStream.ts` 참고) `isResultReady`가 계속 true이고 이전 결과
    // 패널이 그대로 보인다 — 그 사이에도 최소한 채팅만은 섞이지 않도록 여기서 먼저 비운다.
    resetChat();

    const normalized = await normalizeProblemInput({
      photoBlob: capturedImage?.blob ?? null,
      strokes,
      grade,
      exportStrokes: exportStrokesToPngBlob,
    });
    if (!normalized) {
      return;
    }

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

    const solution = await solve({
      problemId: recognizedProblemId,
      options: toSolveOptions(selectedOptionIds),
    });
    // 오너 확정: 풀이 스트리밍이 성공적으로 끝나면 더 이상 필요 없는 사진 Blob 참조를 정리한다
    // (실패 시에는 재시도할 수 있어야 하므로 그대로 유지한다). `solve()`의 반환값으로 바로 판단해서
    // 훅 상태 업데이트의 비동기 타이밍(effect)에 의존하지 않는다.
    if (solution) {
      clearCapturedImage();
    }
  }, [grade, capturedImage, strokes, selectedOptionIds, recognize, solve, clearCapturedImage, resetChat]);

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
      selectedOptionIds,
      toggleOption,
      recognizeStatus,
      problemId,
      recognizedText,
      solveStatus,
      streamedText,
      solveResult,
      submitErrorMessage,
      submitProblem,
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
      selectedOptionIds,
      toggleOption,
      recognizeStatus,
      problemId,
      recognizedText,
      solveStatus,
      streamedText,
      solveResult,
      submitErrorMessage,
      submitProblem,
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
