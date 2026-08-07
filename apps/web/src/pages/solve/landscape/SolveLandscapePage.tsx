import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { useDrawingStrokes } from "../../../features/drawing-canvas/useDrawingStrokes";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";
import { useCapturedImageUrl } from "../../../features/solve-session/useCapturedImageUrl";

/**
 * `/solve/landscape` — 문제풀기 결과 단계. `/solve/pencilcanvas`의 "풀기" 버튼 클릭 후 진입한다.
 * Pen Rail과 필기 캔버스를 동일하게 포함해서 결과 화면에서도 계속 필기할 수 있게 한다.
 */
export function SolveLandscapePage() {
  const capturedImageUrl = useCapturedImageUrl();
  const problemCardData: ProblemCardData = capturedImageUrl ? { imageUrl: capturedImageUrl } : null;
  const { strokes, tool, setTool, startStroke, addPoint, undo, clear } = useDrawingStrokes();

  return (
    <div className="bg-canvas-texture solve-no-callout relative min-h-screen">
      <SolveHeader />

      <HandwritingCanvas strokes={strokes} onStartStroke={startStroke} onAddPoint={addPoint} />

      <PenRail activeTool={tool} onSelectTool={setTool} onUndo={undo} onClear={clear} />

      {/* ProblemCard/ActionBar는 캔버스와 같은 레벨에서 개별 absolute 요소로 배치한다(PenRail/SolveHeader와
          동일 패턴). top-[90px]는 SolveNavTabs(top-6=24px) + NavTabBar 실측 높이(42px) + 24px 여백
          (24+42+24=90) 유도값이다 — 화면 중앙의 넓은 영역을 필기 가능하게 비워두기 위해 더 이상
          <main>으로 전체를 묶어 pointer-events-none 트릭을 쓰지 않는다.
          가로 제약은 Figma "Left and Right"(constraints.horizontal=STRETCH)를 반영해 좌우 고정폭
          트랜스폼(-translate-x-1/2) 대신 inset-x-0 + mx-auto로 구현한다. */}
      <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10 mx-auto w-[448px] max-w-[calc(100%-3rem)]">
        <ProblemCard data={problemCardData} />
      </div>

      {/* Action Bar: Figma 실측(node 127:452) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백. iPad Safari 하단 툴바/홈 인디케이터 회피를 위해 세이프에어리어 inset도 더한다. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10 mx-auto w-fit">
        <ActionBar hasProblem={problemCardData !== null} />
      </div>
    </div>
  );
}
