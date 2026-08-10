import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet } from "react-router";
import type { Grade } from "shared-types";
import { useSolveStream } from "../ai-solution/useSolveStream";
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

  const clearCapturedImage = useCallback(() => {
    if (previewUrlRef.current) {
      revokeObjectUrl(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setCapturedImageState(null);
  }, []);

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

  // recognize → solve 제출 오케스트레이션
  const {
    status: recognizeStatus,
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

  const submitProblem = useCallback(async () => {
    if (!grade) {
      return;
    }

    const normalized = await normalizeProblemInput({
      photoBlob: capturedImage?.blob ?? null,
      strokes,
      grade,
      exportStrokes: exportStrokesToPngBlob,
    });
    if (!normalized) {
      return;
    }

    const problemId = await recognize({
      imageBlob: normalized.imageBlob,
      inputType: normalized.inputType,
      grade: normalized.grade,
    });
    if (!problemId) {
      return;
    }

    const solution = await solve({ problemId, options: toSolveOptions(selectedOptionIds) });
    // 오너 확정: 풀이 스트리밍이 성공적으로 끝나면 더 이상 필요 없는 사진 Blob 참조를 정리한다
    // (실패 시에는 재시도할 수 있어야 하므로 그대로 유지한다). `solve()`의 반환값으로 바로 판단해서
    // 훅 상태 업데이트의 비동기 타이밍(effect)에 의존하지 않는다.
    if (solution) {
      clearCapturedImage();
    }
  }, [grade, capturedImage, strokes, selectedOptionIds, recognize, solve, clearCapturedImage]);

  const resetSubmission = useCallback(() => {
    resetRecognize();
    resetSolve();
  }, [resetRecognize, resetSolve]);

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
      solveStatus,
      streamedText,
      solveResult,
      submitErrorMessage,
      submitProblem,
      resetSubmission,
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
      solveStatus,
      streamedText,
      solveResult,
      submitErrorMessage,
      submitProblem,
      resetSubmission,
    ],
  );

  return (
    <ProblemInputContext.Provider value={value}>
      <Outlet />
    </ProblemInputContext.Provider>
  );
}
