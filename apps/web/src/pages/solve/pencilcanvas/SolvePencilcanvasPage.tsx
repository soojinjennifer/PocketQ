import { useNavigate } from "react-router";
import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { useProblemInput } from "../../../features/problem-input/useProblemInput";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";

/**
 * `/solve/pencilcanvas` — 문제풀기 필기 단계(진입점). Figma 문제풀기 화면의
 * Logo/NavTabBar/PenRail/필기 캔버스/ProblemCard/ActionBar를 조립한다.
 * "풀기" 클릭 시 `ProblemInputProvider`의 `submitProblem()`(recognize → solve)을 트리거하고
 * `/solve/landscape`로 이동한다. 로딩/스트리밍/에러 표시는 landscape 화면의 책임이다.
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
    hasProblemInput,
    submitProblem,
    problemId,
    recognizeStatus,
    solveStatus,
  } = useProblemInput();

  const problemCardData: ProblemCardData = capturedImage ? { imageUrl: capturedImage.previewUrl } : null;

  // "문제 인식하기"(INPUT 단계) 클릭 시 호출된다. 현재는 recognize와 solve를 분리 트리거하는
  // WORK/DIAG 백엔드 연동이 아직 없어(`docs/FRONTEND_IMPLEMENTATION_PLAN.md` §1.3.1 4단계, 이번
  // 작업 범위 밖) 기존과 동일하게 `submitProblem()`(recognize → solve)을 그대로 호출한다.
  // "아직 못 풀겠어요"/"봐 주세요"(WORK 단계)는 problemId가 채워진 뒤에만 활성화되는데, 이 화면은
  // 그 직후 바로 `/solve/landscape`로 이동하므로 여기서는 핸들러를 연결하지 않는다.
  const handleRecognize = () => {
    void submitProblem();
    void navigate("/solve/landscape");
  };

  return (
    <div className="bg-canvas-texture solve-no-callout relative min-h-screen">
      <SolveHeader />

      <HandwritingCanvas strokes={strokes} onStartStroke={startStroke} onAddPoint={addPoint} />

      <PenRail activeTool={tool} onSelectTool={setTool} onUndo={undoStroke} onClear={clearStrokes} />

      {/* ProblemCard/ActionBar는 캔버스와 같은 레벨에서 개별 absolute 요소로 배치한다(PenRail/SolveHeader와
          동일 패턴). top-[90px]는 SolveNavTabs(top-6=24px) + NavTabBar 실측 높이(42px) + 24px 여백
          (24+42+24=90) 유도값이다 — 화면 중앙의 넓은 영역을 필기 가능하게 비워두기 위해 더 이상
          <main>으로 전체를 묶어 pointer-events-none 트릭을 쓰지 않는다.
          가로 제약은 Figma "Left and Right"(constraints.horizontal=STRETCH)를 반영해 좌우 고정폭
          트랜스폼(-translate-x-1/2) 대신 inset-x-0 + mx-auto로 구현한다(뷰포트 폭이 바뀌어도 좌우
          여백이 함께 늘어나는 대신 콘텐츠는 계속 중앙에 hug된다). */}
      <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10 mx-auto w-[448px] max-w-[calc(100%-3rem)]">
        <ProblemCard data={problemCardData} />
      </div>

      {/* Action Bar: Figma 실측(`Solve/Action Bar` 인스턴스 node 256:405, `3-1 · Solve/Pencilcanvas`
          `127:445` 내부) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백 — 기존 코드의 bottom-6(24px)보다 큰 값이라 오너가 "40px 위로"라고 요청한 값과 일치한다.
          iPad Safari 하단 툴바/홈 인디케이터에 가려지는 문제까지 함께 방지하기 위해 세이프에어리어
          inset도 더해서 실제 화면 여백은 항상 최소 40px 이상이 되도록 한다. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10 mx-auto w-fit">
        <ActionBar
          problemId={problemId}
          hasProblemInput={hasProblemInput}
          recognizeStatus={recognizeStatus}
          solveStatus={solveStatus}
          onRecognize={handleRecognize}
        />
      </div>
    </div>
  );
}
