import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { useProblemInput } from "../../../features/problem-input/useProblemInput";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";
import { Modal } from "../../../shared/ui/modal/Modal";
import { Spinner } from "../../../shared/ui/spinner/Spinner";

/**
 * `/solve/landscape` — 문제풀기 결과 단계. `/solve/pencilcanvas`의 "풀기" 버튼 클릭 후 진입한다.
 * Pen Rail과 필기 캔버스를 동일하게 포함해서 결과 화면에서도 계속 필기할 수 있게 한다.
 *
 * 결과 표시는 이번 단계 범위 내 최소 구현이다: recognize/solve 스트리밍의 raw 텍스트와 로딩/에러
 * 상태만 보여준다. 마크다운/KaTeX 렌더링·채팅 버블 등 정식 Result Panel은 `docs/COMPONENT_MAP.md`에
 * 아직 확정돼 있지 않아 design-agent 사전 검토가 필요한 별도 단계로 분리했다.
 */
export function SolveLandscapePage() {
  const {
    capturedImage,
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
    submitProblem,
    recognizeStatus,
    solveStatus,
    streamedText,
    resetSubmission,
  } = useProblemInput();

  const problemCardData: ProblemCardData = capturedImage ? { imageUrl: capturedImage.previewUrl } : null;
  const isSubmitting = recognizeStatus === "loading" || solveStatus === "loading";
  const isRecognizeError = recognizeStatus === "error";
  const hasError = isRecognizeError || solveStatus === "error";
  const showResultPanel = isSubmitting || streamedText.length > 0;

  return (
    <div className="bg-bg-canvas solve-no-callout relative min-h-screen">
      <SolveHeader />

      <HandwritingCanvas strokes={strokes} onStartStroke={startStroke} onAddPoint={addPoint} />

      <PenRail activeTool={tool} onSelectTool={setTool} onUndo={undoStroke} onClear={clearStrokes} />

      {/* ProblemCard/(임시)결과 패널/ActionBar는 캔버스와 같은 레벨에서 개별 absolute 요소로 배치한다
          (PenRail/SolveHeader와 동일 패턴). top-[90px]는 SolveNavTabs(top-6=24px) + NavTabBar 실측
          높이(42px) + 24px 여백(24+42+24=90) 유도값이다. 결과 패널은 새 절대 좌표를 만들지 않고
          ProblemCard와 같은 flex 컨테이너 안에 이어붙여서(gap-3, 기존 ProblemCard 내부 간격과 동일 토큰)
          임의 픽셀값 추가 없이 배치한다. */}
      <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10 mx-auto flex w-[448px] max-w-[calc(100%-3rem)] flex-col gap-3">
        <ProblemCard data={problemCardData} />

        {showResultPanel ? (
          <div
            className="bg-bg-elevated max-h-[40vh] overflow-y-auto rounded-[6px] p-5 drop-shadow-[0px_3px_0px_rgba(35,43,56,0.16),0px_10px_20px_rgba(35,43,56,0.14),0px_22px_40px_rgba(35,43,56,0.09)]"
            aria-live="polite"
          >
            {isSubmitting && streamedText.length === 0 ? (
              <Spinner label={recognizeStatus === "loading" ? "문제를 인식하는 중" : "풀이를 생성하는 중"} />
            ) : (
              <p className="text-label-primary whitespace-pre-wrap text-[15px]">{streamedText}</p>
            )}
          </div>
        ) : null}
      </div>

      {/* Action Bar: Figma 실측(node 127:452) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백. iPad Safari 하단 툴바/홈 인디케이터 회피를 위해 세이프에어리어 inset도 더한다. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10 mx-auto w-fit">
        <ActionBar
          hasProblem={hasProblemInput}
          selectedOptionIds={selectedOptionIds}
          onToggleOption={toggleOption}
          onSolve={() => void submitProblem()}
          isSubmitting={isSubmitting}
        />
      </div>

      {hasError ? (
        <Modal
          icon="error"
          title={isRecognizeError ? "문제를 인식하지 못했습니다" : "풀이를 만들지 못했습니다"}
          description={
            isRecognizeError
              ? "사진이나 손글씨가 선명하게 보이는지 확인하고 다시 시도해 주세요."
              : "잠시 후 다시 시도해 주세요."
          }
          actionLabel="확인"
          onAction={resetSubmission}
        />
      ) : null}
    </div>
  );
}
