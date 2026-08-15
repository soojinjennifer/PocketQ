import { useState } from "react";
import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { AnswerBox } from "../../../features/ai-solution/AnswerBox";
import { parseStreamingSolve } from "../../../features/ai-solution/parseStreamingSolve";
import { RecognizedProblemBar } from "../../../features/ai-solution/RecognizedProblemBar";
import { ResultCard } from "../../../features/ai-solution/ResultCard";
import { ResultPanel } from "../../../features/ai-solution/ResultPanel";
import { ResultPanelShell, type ResultPanelWidth } from "../../../features/ai-solution/ResultPanelShell";
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
 * 결과 표시: 제출을 시작한 순간(`isSubmitting || streamedText.length > 0`)부터 성공
 * (`isResultReady`)까지 `ResultPanelShell` 하나를 항상 같은 DOM 요소로 유지한 채, 그 안의
 * 콘텐츠만 로딩용 ↔ 완료용(`ResultPanel`)으로 전환한다(오너 iPad 실사용 중 발견: 로딩 박스와
 * Result Panel이 서로 다른 위치·스타일에 각각 마운트되어 "다른 곳에서 갑자기 나타나는" 것처럼
 * 보이던 문제 수정, 2026-08-14). 셸을 두 조건부 블록으로 나누지 않는 이유는 그렇게 하면 React가
 * 서로 다른 엘리먼트로 인식해 성공 시점에 마운트 애니메이션이 다시 재생되기 때문이다.
 *
 * 로딩 중 콘텐츠도 완료 후와 같은 카드 구조를 쓴다 — `streamedText`(누적 raw 텍스트)를 매 렌더마다
 * `parseStreamingSolve`로 헤더 기준 파싱해서, 아직 스트리밍 중이라도 도착한 섹션(관련 개념/단계별
 * 풀이/최종 답)만큼 `ResultCard`/`AnswerBox`를 그대로 채워 넣는다. 완료 시점에 구조화된
 * `ResultPanel`로 전환되어도 같은 컴포넌트들이 같은 자리에 있으므로 "깜빡이며 바뀌는" 느낌이 없다
 * (오너 요청, 2026-08-14). 헤더가 하나도 도착하지 않았을 때만 Spinner를 보여준다.
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
    recognizedText,
    solveStatus,
    streamedText,
    solveResult,
    resetSubmission,
  } = useProblemInput();

  const problemCardData: ProblemCardData = capturedImage ? { imageUrl: capturedImage.previewUrl } : null;
  const isSubmitting = recognizeStatus === "loading" || solveStatus === "loading";
  const isRecognizeError = recognizeStatus === "error";
  const hasError = isRecognizeError || solveStatus === "error";
  const isResultReady = solveStatus === "success" && solveResult !== null;
  // 제출을 시작한 시점부터 성공까지 `ResultPanelShell`을 항상 같은 DOM 요소로 유지한다(위 JSDoc
  // 참고) — 로딩용/완료용을 별개의 조건부 렌더링으로 나누지 않는다.
  const isPanelVisible = isSubmitting || streamedText.length > 0 || isResultReady;
  // 로딩 중에도 완료 후와 같은 카드 구조로 채워 넣기 위한 실시간 파싱(위 JSDoc 참고).
  // `isResultReady`가 되면 이 값은 더 이상 렌더링에 쓰이지 않는다.
  const { conceptSoFar, stepsSoFar, answerSoFar } = parseStreamingSolve(streamedText);
  const hasAnyStreamedSection = conceptSoFar !== null || stepsSoFar !== null || answerSoFar !== null;

  // `ResultPanelShell` 좌측 `ResultPanelResizeHandle`의 폭 상태. 새 제출이 시작돼 셸이 새로
  // 마운트되는 시점(`isPanelVisible`이 false→true로 바뀔 때)마다 `"default"`로 리셋해서, 이전
  // 문제에서 넓혀본 상태가 다음 문제까지 이어지지 않게 한다. `useEffect` 대신 React 공식
  // "prop이 바뀔 때 state 조정" 패턴(렌더 중 이전 값과 비교해 즉시 setState)을 사용한다 —
  // effect 안에서 setState하면 불필요한 커밋이 한 번 더 발생한다.
  const [panelWidth, setPanelWidth] = useState<ResultPanelWidth>("default");
  const [prevIsPanelVisible, setPrevIsPanelVisible] = useState(isPanelVisible);
  if (isPanelVisible !== prevIsPanelVisible) {
    setPrevIsPanelVisible(isPanelVisible);
    if (isPanelVisible) {
      setPanelWidth("default");
    }
  }

  return (
    <div className="bg-bg-canvas solve-no-callout relative min-h-screen">
      <SolveHeader />

      <HandwritingCanvas strokes={strokes} onStartStroke={startStroke} onAddPoint={addPoint} />

      <PenRail activeTool={tool} onSelectTool={setTool} onUndo={undoStroke} onClear={clearStrokes} />

      {/* Result Panel(39:28)은 화면 우측에 독립 도킹된 패널이다. design-agent가 Figma(`38:21`)를
          재실측한 결과, Default 상태에서도 Action Bar 우측 끝이 Result Panel 좌측 끝과 10px
          겹치는 것으로 나타나(오너 명시 확인, 2026-08-14) — Figma 원안 자체가 "겹치지 않게 우측
          공간을 예약"하는 구조가 아니라 "겹쳐도 z-index로 위에 얹는" 구조다. 이에 따라 ProblemCard/
          ActionBar는 더 이상 우측 예약폭(pr-*)을 두지 않고 화면 전체 폭 기준으로 정상
          중앙정렬하며, `ResultPanelShell`이 더 높은 z-index로 그 위에 얹혀 필요하면 겹친다(아래
          `ResultPanelShell`의 z-20 참고). */}

      {/* ProblemCard는 캔버스와 같은 레벨의 독립 absolute 요소로 배치한다(PenRail/SolveHeader와 동일
          패턴). top-[90px]는 SolveNavTabs(top-6=24px) + NavTabBar 실측 높이(42px) + 24px 여백
          (24+42+24=90) 유도값이다(기존 값 유지). 폭/정렬(448px, mx-auto)도 기존 값을 그대로
          재사용한다 — 화면 전체 폭 기준 중앙정렬이며 우측 예약폭은 없다(위 코멘트 참고, Result
          Panel과 겹칠 수 있음). 로딩 중 표시는 더 이상 이 컬럼에 두지 않고 우측
          `ResultPanelShell`로 통합했다(위 JSDoc 참고) — ProblemCard만 남는다. */}
      <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10">
        <div className="mx-auto flex w-[448px] max-w-[calc(100%-3rem)] flex-col gap-3">
          <ProblemCard data={problemCardData} />
        </div>
      </div>

      {isPanelVisible ? (
        <ResultPanelShell
          width={panelWidth}
          onExtend={() => setPanelWidth("extend")}
          onBackToDefault={() => setPanelWidth("default")}
          onClose={() => setPanelWidth("close")}
          onOpen={() => setPanelWidth("default")}
        >
          {isResultReady && solveResult ? (
            <ResultPanel
              category={solveResult.conceptTags[0]}
              recognizedText={recognizedText ?? ""}
              conceptMd={solveResult.conceptMd}
              solutionMd={solveResult.solutionMd}
              answerMd={solveResult.answerMd}
            />
          ) : (
            <div
              className="flex flex-1 flex-col gap-3 overflow-y-auto p-5 touch-pan-y"
              aria-live="polite"
            >
              {hasAnyStreamedSection ? (
                <>
                  {recognizedText ? <RecognizedProblemBar recognizedText={recognizedText} /> : null}
                  {conceptSoFar ? <ResultCard kind="concept" body={conceptSoFar} /> : null}
                  {stepsSoFar ? <ResultCard kind="steps" body={stepsSoFar} /> : null}
                  {answerSoFar ? <AnswerBox answerMd={answerSoFar} /> : null}
                </>
              ) : (
                <Spinner label={recognizeStatus === "loading" ? "문제를 인식하는 중" : "풀이를 생성하는 중"} />
              )}
            </div>
          )}
        </ResultPanelShell>
      ) : null}

      {/* Action Bar: Figma 실측(node 127:452) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백. iPad Safari 하단 툴바/홈 인디케이터 회피를 위해 세이프에어리어 inset도 더한다.
          이전에는 좌측(캔버스) 영역 안에서만 중앙정렬되도록 우측 예약폭(pr-*)을 뒀지만,
          design-agent의 Figma(`38:21`) 재실측 결과 Default 상태에서도 Result Panel과 10px
          겹치는 것이 원안에 가까워(오너 명시 확인, 2026-08-14) 예약을 제거하고 화면 전체 폭
          기준으로 정상 중앙정렬한다 — 필요하면 `ResultPanelShell`(z-20)이 위에 겹쳐 보인다. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10">
        <div className="mx-auto w-fit">
          <ActionBar
            hasProblem={hasProblemInput}
            selectedOptionIds={selectedOptionIds}
            onToggleOption={toggleOption}
            onSolve={() => void submitProblem()}
            isSubmitting={isSubmitting}
          />
        </div>
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
