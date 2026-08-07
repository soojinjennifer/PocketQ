import { useNavigate } from "react-router";
import { HandwritingCanvas } from "../../../features/drawing-canvas/HandwritingCanvas";
import { PenRail } from "../../../features/drawing-canvas/PenRail";
import { useDrawingStrokes } from "../../../features/drawing-canvas/useDrawingStrokes";
import { ActionBar } from "../../../features/solve-session/ActionBar";
import { ProblemCard, type ProblemCardData } from "../../../features/solve-session/ProblemCard";
import { SolveHeader } from "../../../features/solve-session/SolveHeader";
import { useCapturedImageUrl } from "../../../features/solve-session/useCapturedImageUrl";

/**
 * `/solve/pencilcanvas` — 문제풀기 필기 단계(진입점). Figma 문제풀기 화면의
 * Logo/NavTabBar/PenRail/필기 캔버스/ProblemCard/ActionBar를 조립한다.
 * "풀기" 클릭 시 `/solve/landscape`로 이동한다(AI 연동은 아직 없어 라우트 전환만 수행).
 */
export function SolvePencilcanvasPage() {
  const navigate = useNavigate();
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
          트랜스폼(-translate-x-1/2) 대신 inset-x-0 + mx-auto로 구현한다(뷰포트 폭이 바뀌어도 좌우
          여백이 함께 늘어나는 대신 콘텐츠는 계속 중앙에 hug된다). */}
      <div className="pointer-events-auto absolute inset-x-0 top-[90px] z-10 mx-auto w-[448px] max-w-[calc(100%-3rem)]">
        <ProblemCard data={problemCardData} />
      </div>

      {/* Action Bar: Figma 실측(node 127:452) constraints.vertical=MAX(Bottom), 프레임 하단에서 정확히
          40px 여백 — 기존 코드의 bottom-6(24px)보다 큰 값이라 오너가 "40px 위로"라고 요청한 값과 일치한다.
          iPad Safari 하단 툴바/홈 인디케이터에 가려지는 문제까지 함께 방지하기 위해 세이프에어리어
          inset도 더해서 실제 화면 여백은 항상 최소 40px 이상이 되도록 한다. */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+40px)] z-10 mx-auto w-fit">
        <ActionBar
          hasProblem={problemCardData !== null}
          onSolve={() =>
            void navigate("/solve/landscape", {
              state: capturedImageUrl ? { capturedImageUrl } : undefined,
            })
          }
        />
      </div>
    </div>
  );
}
