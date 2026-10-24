/**
 * JSXGraph 진입점 — 동적 `import("jsxgraph")`는 **이 파일에서만** 한다(별도 청크로 분리, 테스트에서 mock).
 *
 * 렌더러는 JSXGraph 타입에 직접 의존하지 않고 아래 최소 인터페이스(`JxgBoard`, `JxgElement`)만 쓴다.
 * 어댑터가 실제 JSXGraph 보드를 감싸 이 인터페이스로 넘긴다.
 */

export interface JxgElement {
  setAttribute(attributes: Record<string, unknown>): void;
}

export interface JxgBoard {
  create(elementType: string, parents: unknown[], attributes: Record<string, unknown>): JxgElement;
  /** 요소 하나를 보드에서 지운다(장식 다시 만들기용). */
  removeObject(element: JxgElement): void;
  update(): void;
  suspendUpdate(): void;
  unsuspendUpdate(): void;
  setBoundingBox(boundingBox: [number, number, number, number], keepAspectRatio: boolean): void;
  resizeContainer(width: number, height: number, dontSetCss: boolean, dontSetBoundingBox: boolean): void;
  getBoundingBox(): [number, number, number, number];
  /** 현재 px/단위(가로). */
  readonly unitX: number;
  /** 현재 px/단위(세로). */
  readonly unitY: number;
}

export interface JsxGraphApi {
  initBoard(container: HTMLElement, attributes: Record<string, unknown>): JxgBoard;
  freeBoard(board: JxgBoard): void;
}

type JxgNamespace = typeof import("jsxgraph");
type RealBoard = ReturnType<JxgNamespace["JSXGraph"]["initBoard"]>;

/** 실제 JSXGraph 요소를 감싼다. 다른 요소의 parents로 넘길 때는 `unwrap`으로 원래 요소를 꺼낸다. */
class ElementAdapter implements JxgElement {
  readonly element: unknown;

  constructor(element: unknown) {
    this.element = element;
  }

  setAttribute(attributes: Record<string, unknown>): void {
    const { element } = this;
    if (typeof element === "object" && element !== null && "setAttribute" in element) {
      const setter: unknown = element.setAttribute;
      if (typeof setter === "function") Reflect.apply(setter, element, [attributes]);
    }
  }
}

function unwrap(parent: unknown): unknown {
  return parent instanceof ElementAdapter ? parent.element : parent;
}

class BoardAdapter implements JxgBoard {
  readonly board: RealBoard;

  constructor(board: RealBoard) {
    this.board = board;
  }

  create(elementType: string, parents: unknown[], attributes: Record<string, unknown>): JxgElement {
    return new ElementAdapter(this.board.create(elementType, parents.map(unwrap), attributes));
  }

  removeObject(element: JxgElement): void {
    if (element instanceof ElementAdapter) {
      const target = element.element;
      if (typeof target === "object" && target !== null) this.board.removeObject(target as Parameters<RealBoard["removeObject"]>[0]);
    }
  }

  update(): void {
    this.board.update();
  }

  suspendUpdate(): void {
    this.board.suspendUpdate();
  }

  unsuspendUpdate(): void {
    this.board.unsuspendUpdate();
  }

  setBoundingBox(boundingBox: [number, number, number, number], keepAspectRatio: boolean): void {
    this.board.setBoundingBox(boundingBox, keepAspectRatio);
  }

  resizeContainer(width: number, height: number, dontSetCss: boolean, dontSetBoundingBox: boolean): void {
    this.board.resizeContainer(width, height, dontSetCss, dontSetBoundingBox);
  }

  getBoundingBox(): [number, number, number, number] {
    const [left = 0, top = 0, right = 0, bottom = 0] = this.board.getBoundingBox();
    return [left, top, right, bottom];
  }

  get unitX(): number {
    return this.board.unitX;
  }

  get unitY(): number {
    return this.board.unitY;
  }
}

let cached: Promise<JsxGraphApi> | null = null;

/** JSXGraph 청크를 불러온다(한 번만). 실패하면 캐시를 비워 다음 시도에서 다시 불러온다. */
export function loadJsxGraph(): Promise<JsxGraphApi> {
  if (cached === null) {
    cached = import("jsxgraph").then(
      (module): JsxGraphApi => {
        // 타입 선언은 `export = JXG`, 실제 ESM은 `export default JXG`다 — 둘 다 받는다.
        const JXG: JxgNamespace = (module as { default?: JxgNamespace }).default ?? module;
        return {
          initBoard: (container, attributes) => new BoardAdapter(JXG.JSXGraph.initBoard(container, attributes)),
          freeBoard: (board) => {
            if (board instanceof BoardAdapter) JXG.JSXGraph.freeBoard(board.board);
          },
        };
      },
      (error: unknown) => {
        cached = null;
        throw error;
      },
    );
  }
  return cached;
}
