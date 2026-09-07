import { useState } from "react";
import { useNavigate } from "react-router";
import { exportStrokesToPngBlob } from "../../../shared/lib/canvas/exportStrokesToPngBlob";
import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { useProblemInput } from "../../../features/problem-input/useProblemInput";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { EmptyStateHint } from "../../../features/solve-session/EmptyStateHint";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { RecognizedChip } from "../../../features/solve-session/RecognizedChip";
import { RecognizedProblemPopup } from "../../../features/solve-session/RecognizedProblemPopup";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";
import { Modal } from "../../../shared/ui/modal/Modal";
import { LoadingMark } from "../../../shared/ui/loading-mark/LoadingMark";

/**
 * `/solve/pencilcanvas` — 문제풀기 입력/풀이(WORK) 단계(진입점). Figma 문제풀기 화면의
 * Logo/NavTabBar/PenRail/필기 캔버스/ProblemCard/ActionBar를 조립한다.
 *
 * 두 단계를 같은 라우트에서 조립한다(`docs/FRONTEND_IMPLEMENTATION_PLAN.md` §1.3.1 4b, 오너 확정):
 * - INPUT(`problemId === null`): 문제 사진/필기 입력 캔버스(`strokes`)를 보여준다. "문제 인식하기"
 *   클릭 시 `recognizeOnly()`(recognize만 실행, solve는 아직 호출하지 않는다)를 트리거하고, 이
 *   화면에 그대로 머무른다 — 성공하면 `problemId`가 채워지며 자동으로 WORK 단계로 전환된다.
 * - WORK(`problemId !== null`): 학생이 풀이를 쓰는 두 번째 캔버스(`workStrokes`)로 전환된다.
 *   "아직 못 풀겠어요"는 기존 `solve()`(개념+풀이 전체, 전용 힌트 엔드포인트 없음, 오너 확정)를
 *   재사용하는 `giveUp()`을 호출한 뒤 곧바로 `/solve/landscape`로 이동한다. "봐 주세요"는 1클릭으로
 *   캔버스 인식(`recognizeWork`)과 진단(`diagnose`)을 이어서 실행하고 성공하면 곧바로
 *   `/solve/landscape`로 이동한다(오너 확정, 2026-09: 중간 재확인 단계 제거) — 인식이 틀렸다면
 *   결과 화면(`WorkLineList`)의 "수정" 링크로 이 화면에 돌아와 캔버스를 고쳐 재인식할 수 있다.
 */
export function SolvePencilcanvasPage() {
  const navigate = useNavigate();
  const {
    capturedImage,
    strokes,
    tool,
    setTool,
    startStroke,
    addPoint,
    undoStroke,
    clearStrokes,
    workStrokes,
    workTool,
    setWorkTool,
    startWorkStroke,
    addWorkPoint,
    undoWorkStroke,
    clearWorkStrokes,
    hasProblemInput,
    recognizeOnly,
    giveUp,
    startNewProblem,
    problemId,
    recognizeStatus,
    recognizedText,
    solveStatus,
    workLines,
    recognizeWork,
    recognizeWorkStatus,
    resetRecognizeWork,
    diagnose,
    diagnoseStatus,
    resetDiagnose,
    resetSubmission,
  } = useProblemInput();

  const problemCardData: ProblemCardData = capturedImage
    ? { imageUrl: capturedImage.previewUrl }
    : null;
  const isWorkStage = problemId !== null;
  const hasWorkInput = workStrokes.length > 0 || workLines !== null;
  const isRecognizing = !isWorkStage && recognizeStatus === "loading";
  const isRecognizingWork = isWorkStage && recognizeWorkStatus === "loading";

  // 사진 인식 완료 → "문제가 인식되었습니다" 확인 팝업 → "계속하기"를 눌러야 WORK 캔버스로 전환되는
  // 게이트(Figma 신규, 오너 승인). 필기 입력에는 이 팝업이 없다(Figma에 필기 전용 variant가 없고
  // 팝업 카피가 "촬영한 문제" 사진 전제로 고정돼 있다) — `recognizeOnly()`가 성공한 뒤 WORK
  // 단계로의 전환 자체는 기존과 동일하게 `problemId`가 채워지는 즉시 일어나므로, 필기 입력이면
  // 이 상태가 계속 `false`로 남아 있어 기존과 똑같이 즉시 WORK 캔버스가 보인다.
  const [isRecognizedPreviewOpen, setIsRecognizedPreviewOpen] = useState(false);

  const handleRecognize = async () => {
    // `capturedImage`가 이 호출 시작 시점에 있었는지로 사진 입력 여부를 판단한다(React state
    // setter는 비동기로 반영되므로, `recognizeOnly()`가 내부적으로 갱신하는 `lastInputType`을
    // await 이후 이 클로저에서 읽으면 클릭 시점 값이 그대로 고정돼 있어 값이 갱신되지 않는다 —
    // `normalizeProblemInput`도 동일하게 `capturedImage` 유무로 `inputType`을 결정하므로 완전히
    // 동등한 판단 기준이다).
    const wasPhotoInput = capturedImage !== null;
    const recognizedProblemId = await recognizeOnly();
    if (recognizedProblemId && wasPhotoInput) {
      setIsRecognizedPreviewOpen(true);
    }
  };

  const handleGiveUp = () => {
    void giveUp();
    void navigate("/solve/landscape");
  };

  const handleDiagnose = async () => {
    if (!problemId) {
      return;
    }

    let currentWorkLines = workLines;
    if (currentWorkLines === null) {
      // WORK 단계 캔버스가 빈 상태(획 없음)면 조용히 무시한다(오너 확정, 방어적 처리).
      const imageBlob = await exportStrokesToPngBlob(workStrokes);
      if (!imageBlob) {
        return;
      }
      currentWorkLines = await recognizeWork({ problemId, imageBlob });
      if (currentWorkLines === null) {
        return;
      }
    }

    const diagnosis = await diagnose({ problemId, workLines: currentWorkLines });
    if (diagnosis) {
      void navigate("/solve/landscape");
    }
  };

  // INPUT 단계(recognize) 실패는 이 화면에 그대로 머무르므로(더 이상 landscape로 자동 이동하지
  // 않는다) 에러 팝업도 이 화면에서 보여준다 — landscape가 쓰던 것과 동일한 문구/패턴을 그대로
  // 재사용한다(`resetSubmission`으로 재시도할 수 있게 한다).
  const isRecognizeError = recognizeStatus === "error";
  // WORK 단계(recognizeWork/diagnose) 실패도 이 화면에 머무른 채 보여준다.
  const isWorkError = recognizeWorkStatus === "error" || diagnoseStatus === "error";

  const handleDismissWorkError = () => {
    resetRecognizeWork();
    resetDiagnose();
  };

  return (
    <div className="bg-canvas-texture solve-no-callout relative min-h-screen">
      <SolveHeader />

      {isRecognizedPreviewOpen ? (
        <RecognizedProblemPopup
          recognizedText={recognizedText}
          onContinue={() => setIsRecognizedPreviewOpen(false)}
        />
      ) : (
        <>
          {isWorkStage ? (
            <>
              <HandwritingCanvas
                strokes={workStrokes}
                onStartStroke={startWorkStroke}
                onAddPoint={addWorkPoint}
              />
              <PenRail
                activeTool={workTool}
                onSelectTool={setWorkTool}
                onUndo={undoWorkStroke}
                onClear={clearWorkStrokes}
              />
              {workStrokes.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
                  <EmptyStateHint
                    title="Apple Pencil이나 마우스로 풀어보세요"
                    subtitle="풀이를 쓸 수 있는 부분까지 쓰고 모르겠으면 '아직 못 풀겠어요'를 선택해 보세요"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <>
              <HandwritingCanvas
                strokes={strokes}
                onStartStroke={startStroke}
                onAddPoint={addPoint}
              />
              <PenRail
                activeTool={tool}
                onSelectTool={setTool}
                onUndo={undoStroke}
                onClear={clearStrokes}
              />
            </>
          )}

          {isRecognizing || isRecognizingWork ? (
            <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
              <LoadingMark
                size={48}
                label={isRecognizing ? "문제를 인식하는 중" : "풀이를 인식하는 중"}
              />
            </div>
          ) : null}

          {/* ProblemCard/ActionBar는 캔버스와 같은 레벨에서 개별 absolute 요소로 배치한다(PenRail/
          SolveHeader와 동일 패턴). top-[90px]는 SolveNavTabs(top-6=24px) + NavTabBar 실측 높이
          (42px) + 24px 여백(24+42+24=90) 유도값이다 — 화면 중앙의 넓은 영역을 필기 가능하게
          비워두기 위해 더 이상 <main>으로 전체를 묶어 pointer-events-none 트릭을 쓰지 않는다.
          가로 제약은 Figma "Left and Right"(constraints.horizontal=STRETCH)를 반영해 좌우 고정폭
          트랜스폼(-translate-x-1/2) 대신 inset-x-0 + mx-auto로 구현한다. max-h-[70vh]는 Figma
          실측값이 아니라 유도값 — top-[90px] + ActionBar 하단 예약 공간을 고려해 안전 마진으로
          선택한 값이다. */}
          <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10 mx-auto flex max-h-[70vh] w-[448px] max-w-[calc(100%-3rem)] flex-col gap-[11px] overflow-y-auto">
            {isWorkStage && recognizedText ? (
              <RecognizedChip recognizedText={recognizedText} />
            ) : null}
            {!isWorkStage && problemCardData === null ? (
              <EmptyStateHint
                title="Apple Pencil이나 마우스로 문제를 써 보세요"
                subtitle="문제집을 찍어서 올리려면 왼쪽 도구의 '사진'을 눌러 주세요"
              />
            ) : problemCardData !== null ? (
              <ProblemCard data={problemCardData} />
            ) : null}
          </div>

          {/* Action Bar: Figma 실측(`Solve/Action Bar` 인스턴스 node 256:405, `3-1 · Solve/Pencilcanvas`
          `127:445` 내부) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백. iPad Safari 하단 툴바/홈 인디케이터에 가려지는 문제까지 함께 방지하기 위해
          세이프에어리어 inset도 더해서 실제 화면 여백은 항상 최소 40px 이상이 되도록 한다. */}
          <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10 mx-auto w-fit">
            <ActionBar
              problemId={problemId}
              hasProblemInput={hasProblemInput}
              hasWorkInput={hasWorkInput}
              recognizeStatus={recognizeStatus}
              solveStatus={solveStatus}
              recognizeWorkStatus={recognizeWorkStatus}
              diagnoseStatus={diagnoseStatus}
              onRecognize={() => void handleRecognize()}
              onGiveUp={handleGiveUp}
              onDiagnose={() => void handleDiagnose()}
              onNewProblem={() => {
                setIsRecognizedPreviewOpen(false);
                startNewProblem();
                void navigate("/solve/pencilcanvas");
              }}
            />
          </div>

          {isRecognizeError ? (
            <Modal
              icon="error"
              title="문제를 인식하지 못했습니다"
              description="사진이나 손글씨가 선명하게 보이는지 확인하고 다시 시도해 주세요."
              actionLabel="확인"
              onAction={resetSubmission}
            />
          ) : isWorkError ? (
            <Modal
              icon="error"
              title={
                recognizeWorkStatus === "error"
                  ? "풀이를 인식하지 못했습니다"
                  : "진단하지 못했습니다"
              }
              description="잠시 후 다시 시도해 주세요."
              actionLabel="확인"
              onAction={handleDismissWorkError}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
