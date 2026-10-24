/**
 * JSXGraph 보드 하나의 생성·리사이즈·단계 적용·해제.
 *
 * 보드 설정(`docs/FIGURE_DESIGN.md` §11, `docs/FIGURE_SPEC.md` §14.2):
 * - 화면 장식(저작권 문구·이동 버튼·확대 버튼·좌표 상자·전체화면 등)을 모두 끈다(D7 출처 미표시 포함).
 * - pan·zoom·keyboard·drag·selection을 끈다.
 * - `registerEvents: false` — 포인터·키보드·휠·전체화면·resize 핸들러를 하나도 등록하지 않는다.
 *   JSXGraph는 포인터 핸들러를 등록할 때만(`addPointerEventHandlers`) 컨테이너에 `touch-action: none`을
 *   넣으므로, 이 설정이면 컨테이너에 touch-action이 설정되지 않아 읽기 모드에서 페이지 스크롤이 유지된다.
 *   같은 이유로 내장 ResizeObserver와 그 지연 콜백(`setTimeout`)도 생기지 않는다 → 리사이즈는 우리
 *   ResizeObserver(`useElementWidth`)만 쓴다.
 * - 같은 단위 비율은 `computeViewport`가 정확히 맞춘 boundingBox로 보장하므로 JSXGraph의
 *   `keepAspectRatio` 보정은 쓰지 않는다(보정이 boundingBox를 다시 바꾸지 않게).
 */
import type { FigureSpec } from "shared-types";
import { buildDecorations, type BuildSceneOptions, type FigureScene, type SceneItem } from "./buildBoardScene";
import { applySceneToBoard, type FigureTextClasses } from "./applySceneToBoard";
import type { FigurePalette } from "./figureStyle";
import type { JsxGraphApi } from "./jsxgraphAdapter";
import type { FigureStepState } from "./resolveStepState";
import type { FigureViewport } from "./viewport";

export function boardAttributes(viewport: FigureViewport): Record<string, unknown> {
  return {
    boundingBox: viewport.boundingBox,
    keepAspectRatio: false,
    axis: false,
    grid: false,
    renderer: "svg",
    showCopyright: false,
    showLogo: false,
    showNavigation: false,
    showZoom: false,
    showInfobox: false,
    showFullscreen: false,
    showScreenshot: false,
    showClearTraces: false,
    showReload: false,
    pan: { enabled: false },
    zoom: { enabled: false, wheel: false, pinch: false },
    keyboard: { enabled: false },
    drag: { enabled: false },
    selection: { enabled: false },
    browserPan: false,
    resize: { enabled: false },
    registerEvents: false,
    title: "",
  };
}

/** 보드 크기에서 장면 옵션(px/단위, 범위)을 만든다. */
export function sceneOptionsFor(viewport: FigureViewport): BuildSceneOptions {
  const [left, top, right, bottom] = viewport.boundingBox;
  return {
    pxPerUnit: { x: viewport.width / (right - left), y: viewport.height / (top - bottom) },
    boundingBox: viewport.boundingBox,
  };
}

/** 장식이 바뀌었는지 비교하는 서명(요소 id용 key 제외). */
function decorationSignature(items: readonly SceneItem[]): string {
  return JSON.stringify(items.map(({ key: _key, ...rest }) => rest));
}

export interface LiveFigureBoard {
  resize(viewport: FigureViewport): void;
  applyStepState(state: FigureStepState): void;
  destroy(): void;
}

export function mountFigureBoard(
  api: JsxGraphApi,
  container: HTMLElement,
  spec: FigureSpec,
  scene: FigureScene,
  viewport: FigureViewport,
  palette: FigurePalette,
  classes: FigureTextClasses,
  state: FigureStepState,
): LiveFigureBoard {
  const board = api.initBoard(container, boardAttributes(viewport));
  let destroyed = false;
  const destroy = (): void => {
    if (destroyed) return;
    destroyed = true;
    api.freeBoard(board);
  };

  try {
    // CSS 크기는 React가 관리한다(dontSetCss) — 컨테이너 폭을 px로 고정하지 않기 위해서다.
    board.resizeContainer(viewport.width, viewport.height, true, true);
    board.setBoundingBox(viewport.boundingBox, false);
    board.suspendUpdate();
    const live = applySceneToBoard(board, scene, palette, classes);
    live.applyStepState(state);
    board.unsuspendUpdate();
    let generation = 0;
    let signature = decorationSignature(scene.decorations);

    return {
      resize(next) {
        if (destroyed) return;
        board.resizeContainer(next.width, next.height, true, true);
        board.setBoundingBox(next.boundingBox, false);
        // 재작업 1(P2-2): px/단위·범위가 바뀌어 눈금 간격·표시할 눈금이 달라지면 장식만 다시 만든다.
        const decorations = buildDecorations(spec, scene.elements, sceneOptionsFor(next), generation + 1);
        const nextSignature = decorationSignature(decorations);
        if (nextSignature !== signature) {
          generation += 1;
          signature = nextSignature;
          board.suspendUpdate();
          live.replaceDecorations(decorations);
          board.unsuspendUpdate();
        }
        board.update();
      },
      applyStepState(next) {
        if (destroyed) return;
        live.applyStepState(next);
        board.update();
      },
      destroy,
    };
  } catch (error) {
    destroy();
    throw error;
  }
}
