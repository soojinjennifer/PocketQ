import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { exportStrokesToPngBlob } from "../../../shared/lib/canvas/exportStrokesToPngBlob";
import {
  HandwritingCanvas,
  type HandwritingCanvasHandle,
} from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { SolveScroll } from "../../../features/drawing-canvas/SolveScroll";
import { useProblemInput } from "../../../features/problem-input/useProblemInput";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { EmptyStateHint } from "../../../features/solve-session/EmptyStateHint";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { RecognizedChip } from "../../../features/solve-session/RecognizedChip";
import { RecognizedProblemPopup } from "../../../features/solve-session/RecognizedProblemPopup";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";
import { useBodyClass } from "../../../shared/lib/dom/useBodyClass";
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
 *
 * 마이페이지 History Row "다시풀기" 버튼(마이페이지 개선 4번)으로도 이 화면에 진입할 수 있다 —
 * `location.state.resumeToWorkProblemId`가 있으면 사진/필기 재입력 없이 `resumeToWork()`로 곧바로
 * WORK 단계까지 재수화한다(아래 effect 참고, `SolveLandscapePage`의 `resumeProblemId` 처리와 동일한
 * 패턴). solve()는 호출하지 않으므로 "봐 주세요"/"아직 못 풀겠어요"를 눌러야 다음 단계로 넘어간다.
 */
export function SolvePencilcanvasPage() {
  // 이 화면 자체엔 현재 텍스트 입력창이 없지만, `/solve/landscape`와 동일하게 PenRail/SolveScroll을
  // absolute로 배치한다 — 이 그룹이 iOS 키보드/받아쓰기 툴바로 인한 body의 scroll-into-view에
  // 함께 끌려 올라가는 것을 막기 위해 두 화면에 동일하게 방어적으로 적용한다(`shared/styles/
  // textures.css`의 `.solve-viewport-lock` JSDoc 참고).
  useBodyClass("solve-viewport-lock");

  const navigate = useNavigate();
  const location = useLocation();
  const {
    capturedImage,
    lastInputType,
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
    resumeToWork,
    problemId,
    recognizeStatus,
    recognizedText,
    dailyUsageCount,
    dailyUsageLimit,
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
  // "봐 주세요" 1클릭이 캔버스 인식(recognizeWork)과 진단(diagnose)을 순서대로 실행하는 동안(오너
  // 확정 흐름, /solve/landscape로 이동하기 전까지 이 화면에 머무른다) 로딩 표시가 recognizeWork
  // 완료 시점에 사라지고 diagnose가 끝날 때까지는 아무 표시가 없어 멈춘 것처럼 보이는 버그였다
  // (오너 실기기 보고) — diagnose 로딩도 함께 표시해 결과가 나오기 직전까지 로딩이 끊기지 않게 한다.
  const isDiagnosing = isWorkStage && diagnoseStatus === "loading";

  // 마이페이지 History Row "다시풀기" 버튼(마이페이지 개선 4번)으로 진입한 경우
  // (`location.state.resumeToWorkProblemId`), 사진/필기 재입력 없이 저장된 인식 결과를 재수화해
  // 곧바로 WORK 단계로 전환한다. 마이페이지는 `ProblemInputProvider` 트리 밖이라 상태를 직접 넘길
  // 수 없어서, 의도만 라우터 state로 전달받아 Provider 안쪽인 이 페이지에서 트리거한다
  // (`SolveLandscapePage`의 `resumeProblemId` 처리와 동일한 패턴).
  const resumeToWorkAttemptedRef = useRef(false);
  useEffect(() => {
    const resumeToWorkProblemId = (
      location.state as { resumeToWorkProblemId?: string } | null
    )?.resumeToWorkProblemId;
    if (!resumeToWorkProblemId || resumeToWorkAttemptedRef.current || problemId !== null) {
      return;
    }
    resumeToWorkAttemptedRef.current = true;
    void resumeToWork(resumeToWorkProblemId);
    // 소비한 state는 즉시 비운다(새로고침 시 중복 재수화 방지, 뒤로가기 시 이상 동작 방지).
    void navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, problemId, resumeToWork]);

  // 사진 인식 완료 → "문제가 인식되었습니다" 확인 팝업 → "계속하기"를 눌러야 WORK 캔버스로 전환되는
  // 게이트(Figma 신규, 오너 승인). 필기 입력에는 이 팝업이 없다(Figma에 필기 전용 variant가 없고
  // 팝업 카피가 "촬영한 문제" 사진 전제로 고정돼 있다) — `recognizeOnly()`가 성공한 뒤 WORK
  // 단계로의 전환 자체는 기존과 동일하게 `problemId`가 채워지는 즉시 일어나므로, 필기 입력이면
  // 이 상태가 계속 `false`로 남아 있어 기존과 똑같이 즉시 WORK 캔버스가 보인다.
  const [isRecognizedPreviewOpen, setIsRecognizedPreviewOpen] = useState(false);

  // SolveScroll(스크롤 인디케이터, WORK 단계 전용) 배선. `workCanvasRef`로 WORK 캔버스의
  // `scrollToRatio`/`isPenActive`를 호출하고, `onScrollRatioChange`로 받은 현재 비율을
  // `workScrollRatio`에 반영해 가장 가까운 마커를 강조한다.
  const workCanvasRef = useRef<HandwritingCanvasHandle>(null);
  const [workScrollRatio, setWorkScrollRatio] = useState(0);
  // 풀이가 짧아 스크롤할 필요가 없을 때 `SolveScroll`을 없애지 않고 비활성화만 하기 위한 상태
  // (오너 요청) — `HandwritingCanvas`의 `onScrollableChange`로 콘텐츠 성장/축소 시마다 갱신된다.
  const [isWorkScrollable, setIsWorkScrollable] = useState(false);

  // PenRail+SolveScroll 그룹화(오너 iPad 실기기 보고 수정): 이전에는 PenRail이 스스로
  // `top-1/2 -translate-y-1/2`로 화면 세로 중앙에 오고, SolveScroll은 그 실제 렌더링 위치를 측정해
  // 아래 16px에 배치했다 — PenRail *혼자만* 중앙에 오고 SolveScroll이 그 아래로 늘어지는 구조라
  // 뷰포트가 짧으면 SolveScroll이 화면 밖으로 잘렸다. 이제 `PenRail`을 `positioned={false}`로
  // 렌더링해 위치 클래스를 빼고, 이 페이지가 소유한 그룹 컨테이너 하나에 PenRail+SolveScroll을
  // `flex flex-col gap-4`(16px)로 함께 넣어 그룹 전체를 세로 중앙 정렬한다 — CSS만으로 배치되므로
  // 더 이상 ref로 실제 렌더링 위치를 측정할 필요가 없다(RecognizedChip도 §3.32 이후 PenRail 기준
  // 측정 없이 화면 상단 중앙에 정적으로 고정되어, 이 페이지에는 더 이상 위치 측정용 ref가 없다).

  // RecognizedChip 확장 토글(work-order 2차, 오너 확정). 위치는 축소/확장 모두 동일하다 — 화면
  // 상단 중앙(Figma `267:607`/`38:21` 두 프레임 모두 동일 좌표, x=400 y=98, 1194×834 프레임 기준,
  // 오너 확정 — iPad 실기기에서 "PenRail 우측 고정"안을 확인한 뒤 철회 요청). 항상 같은 DOM
  // 위치(아래 `top-[90px]` 컨테이너)에 렌더링하고 `isExpanded` prop만 바꾸므로 별도의 autoFocus
  // 플래그 없이도 포커스가 자연히 유지된다. WORK 단계를 벗어나면(예: "새 문제") 다음 WORK 진입 시
  // 항상 축소 상태로 시작하도록 초기화한다. 이펙트에서 setState를 호출하면 추가 렌더 패스가
  // 생기므로(react-hooks/set-state-in-effect), 렌더링 중 이전 값과 비교해 바로 조정하는 React
  // 공식 패턴("Adjusting state when a prop changes")을 쓴다.
  const [isRecognizedChipExpanded, setIsRecognizedChipExpanded] = useState(false);
  const [prevIsWorkStage, setPrevIsWorkStage] = useState(isWorkStage);
  if (isWorkStage !== prevIsWorkStage) {
    setPrevIsWorkStage(isWorkStage);
    if (!isWorkStage) {
      setIsRecognizedChipExpanded(false);
    }
  }

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

  // 소프트 캡(하루 10회, 매일 자정 UTC 리셋, 오너 확정 — 이번 범위엔 접근 차단/트라이얼 로직은
  // 포함하지 않는다) 안내. 서버는 절대 인식을 막지 않고 오늘 누적 횟수만 응답에 실어 보내므로,
  // 여기서도 차단 없이 "확인" 버튼 하나짜리 가벼운 정보성 안내만 한 번 보여준다.
  // Figma 없음(운영/비즈니스 성격 안내) — 추후 디자인 필요 시 갱신.
  const [isDailyUsageWarningOpen, setIsDailyUsageWarningOpen] = useState(false);
  // 같은 세션(이 페이지가 마운트돼 있는 동안)에 recognize를 여러 번 호출해도 한 번만 보여준다 —
  // 닫은 뒤 다시 뜨면 성가시므로(오너 확정) 한 번 보여준 뒤로는 이 ref가 계속 true로 남는다.
  const hasShownDailyUsageWarningRef = useRef(false);
  useEffect(() => {
    if (
      !hasShownDailyUsageWarningRef.current &&
      dailyUsageCount !== null &&
      dailyUsageLimit !== null &&
      dailyUsageCount > dailyUsageLimit
    ) {
      hasShownDailyUsageWarningRef.current = true;
      setIsDailyUsageWarningOpen(true);
    }
  }, [dailyUsageCount, dailyUsageLimit]);

  return (
    <div className="bg-canvas-texture solve-no-callout relative h-dvh">
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
                ref={workCanvasRef}
                strokes={workStrokes}
                onStartStroke={startWorkStroke}
                onAddPoint={addWorkPoint}
                onScrollRatioChange={setWorkScrollRatio}
                onScrollableChange={setIsWorkScrollable}
                scrollable
              />
              {/* PenRail+SolveScroll 그룹 컨테이너(오너 iPad 실기기 보고 수정) — PenRail을
              `positioned={false}`로 위치 클래스 없이 렌더링하고, 이 컨테이너가 대신
              `absolute top-1/2 left-5 z-10 -translate-y-1/2`로 화면 세로 중앙에 위치한다.
              `gap-4`(16px)가 PenRail과 SolveScroll 사이 간격(기존과 동일한 16px)이다. */}
              <div className="absolute top-1/2 left-5 z-10 flex -translate-y-1/2 flex-col items-center gap-4">
                <PenRail
                  positioned={false}
                  activeTool={workTool}
                  onSelectTool={setWorkTool}
                  onUndo={undoWorkStroke}
                  onClear={clearWorkStrokes}
                />
                <SolveScroll
                  canvasRef={workCanvasRef}
                  currentRatio={workScrollRatio}
                  disabled={!isWorkScrollable}
                />
              </div>
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

          {isRecognizing || isRecognizingWork || isDiagnosing ? (
            <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center">
              <LoadingMark
                size={48}
                label={
                  isRecognizing
                    ? "문제를 인식하는 중"
                    : isRecognizingWork
                      ? "풀이를 인식하는 중"
                      : "진단하는 중"
                }
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
            {!isWorkStage && problemCardData === null ? (
              <EmptyStateHint
                title="Apple Pencil이나 마우스로 문제를 써 보세요"
                subtitle="문제집을 찍어서 올리려면 왼쪽 도구의 '사진'을 눌러 주세요"
              />
            ) : !isWorkStage && problemCardData !== null ? (
              <ProblemCard data={problemCardData} />
            ) : null}
          </div>

          {/* RecognizedChip(design-agent Figma 재조회로 확정 — `267:607`/`38:21` 두 프레임 모두
          동일 좌표 x=400 y=98, 1194×834 프레임 기준): 화면 상단 중앙에 고정한다 — 오너가 iPad
          실기기에서 "PenRail 그룹 우측 고정"안을 확인한 뒤 "왼쪽 치우침이 이상하다"며 철회를
          요청했다. 다른 상단 중앙 요소(`ProblemCard`/`EmptyStateHint` 컨테이너, 아래 참고)와 동일한
          `inset-x-0 + mx-auto` 패턴을 쓴다. 결정 필요: Figma 실측은 y=98px이지만, 이 페이지의 다른
          상단 요소들이 전부 `top-[90px]`을 공유하고 있어 시각적 일관성을 위해 기존 `top-[90px]`을
          그대로 쓴다(8px 차이). 축소/확장 상태 모두 같은 DOM 위치에 렌더링하고 `isExpanded` prop만
          바꾼다 — 이전에는 축소=화면 상단 중앙, 확장=PenRail 우측으로 서로 다른 DOM 위치에
          마운트되어 토글할 때마다 언마운트/재마운트가 일어나 포커스가 유실됐다. */}
          {isWorkStage && recognizedText ? (
            <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10 mx-auto w-[400px] max-w-[calc(100%-3rem)]">
              <RecognizedChip
                recognizedText={recognizedText}
                isExpanded={isRecognizedChipExpanded}
                onToggleExpand={() => setIsRecognizedChipExpanded((prev) => !prev)}
                imageUrl={lastInputType === "photo" ? (capturedImage?.previewUrl ?? null) : null}
              />
            </div>
          ) : null}

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
          ) : isDailyUsageWarningOpen ? (
            <Modal
              title="오늘 문제풀이 횟수 안내"
              description={`오늘 문제풀이 권장 횟수(${dailyUsageLimit}회)를 넘었어요. 계속 이용하실 수 있어요.`}
              actionLabel="확인"
              onAction={() => setIsDailyUsageWarningOpen(false)}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
