import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { strokeToPath } from "../../shared/lib/canvas/strokeToPath";
import { ERASER_SIZE, INK_COLOR, PEN_SIZE } from "../../shared/lib/canvas/strokeStyle";
import type { DrawingTool, Stroke, StrokePoint } from "../../shared/lib/canvas/useDrawingStrokes";
import {
  isPointerDebugEnabled,
  logPointerEvent,
  type PointerDebugEntry,
  type PointerDebugEventType,
} from "../../shared/lib/canvas/pointerDebugLog";

interface HandwritingCanvasProps {
  strokes: Stroke[];
  /** 현재 선택된 도구 — `pointerdown`(새 제스처 시작) 시 이 값으로 새 Stroke를 시작한다. */
  tool: DrawingTool;
  /**
   * 포인터 제스처(펜이 닿아서 뗄 때까지) 전체가 끝난 시점(`pointerup`/`pointercancel`)에 완성된
   * `Stroke`를 정확히 1회 호출한다. 진행 중인 좌표 누적은 이 컴포넌트 내부 ref가 담당하고
   * (`activeStrokeRef`), `pointermove`마다 React state를 갱신하지 않는다 — iPad 9세대+Apple
   * Pencil 1세대에서 빠른 필기 시 입력이 누락되던 문제의 근본 원인이었다(plan-agent 4단계
   * 확정안, `useDrawingStrokes` JSDoc 참고).
   *
   * `pointerleave`(캡처가 걸린 채로 캔버스 경계를 스치는 경우)에서도 그 시점까지 쌓인 부분을
   * 먼저 커밋하고 새 활성 스트로크로 이어간다 — 결과적으로 획 1개가 여러 개의 커밋으로 나뉠 수
   * 있다(plan-agent P1 확정안, 아래 `handlePointerLeave` 참고).
   */
  onCommitStroke: (stroke: Stroke) => void;
  /**
   * 손가락 1개/2개 스크롤로 캔버스를 세로로 확장/스크롤할 수 있게 한다(PRD WORK-6, P1).
   * 기본값 `false`(기존 동작 그대로 — 뷰포트 크기 고정, 스크롤 없음). `true`로 켜면 뷰포트("outer")
   * 안에 세로로 늘어날 수 있는 콘텐츠("content") 레이어를 추가하고, 펜으로 그리는 중이 아닌
   * 터치 포인터의 이동으로 `outer.scrollTop`을 직접 구동한다. `/solve/pencilcanvas`의 WORK 단계
   * 캔버스(`workStrokes`)에만 사용하고, INPUT 단계 캔버스와 `/solve/landscape` 캔버스는 기본값을
   * 그대로 사용해 이번 변경의 영향을 받지 않는다.
   */
  scrollable?: boolean;
  /**
   * `scrollable`일 때, 손가락 스크롤(또는 `scrollToRatio` 핸들 호출)로 실제 스크롤 위치가 바뀔
   * 때마다 현재 비율(0=맨 위 ~ 1=맨 아래)을 알린다(SolveScroll 인디케이터 동기화용, PRD 스크롤
   * 인디케이터 1차). `scrollable`이 아니면 절대 호출되지 않는다.
   */
  onScrollRatioChange?: (ratio: number) => void;
  /**
   * `scrollable`일 때, 콘텐츠 높이가 바뀔 때마다(스트로크 성장으로 인한 확장 포함) 현재 "스크롤이
   * 실제로 가능한 상태인지"(`outer.scrollHeight > outer.clientHeight`)를 알린다(오너 요청: 풀이가
   * 짧아 스크롤할 필요가 없을 때 `SolveScroll`을 숨기지 않고 대신 비활성화하기 위한 판단용).
   * `scrollable`이 아니면 절대 호출되지 않는다.
   */
  onScrollableChange?: (isScrollable: boolean) => void;
}

/**
 * 상위(page)가 스크롤 인디케이터(`SolveScroll`)를 구현할 수 있도록 노출하는 최소 imperative
 * handle. `scrollable=false`일 때는 `scrollToRatio`가 완전히 no-op이다.
 */
export interface HandwritingCanvasHandle {
  /** `ratio`(0~1)에 맞춰 `outer.scrollTop`을 이동한다. `scrollable=false`면 아무 동작도 하지 않는다. */
  scrollToRatio: (ratio: number) => void;
  /** 펜(마우스 포함 비-touch 포인터)이 현재 획을 그리는 중인지 여부 — 스크롤 인디케이터 탭 무시 판단용. */
  isPenActive: () => boolean;
  /**
   * 현재 콘텐츠가 실제로 스크롤 가능한 상태인지(`outer.scrollHeight > outer.clientHeight`) 반환한다.
   * `scrollable=false`면 항상 `false`.
   */
  isScrollable: () => boolean;
}

/** `scrollable` 모드에서 학생이 쓴 내용이 콘텐츠 하단 근처(threshold)에 닿으면 한 뷰포트 높이만큼 확장한다. */
const SCROLL_GROWTH_THRESHOLD_RATIO = 0.85;

/** 두 `requestAnimationFrame` 사이 경과 시간이 이 값(ms)을 넘으면 long task로 간주한다(30fps 기준 2배). */
const LONG_FRAME_THRESHOLD_MS = 32;

/**
 * `strokes` 목록을 순서대로 캔버스에 그리는 순수 함수(컴포넌트 상태/props에 의존하지 않는다) —
 * 커밋된 strokes와 진행 중인 활성 stroke를 동일한 방식으로 그리기 위해 `render()`/오프스크린 캐시
 * 재계산이 공통으로 사용한다. 펜 획은 `ctx.fill(path)`, 지우개 획은
 * `globalCompositeOperation="destination-out"`으로 렌더링해서 undo/clear가 지우개 동작도 동일하게
 * 되돌릴 수 있게 한다.
 */
function drawStrokeList(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  for (const stroke of strokes) {
    const path = strokeToPath(stroke.points, {
      size: stroke.tool === "eraser" ? ERASER_SIZE : PEN_SIZE,
    });
    if (!path) {
      continue;
    }
    ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
    ctx.fillStyle = INK_COLOR;
    ctx.fill(path);
  }
}

/** strokes 목록 전체에서 가장 큰 y좌표를 구한다(콘텐츠 성장 임계값 판단용). */
function computeMaxY(strokes: Stroke[]): number {
  let maxY = 0;
  for (const stroke of strokes) {
    for (const point of stroke.points) {
      if (point.y > maxY) {
        maxY = point.y;
      }
    }
  }
  return maxY;
}

/**
 * 오프스크린 캐시용 `<canvas>`를 지연 생성해서 반환한다(DOM에 붙이지 않는다). `ref`가 이미
 * 캔버스를 갖고 있으면 그대로 재사용한다 — 컴포넌트 생명주기 동안 단 하나의 오프스크린 캔버스만
 * 만든다.
 */
function ensureOffscreenCanvas(ref: React.MutableRefObject<HTMLCanvasElement | null>): HTMLCanvasElement {
  if (!ref.current) {
    ref.current = document.createElement("canvas");
  }
  return ref.current;
}

/** `clientX`/`clientY`/`pressure`(호출자가 이미 구한 `rect` 기준)를 `StrokePoint`로 변환한다. */
function toStrokePointFromRect(
  clientX: number,
  clientY: number,
  pressure: number,
  rect: DOMRect,
): StrokePoint {
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
    pressure: pressure > 0 ? pressure : 0.5,
  };
}

/** `pointerdown` 등 좌표 1개만 필요한 지점에서 쓰는 편의 함수 — 자체적으로 `rect`를 1회 계산한다. */
function toStrokePoint(event: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return toStrokePointFromRect(event.clientX, event.clientY, event.pressure, rect);
}

/** `hasPointerCapture`가 없거나 던지는 환경(jsdom 등)에서도 안전하게 캡처 여부를 조회한다. */
function safeHasPointerCapture(event: React.PointerEvent<HTMLCanvasElement>): boolean | null {
  const target = event.currentTarget;
  if (!target || typeof target.hasPointerCapture !== "function") {
    return null;
  }
  try {
    return target.hasPointerCapture(event.pointerId);
  } catch {
    return null;
  }
}

/**
 * Figma 필기 캔버스 레이어 — 화면 전체를 덮는 절대 위치 `<canvas>`(`absolute inset-0`).
 * `ResizeObserver`로 컨테이너 크기 변화에 devicePixelRatio 스케일을 재적용하고,
 * Pointer Events로 획을 입력받아 그린다.
 *
 * 진행 중인 제스처(포인터 다운~업)의 좌표는 `activeStrokeRef`(컴포넌트 로컬 ref)에만 누적하고
 * `pointermove`마다 React state(`strokes` prop의 원천인 `useDrawingStrokes`)를 갱신하지 않는다 —
 * 매 포인트마다 `setState`를 호출하면 이 컴포넌트를 소비하는 상위 Context(`ProblemInputProvider`)의
 * `useMemo` value가 재생성되어 앱 전체가 재조정되고, 아래 리사이즈 감시 effect까지 매 포인트마다
 * 재실행되어(캔버스 backing store 리셋 포함) iPad 9세대+Apple Pencil 1세대에서 빠른 필기 시 입력이
 * 누락되는 문제가 있었다(plan-agent 4단계 확정안). `render()`는 `strokesRef`/`activeStrokeRef`
 * 두 ref만 읽는 완전한 zero-dependency `useCallback`이라 `pointermove`마다 동기 호출해도 다른 어떤
 * state/effect도 건드리지 않는다. 제스처가 끝나면(`pointerup`/`pointercancel`) 완성된 Stroke를
 * `onCommitStroke`로 정확히 1회 전달하고, 상위에서 새로 내려온 `strokes` prop을 반영하는 effect가
 * 그제서야 `activeStrokeRef`를 비운다(커밋 직후 깜빡임 없이 자연스럽게 이어지도록).
 *
 * `render()`는 매 포인트마다 커밋된 전체 strokes를 처음부터 다시 perfect-freehand로 재계산하지
 * 않는다(P1~P2 근본 성능 개선, plan-agent 확정안) — 대신 DOM에 붙지 않는 오프스크린 캐시
 * `<canvas>`(`offscreenCanvasRef`)에 "커밋된 스트로크만" 담아두고, `strokes` prop이 실제로 바뀌거나
 * 캔버스가 실제로 리사이즈될 때만(포인트마다가 아니라 커밋/리사이즈당 1회) 오프스크린 전체를
 * 재계산한다. 핫패스인 `render()`는 화면 캔버스를 지우고 오프스크린을 `drawImage`로 그대로
 * 복사(O(1) blit)한 뒤, 그 위에 진행 중인 활성 스트로크만 추가로 그린다. 오프스크린/화면 캔버스의
 * backing store 크기(devicePixelRatio 반영)는 항상 동일하게 유지한다.
 *
 * `scrollable`이 `true`면 위 동작은 그대로 유지한 채(팜 리젝션 로직은 절대 건드리지 않는다), 추가로
 * "펜으로 그리는 중이 아닐 때 시작된 터치 포인터"만 스크롤 후보로 등록해 손가락 스크롤을 지원한다 —
 * 펜으로 그리는 도중에 닿는 손바닥(터치)은 스크롤 후보로 등록되지 않으므로 팜 리젝션과 절대 충돌하지
 * 않는다. `<canvas>`는 `touch-action: none`을 유지해 브라우저 네이티브 제스처를 완전히 차단하고,
 * 스크롤은 항상 JS로 `outer.scrollTop`을 직접 구동한다.
 *
 * `ref`로 `HandwritingCanvasHandle`을 노출한다(`scrollable`이 아니면 완전히 no-op) — 상위(SolveScroll)가
 * 펜 탭으로 특정 지점을 스크롤 이동시키거나 펜이 그리는 중인지 확인할 수 있게 한다. 이 handle은 순수
 * 추가이며, `scrollable=false`(기존 사용부)의 렌더링/이벤트 로직은 한 줄도 바뀌지 않는다.
 */
export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, HandwritingCanvasProps>(
  function HandwritingCanvas(
    { strokes, tool, onCommitStroke, scrollable = false, onScrollRatioChange, onScrollableChange },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const outerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const activePointerIdRef = useRef<number | null>(null);
    // 커밋된 strokes의 최신값(= `strokes` prop)을 보관한다. `render()`가 zero-dependency
    // `useCallback`이라 prop을 직접 참조할 수 없어 ref로 미러링한다.
    const strokesRef = useRef<Stroke[]>(strokes);
    // 진행 중인 제스처(포인터 다운~업)의 좌표를 누적하는 로컬 상태 — 완성되면 `onCommitStroke`로
    // 전달되고, 상위 `strokes` prop이 갱신되어 내려올 때까지는 비우지 않는다(위 JSDoc 참고).
    const activeStrokeRef = useRef<Stroke | null>(null);
    // 콘텐츠 성장(threshold) 판단에 커밋된/진행 중인 stroke의 maxY를 각각 O(1)로 확인하기 위한
    // 캐시. 커밋된 쪽은 `strokes` prop이 바뀔 때(효과 참고) 전체를 다시 스캔해서 갱신하고, 진행
    // 중인 쪽은 포인트가 추가될 때마다 증분 갱신한다.
    const committedMaxYRef = useRef(0);
    const activeMaxYRef = useRef(0);
    // `scrollable`일 때만 사용한다 — pointerId → 마지막 clientY. 펜으로 그리는 중이 아닐 때 시작된
    // 터치 포인터만 여기 등록된다(팜 리젝션 유지: 펜이 그리는 도중 닿는 손바닥은 등록되지 않는다).
    const touchScrollPointersRef = useRef<Map<number, number>>(new Map());
    // `scrollable`일 때만 사용한다 — outer(뷰포트) 높이 실측값. content 최초 높이/확장 단위로 쓴다.
    const outerHeightRef = useRef(0);
    // 디버그 로깅용 — pointerId별 `pointerdown` 타임스탬프. 그 pointerId의 첫 `pointermove`가 실제
    // 좌표를 push하는 시점에 경과시간(`firstDrawLatencyMs`)을 계산하고 즉시 제거한다.
    const pointerDownTimestampsRef = useRef<Map<number, number>>(new Map());
    // pointerId별 "아직 대응하는 `lostpointercapture`가 도착하지 않은 `setPointerCapture` 호출
    // 횟수"(debt). iOS Safari가 애플펜슬의 pointerId를 연속된 획 사이에서 재사용할 때, 획1의
    // `pointerup`이 `activePointerIdRef`를 이미 비우고 획2의 `pointerdown`이 같은 pointerId로
    // 새 활성 스트로크를 시작한 뒤에야 획1의 지연된 `lostpointercapture`가 뒤늦게 도착해 진행 중인
    // 획2를 조기 종료시키는 경쟁 상태를 막기 위한 카운터다 — `setPointerCapture` 호출 1회당
    // `lostpointercapture`가 정확히 1번 언젠가 발생한다는 스펙을 이용한다(P0 후속 수정).
    const pointerCaptureDebtRef = useRef<Map<number, number>>(new Map());
    const [contentHeight, setContentHeight] = useState<number | null>(null);

    // zero-dependency: `strokesRef`만 읽어 오프스크린 캐시(커밋된 스트로크만)를 전체 재계산한다.
    // `strokes` prop이 실제로 바뀌거나(아래 동기화 effect) 캔버스가 실제로 리사이즈될 때(아래 리사이즈
    // effect)만 호출되므로, 포인트마다가 아니라 커밋/리사이즈당 1회만 O(n) 비용이 발생한다.
    const renderOffscreenCache = useCallback(() => {
      const offscreen = ensureOffscreenCanvas(offscreenCanvasRef);
      const ctx = offscreen.getContext("2d");
      if (!ctx) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, offscreen.width, offscreen.height);
      drawStrokeList(ctx, strokesRef.current);
      ctx.globalCompositeOperation = "source-over";
    }, []);

    // zero-dependency: `activeStrokeRef`와 오프스크린 캐시(`offscreenCanvasRef`)만 읽는다(위 컴포넌트
    // JSDoc 참고). `strokes` prop이나 다른 state에 의존하지 않으므로 `pointerdown`/`pointermove`에서
    // 리렌더 없이 동기 호출해도 이 함수 자체의 정체성이 바뀌지 않는다 — 아래 리사이즈 감시 effect가 이
    // 안정적인 참조 덕분에 실제 리사이즈가 없는 한 재실행되지 않는다. 커밋된 strokes 전체를 다시
    // 계산하지 않고 오프스크린 캐시를 O(1) blit으로 복사하기만 한다(P1~P2 성능 개선).
    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        return;
      }

      const ratio = window.devicePixelRatio || 1;
      const offscreen = offscreenCanvasRef.current;

      // identity transform으로 잠깐 리셋해서 오프스크린을 픽셀 단위로 정확히 복사한다(오프스크린과
      // 화면 캔버스의 backing store 크기는 리사이즈 effect가 항상 동일하게 유지한다).
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (offscreen) {
        ctx.drawImage(offscreen, 0, 0);
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const activeStroke = activeStrokeRef.current;
      if (activeStroke) {
        drawStrokeList(ctx, [activeStroke]);
      }
      ctx.globalCompositeOperation = "source-over";
    }, []);

    // `scrollable`이 아니면 무조건 no-op(콘텐츠 성장 개념 자체가 없다).
    const maybeGrowContent = useCallback(() => {
      if (!scrollable) {
        return;
      }
      setContentHeight((prev) => {
        if (prev === null || outerHeightRef.current === 0) {
          return prev;
        }
        const maxY = Math.max(committedMaxYRef.current, activeMaxYRef.current);
        if (maxY >= prev * SCROLL_GROWTH_THRESHOLD_RATIO) {
          return prev + outerHeightRef.current;
        }
        return prev;
      });
    }, [scrollable]);

    // 상위(Provider)의 `strokes`가 실제로 갱신되어 내려올 때(=커밋 완료 후)만 로컬 오버레이(진행
    // 중이던 stroke)를 지우고 다시 그린다 — 커밋 직후 깜빡임 없이 자연스럽게 이어진다(위 컴포넌트
    // JSDoc 참고). `activePointerIdRef.current`가 `null`이 아니면(=포인터가 여전히 캡처된 채 그리는
    // 중이면) `activeStrokeRef`를 비우지 않는다 — `handlePointerLeave`가 캔버스 경계를 스치는 순간
    // 커밋 후 같은 tool의 새 빈 스트로크로 이어가도록 재설정한 값을, 이 effect가 비동기로(커밋 →
    // 부모 재렌더 → 이 effect) 다시 덮어써서 이후 `pointermove`가 조용히 버려지는 경쟁 상태를
    // 방지한다(P1 확정안). 이 가드는 기존 흐름(자기 자신의 `pointerup`/`pointercancel` 커밋 시점에는
    // 이미 `activePointerIdRef.current`가 `null`)에는 전혀 영향을 주지 않는다.
    // `render`가 이제 안정적인 참조이므로 이 effect는 사실상 `strokes` prop이 바뀔 때만 재실행된다.
    useEffect(() => {
      strokesRef.current = strokes;
      if (activePointerIdRef.current === null) {
        activeStrokeRef.current = null;
        activeMaxYRef.current = 0;
      }
      committedMaxYRef.current = computeMaxY(strokes);
      renderOffscreenCache();
      render();
      maybeGrowContent();
    }, [strokes, render, renderOffscreenCache, maybeGrowContent]);

    // `outer.scrollHeight`/`outer.clientHeight`로부터 현재 실제 스크롤 가능 여부를 계산해
    // `onScrollableChange`에 알린다(위 prop JSDoc 참고). 콘텐츠 높이 변경(스트로크 성장)뿐 아니라
    // 뷰포트 자체의 리사이즈(iPad 회전, Split View 폭 변경 등으로 `outer.clientHeight`가 바뀌는
    // 경우)에도 다시 계산해야 하므로, 아래 리사이즈 effect의 `measureOuterHeight`/
    // `resizeCanvasToContent`(각각 outer/content `ResizeObserver` 콜백)에서 직접 호출한다
    // (design-agent 사후검수 발견·수정, 2026-09) — `contentHeight` state 변경에만 의존하는 별도
    // effect만 있으면 콘텐츠 크기는 그대로인 채 outer만 커지거나 작아지는 경우(회전/Split View)를
    // 놓쳐 `SolveScroll`의 `disabled` 상태가 회전 후에도 갱신되지 않는다.
    const notifyScrollable = useCallback(() => {
      if (!scrollable || !onScrollableChange) {
        return;
      }
      const outer = outerRef.current;
      if (!outer) {
        return;
      }
      onScrollableChange(outer.scrollHeight > outer.clientHeight);
    }, [scrollable, onScrollableChange]);

    // 캔버스 픽셀 크기 동기화. `scrollable`이 아니면 기존과 완전히 동일하게 outer(뷰포트) 크기를
    // 그대로 관찰한다. `scrollable`이면 캔버스 크기는 outer가 아니라 세로로 늘어날 수 있는 content
    // 크기를 따라간다(가로 폭만 outer 기준으로 고정). `render`가 이제 zero-dependency로 안정된
    // 참조라, 이 effect는 `scrollable`/`notifyScrollable`이 실제로 바뀔 때만(마운트 포함) 재실행된다
    // — 이전에는 `render`가 `strokes`에 의존해 매 포인트마다 재생성되면서 `ResizeObserver`
    // disconnect/재생성과 `canvas.width/height` 재할당(백킹 스토어 리셋)이 불필요하게 반복됐다
    // (필기 유실 버그 근본 원인 중 하나, plan-agent 4단계 확정안). 캔버스의 backing store 크기가
    // 실제로 바뀔 때(`sizeChanged`)만 오프스크린 캐시도 같은 크기로 맞추고 전체 재계산한다 — 이
    // 시점(리사이즈당 1회)에만 O(n) 비용이 발생해도 문제없다(P1~P2 성능 개선).
    useEffect(() => {
      const canvas = canvasRef.current;
      const outer = outerRef.current;
      if (!canvas || !outer) {
        return;
      }

      if (!scrollable) {
        const resize = () => {
          const rect = outer.getBoundingClientRect();
          const ratio = window.devicePixelRatio || 1;
          const newWidth = Math.round(rect.width * ratio);
          const newHeight = Math.round(rect.height * ratio);
          const sizeChanged = canvas.width !== newWidth || canvas.height !== newHeight;
          canvas.width = newWidth;
          canvas.height = newHeight;
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
          if (sizeChanged) {
            const offscreen = ensureOffscreenCanvas(offscreenCanvasRef);
            offscreen.width = newWidth;
            offscreen.height = newHeight;
            renderOffscreenCache();
            if (isPointerDebugEnabled()) {
              logPointerEvent(
                buildLifecycleDebugEntry("resize", activePointerIdRef, activeStrokeRef, strokesRef, {
                  canvasWidth: newWidth,
                  canvasHeight: newHeight,
                }),
              );
            }
          }
          render();
        };

        const observer = new ResizeObserver(resize);
        observer.observe(outer);
        resize();

        return () => observer.disconnect();
      }

      const content = contentRef.current;
      if (!content) {
        return;
      }

      const resizeCanvasToContent = () => {
        const outerRect = outer.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const newWidth = Math.round(outerRect.width * ratio);
        const newHeight = Math.round(contentRect.height * ratio);
        const sizeChanged = canvas.width !== newWidth || canvas.height !== newHeight;
        canvas.width = newWidth;
        canvas.height = newHeight;
        canvas.style.width = `${outerRect.width}px`;
        canvas.style.height = `${contentRect.height}px`;
        if (sizeChanged) {
          const offscreen = ensureOffscreenCanvas(offscreenCanvasRef);
          offscreen.width = newWidth;
          offscreen.height = newHeight;
          renderOffscreenCache();
          if (isPointerDebugEnabled()) {
            logPointerEvent(
              buildLifecycleDebugEntry("resize", activePointerIdRef, activeStrokeRef, strokesRef, {
                canvasWidth: newWidth,
                canvasHeight: newHeight,
              }),
            );
          }
        }
        render();
        notifyScrollable();
      };

      const measureOuterHeight = () => {
        const rect = outer.getBoundingClientRect();
        outerHeightRef.current = rect.height;
        setContentHeight((prev) => (prev === null ? rect.height : prev));
        notifyScrollable();
      };

      const contentObserver = new ResizeObserver(resizeCanvasToContent);
      contentObserver.observe(content);
      const outerObserver = new ResizeObserver(measureOuterHeight);
      outerObserver.observe(outer);

      measureOuterHeight();
      resizeCanvasToContent();

      return () => {
        contentObserver.disconnect();
        outerObserver.disconnect();
      };
    }, [render, renderOffscreenCache, scrollable, notifyScrollable]);

    // `contentHeight`가 처음 측정되거나 바뀔 때도 성장 여부를 다시 확인한다 — 예: 저장된 필기가
    // 이미 있는 상태로 마운트되는 경우(마이페이지 "다시풀기") 최초 측정 시점에 이미 threshold를
    // 넘어 있을 수 있다. 그리는 도중/커밋 직후 성장 체크(위 `maybeGrowContent` 호출부)와는 별개로
    // 이 경로만 놓치지 않기 위한 안전망이다.
    useEffect(() => {
      if (!scrollable) {
        return;
      }
      maybeGrowContent();
    }, [scrollable, contentHeight, maybeGrowContent]);

    // 콘텐츠 높이가 바뀔 때마다(성장 로직 직후 포함) 실제 스크롤 가능 여부를 다시 확인한다 — 위
    // 리사이즈 effect의 `measureOuterHeight`/`resizeCanvasToContent`가 outer/content
    // `ResizeObserver` 콜백 시점에 이미 `notifyScrollable()`을 호출하지만, `contentHeight`
    // state로 트리거되는 확장 로직(위 `maybeGrowContent`)은 DOM 레이아웃이 아니라 React state로
    // content 높이를 바꾸므로 그 커밋 이후 시점에 한 번 더 확인해 두 경로 모두를 놓치지 않는다.
    useEffect(() => {
      notifyScrollable();
    }, [notifyScrollable, contentHeight]);

    // `outer.scrollTop`/`scrollHeight`/`clientHeight`로부터 현재 스크롤 비율(0~1)을 계산해
    // `onScrollRatioChange`에 알린다. `scrollable`이 아니거나 콜백이 없으면 아무 일도 하지 않는다
    // (기존 사용부에 완전히 no-op). 터치 드래그 스크롤(`handleScrollTouchMove`)과 `scrollToRatio`
    // 핸들 호출, 두 지점에서만 호출한다.
    const notifyScrollRatio = useCallback(() => {
      if (!scrollable || !onScrollRatioChange) {
        return;
      }
      const outer = outerRef.current;
      if (!outer) {
        return;
      }
      const maxScroll = outer.scrollHeight - outer.clientHeight;
      const ratio = maxScroll > 0 ? outer.scrollTop / maxScroll : 0;
      onScrollRatioChange(ratio);
    }, [scrollable, onScrollRatioChange]);

    useImperativeHandle(
      ref,
      () => ({
        scrollToRatio(ratio: number) {
          if (!scrollable) {
            return;
          }
          const outer = outerRef.current;
          if (!outer) {
            return;
          }
          const clampedRatio = Math.min(1, Math.max(0, ratio));
          const maxScroll = outer.scrollHeight - outer.clientHeight;
          outer.scrollTop = maxScroll > 0 ? clampedRatio * maxScroll : 0;
          notifyScrollRatio();
        },
        isPenActive() {
          return activePointerIdRef.current !== null;
        },
        isScrollable() {
          if (!scrollable) {
            return false;
          }
          const outer = outerRef.current;
          if (!outer) {
            return false;
          }
          return outer.scrollHeight > outer.clientHeight;
        },
      }),
      [scrollable, notifyScrollRatio],
    );

    // 디버그 로그 항목을 조립한다. `logGestureEvent`가 `isPointerDebugEnabled()`로 이미 걸러낸
    // 뒤에만 호출되므로 비활성 상태에서는 이 함수 자체가 호출되지 않는다(오버헤드 없음).
    function buildGestureDebugEntry(
      eventType: PointerDebugEventType,
      event: React.PointerEvent<HTMLCanvasElement>,
      activePointerIdBefore: number | null,
      extra?: Partial<PointerDebugEntry>,
    ): PointerDebugEntry {
      return {
        timestamp: performance.now(),
        eventType,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
        buttons: event.buttons,
        pressure: event.pressure,
        clientX: event.clientX,
        clientY: event.clientY,
        activePointerIdBefore,
        activePointerIdAfter: activePointerIdRef.current,
        drawing: activeStrokeRef.current !== null,
        coalescedCount: null,
        hasCapture: safeHasPointerCapture(event),
        strokeCount: strokesRef.current.length,
        ...extra,
      };
    }

    // 비활성 상태(`isPointerDebugEnabled()===false`)면 로그 엔트리 객체를 아예 만들지 않고 즉시
    // 반환한다 — 진입부에서 가벼운 boolean 체크 1회만 발생해 오버헤드가 사실상 없다.
    function logGestureEvent(
      eventType: PointerDebugEventType,
      event: React.PointerEvent<HTMLCanvasElement>,
      activePointerIdBefore: number | null,
      extra?: Partial<PointerDebugEntry>,
    ) {
      if (!isPointerDebugEnabled()) {
        return;
      }
      logPointerEvent(buildGestureDebugEntry(eventType, event, activePointerIdBefore, extra));
    }

    // 등록된 터치 포인터(들)의 이동으로 outer.scrollTop을 직접 구동한다. 손가락이 여러 개 동시에
    // 움직이면 각 포인터의 delta를 그대로 더하지 않고 "등록된 포인터 수로 나눈 평균"을 적용해서,
    // 손가락 2개가 같은 속도로 움직여도 스크롤이 2배로 빨라지지 않게 한다(포인터마다 별도의
    // pointermove 이벤트가 오므로, 이벤트마다 delta/포인터수를 누적하면 결과적으로 평균이 된다).
    //
    // `activePointerIdRef.current !== null`이면(펜이 현재 그리는 중이면) 무조건 무시한다 —
    // `handlePointerDown`의 등록 조건(`activePointerIdRef.current === null`)만으로는 "손바닥이
    // 먼저 화면에 닿아 스크롤 후보로 등록된 뒤, 곧이어 펜이 닿아 그리기 시작하는" 순서(실제 필기
    // 시 흔한 순서)를 막지 못한다 — 그 경우 이미 등록된 손바닥 터치가 그리는 도중 미세하게
    // 움직이며 스크롤을 유발할 수 있다. 이동 시점에도 다시 확인해서 펜이 그리는 동안에는 이미
    // 등록된 터치라도 스크롤을 절대 발동시키지 않게 한다(팜 리젝션 보장, design-agent 발견).
    function handleScrollTouchMove(event: React.PointerEvent<HTMLCanvasElement>) {
      if (activePointerIdRef.current !== null) {
        return;
      }
      const pointers = touchScrollPointersRef.current;
      const lastClientY = pointers.get(event.pointerId);
      if (lastClientY === undefined) {
        return;
      }

      const deltaY = lastClientY - event.clientY;
      pointers.set(event.pointerId, event.clientY);

      const outer = outerRef.current;
      if (!outer || pointers.size === 0) {
        return;
      }
      outer.scrollTop += deltaY / pointers.size;
      notifyScrollRatio();
    }

    function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
      const activePointerIdBefore = activePointerIdRef.current;
      try {
        if (event.pointerType === "touch") {
          // 펜으로 그리는 중이 아닐 때 시작된 터치만 스크롤 후보로 등록한다 — 펜이 그리는 도중 닿는
          // 손바닥(터치)은 절대 등록하지 않는다(팜 리젝션과 스크롤 기능이 서로 방해하지 않게 하는 핵심 규칙).
          if (scrollable && activePointerIdRef.current === null) {
            touchScrollPointersRef.current.set(event.pointerId, event.clientY);
          }
          return;
        }
        activePointerIdRef.current = event.pointerId;
        // iOS Safari(WebKit)는 애플펜슬 pointerId를 연속된 획 사이에서 재사용하는데, 직전 획의
        // 캡처 해제가 브라우저 내부적으로 완전히 정리되기 전에 같은 pointerId로 다시
        // `setPointerCapture`를 호출하면 예외를 던지는 경우가 있다(P0). 캡처는 "그리기 시작"의
        // 전제조건이 아니라 부가 기능(포인터가 캔버스 밖으로 나가도 이벤트를 계속 받기 위한 것)이므로,
        // 캡처 획득이 실패해도 아래 획 생성/렌더는 반드시 진행되어야 한다.
        let captureAcquired = true;
        try {
          event.currentTarget.setPointerCapture?.(event.pointerId);
        } catch {
          captureAcquired = false;
        }
        if (captureAcquired) {
          pointerCaptureDebtRef.current.set(
            event.pointerId,
            (pointerCaptureDebtRef.current.get(event.pointerId) ?? 0) + 1,
          );
        }
        pointerDownTimestampsRef.current.set(event.pointerId, performance.now());

        const point = toStrokePoint(event);
        activeStrokeRef.current = { tool, points: [point] };
        activeMaxYRef.current = point.y;
        // 리렌더 없이 즉시 그린다 — `render()`가 zero-dependency라 state를 전혀 거치지 않는다.
        render();
        maybeGrowContent();
      } finally {
        logGestureEvent("pointerdown", event, activePointerIdBefore);
      }
    }

    function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
      const activePointerIdBefore = activePointerIdRef.current;
      let coalescedCount: number | null = null;
      let firstDrawLatencyMs: number | undefined;
      try {
        if (event.pointerType === "touch") {
          if (scrollable) {
            handleScrollTouchMove(event);
          }
          return;
        }
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        const activeStroke = activeStrokeRef.current;
        if (!activeStroke) {
          return;
        }

        // rect는 이 pointermove 호출당 한 번만 계산해서 모든(coalesced 포함) 좌표 변환에 재사용한다
        // — coalesced 포인트 개수만큼 반복 호출하면 강제 리플로우가 늘어난다.
        const rect = event.currentTarget.getBoundingClientRect();
        const nativeEvent = event.nativeEvent;
        const coalescedEvents =
          typeof nativeEvent.getCoalescedEvents === "function"
            ? nativeEvent.getCoalescedEvents()
            : null;
        // 폴백(coalesced 미지원 환경)에서는 기존처럼 이 이벤트 하나만 반영한다. rAF나 별도 큐는
        // 도입하지 않는다 — 이벤트 하나(coalesced 포함)당 좌표를 전부 모은 뒤 `render()`/
        // `maybeGrowContent()`를 한 번만 호출하는 즉시-동기 방식을 그대로 유지한다.
        const pointsToApply =
          coalescedEvents && coalescedEvents.length > 0 ? coalescedEvents : [nativeEvent];
        coalescedCount = coalescedEvents ? coalescedEvents.length : null;

        const downTimestamp = pointerDownTimestampsRef.current.get(event.pointerId);
        let recordedFirstDraw = false;

        for (const rawPoint of pointsToApply) {
          const point = toStrokePointFromRect(rawPoint.clientX, rawPoint.clientY, rawPoint.pressure, rect);
          // 진행 중인 Stroke를 직접 mutate한다(React state를 거치지 않는다) — 이 배열은 아직
          // `onCommitStroke`로 전달되기 전이라 다른 곳에서 참조하지 않는다.
          activeStroke.points.push(point);
          if (point.y > activeMaxYRef.current) {
            activeMaxYRef.current = point.y;
          }
          if (!recordedFirstDraw && downTimestamp !== undefined) {
            firstDrawLatencyMs = performance.now() - downTimestamp;
            recordedFirstDraw = true;
          }
        }
        if (recordedFirstDraw) {
          pointerDownTimestampsRef.current.delete(event.pointerId);
        }

        // 리렌더 없이 즉시 그린다.
        render();
        // `scrollable`이면 그리는 도중에도 성장 임계값을 즉시 확인한다(획이 끝나야만 확장되는 지연
        // 회귀 방지, plan-agent 4단계 확정안) — `maybeGrowContent` 내부에서 `scrollable` 여부를
        // 다시 확인하므로 이중 가드는 아니다.
        maybeGrowContent();
      } finally {
        logGestureEvent("pointermove", event, activePointerIdBefore, {
          coalescedCount,
          firstDrawLatencyMs,
        });
      }
    }

    /** `pointerup`/`pointercancel` 공통 종료 로직 — 다른 pointerId면 완전히 무시한다. */
    function finishPointerGesture(event: React.PointerEvent<HTMLCanvasElement>) {
      if (scrollable && event.pointerType === "touch") {
        touchScrollPointersRef.current.delete(event.pointerId);
      }
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }
      activePointerIdRef.current = null;
      pointerDownTimestampsRef.current.delete(event.pointerId);

      const activeStroke = activeStrokeRef.current;
      if (activeStroke) {
        onCommitStroke(activeStroke);
      }
      // 여기서 `activeStrokeRef.current`를 바로 비우지 않는다 — 위 `strokes` prop 동기화 effect가
      // 새 값을 받아서 지울 때까지 유지해야 커밋 직후 화면이 끊기지 않는다(위 컴포넌트 JSDoc 참고).
    }

    function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
      const activePointerIdBefore = activePointerIdRef.current;
      try {
        finishPointerGesture(event);
      } finally {
        logGestureEvent("pointerup", event, activePointerIdBefore);
      }
    }

    // iOS Safari는 진행 중이던 포인터 제스처가 스크롤 등 다른 제스처로 전환될 때 `pointerup`
    // 대신 `pointercancel`을 보낼 수 있다. 이를 처리하지 않으면 `activePointerIdRef`가 풀리지
    // 않아 이후 `pointermove`/`pointerdown`이 무시되는 것처럼 보일 수 있어, `pointerup`과 동일하게
    // 캡처 상태를 정리한다.
    function handlePointerCancel(event: React.PointerEvent<HTMLCanvasElement>) {
      const activePointerIdBefore = activePointerIdRef.current;
      try {
        finishPointerGesture(event);
      } finally {
        logGestureEvent("pointercancel", event, activePointerIdBefore);
      }
    }

    // `setPointerCapture`가 걸린 상태에서 캔버스 경계를 스치는 흔한 필기 동작 중 `pointerleave`가
    // 발생하면(펜은 아직 떼지 않은 채로) `pointerup`/`pointercancel`과 똑같이 처리해서
    // `activePointerIdRef`를 null로 만들면, 캡처 덕분에 계속 같은 pointerId로 들어오는 후속
    // `pointermove`가 id 불일치로 전부 조용히 버려진다(P0 유실 버그 원인 중 하나, plan-agent P1
    // 확정안). 대신: 지금까지 쌓인 부분이 있으면 먼저 커밋하고, `activePointerIdRef.current`는
    // 절대 null로 만들지 않은 채 같은 tool의 새 빈 스트로크로 이어간다 — 캡처된 채로 같은
    // pointerId의 `pointermove`가 계속 들어올 때 새 활성 스트로크로 이어서 그려진다(획이 두 조각
    //으로 나뉠 수 있지만 "이후 완전히 안 써짐"은 사라진다). 진짜 종료 신호(`pointerup`/
    // `pointercancel`)만 `activePointerIdRef.current = null`로 완전히 정리한다.
    function handlePointerLeave(event: React.PointerEvent<HTMLCanvasElement>) {
      const activePointerIdBefore = activePointerIdRef.current;
      try {
        // 터치로 스크롤 후보 중이던 포인터가 `pointerup`/`pointercancel` 없이 캔버스 경계를 벗어나면
        // (좁은 화면/Split View에서 흔함) `touchScrollPointersRef`에서 정리하지 않는 한 유령 항목으로
        // 영구히 남아 `handleScrollTouchMove`의 평균 분모(`pointers.size`)를 계속 부풀려 이후 스크롤
        // 속도를 저하시킨다(`finishPointerGesture`와 동일한 정리, activePointerIdRef보다 먼저 실행 —
        // 터치 pointerId는 애초에 activePointerIdRef(펜 전용)와 같을 수 없어 아래 조기 return과
        // 순서가 바뀌어도 펜 로직에는 영향이 없다).
        if (scrollable && event.pointerType === "touch") {
          touchScrollPointersRef.current.delete(event.pointerId);
        }
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        const activeStroke = activeStrokeRef.current;
        if (activeStroke && activeStroke.points.length > 0) {
          onCommitStroke(activeStroke);
        }
        // 새 배열로 교체한다(커밋된 배열을 그대로 이어 쓰면 이미 부모에 전달된 Stroke를 나중에
        // mutate하게 된다) — activePointerIdRef는 그대로 유지한다.
        activeStrokeRef.current = { tool, points: [] };
      } finally {
        logGestureEvent("pointerleave", event, activePointerIdBefore);
      }
    }

    // `pointerup`/`pointercancel` 없이 캡처만 풀리는 비정상 상황(`lostpointercapture`) — 더 이상 이
    // pointerId로 들어올 이벤트가 없으므로 `pointerleave`와 달리 완전히 종료 처리한다: 지금까지
    // 쌓인 부분을 즉시 커밋하고 `activePointerIdRef`/`activeStrokeRef`를 모두 정리해서 다음
    // `pointerdown`이 깨끗한 상태에서 새 스트로크를 시작할 수 있게 한다.
    //
    // iOS Safari는 애플펜슬의 pointerId를 연속된 획 사이에서 재사용할 수 있다 — 획1의 `pointerup`이
    // `activePointerIdRef`를 이미 비우고(정상 커밋) 획2의 `pointerdown`이 같은 pointerId로 새 활성
    // 스트로크를 시작한 뒤에야, 획1의 capture-release에 대응하는 이 이벤트가 지연 도착하면 기존의
    // `activePointerIdRef.current !== event.pointerId` 체크만으로는 이를 걸러내지 못해(둘 다 같은
    // pointerId) 진행 중인 획2를 조기 커밋 후 완전히 종료시켜 버린다(P0 재발). `setPointerCapture`
    // 호출 1회당 `lostpointercapture`가 정확히 1번 언젠가 발생한다는 스펙을 이용해, 아직 처리되지
    // 않은 release가 2건 이상 쌓여 있으면(`debtBefore >= 2`) 이 이벤트를 "지금 활성 세션보다 오래된
    // stale 이벤트"로 판단하고 `activePointerIdRef`/`activeStrokeRef`/`pointerDownTimestampsRef`를
    // 전혀 건드리지 않은 채 무시한다.
    function handleLostPointerCapture(event: React.PointerEvent<HTMLCanvasElement>) {
      const activePointerIdBefore = activePointerIdRef.current;
      try {
        const debtBefore = pointerCaptureDebtRef.current.get(event.pointerId) ?? 0;
        const debtAfter = debtBefore - 1;
        if (debtAfter <= 0) {
          pointerCaptureDebtRef.current.delete(event.pointerId);
        } else {
          pointerCaptureDebtRef.current.set(event.pointerId, debtAfter);
        }
        if (debtBefore >= 2) {
          // 지연 도착한 stale release — 이미 새 세션(같은 pointerId)이 진행 중일 수 있으므로
          // activePointerIdRef/activeStrokeRef/pointerDownTimestampsRef를 절대 건드리지 않는다.
          return;
        }

        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        const activeStroke = activeStrokeRef.current;
        if (activeStroke && activeStroke.points.length > 0) {
          onCommitStroke(activeStroke);
        }
        activePointerIdRef.current = null;
        activeStrokeRef.current = null;
        pointerDownTimestampsRef.current.delete(event.pointerId);
      } finally {
        logGestureEvent("lostpointercapture", event, activePointerIdBefore);
      }
    }

    // 마운트/언마운트 시점을 디버그 로그에 남긴다(비활성 상태면 `logPointerEvent` 내부에서 no-op).
    useEffect(() => {
      if (isPointerDebugEnabled()) {
        logPointerEvent(
          buildLifecycleDebugEntry("mount", activePointerIdRef, activeStrokeRef, strokesRef),
        );
      }
      return () => {
        if (isPointerDebugEnabled()) {
          logPointerEvent(
            buildLifecycleDebugEntry("unmount", activePointerIdRef, activeStrokeRef, strokesRef),
          );
        }
      };
    }, []);

    // Long task 감지 워치독 — 비활성 상태면 effect 자체가 즉시 반환해 rAF 루프도 시작하지 않는다
    // (성능 영향 없음). `PerformanceObserver({entryTypes:["longtask"]})`를 시도하되, 생성자가
    // 던지거나 미지원이면 조용히 무시한다. 실제 감지는 `requestAnimationFrame`으로 두 프레임 사이
    // 실제 경과 시간이 `LONG_FRAME_THRESHOLD_MS`를 넘는지 보는 간단한 워치독이 담당한다(컴포넌트
    // 마운트 중에만 돌고, 언마운트 시 정리한다).
    useEffect(() => {
      if (!isPointerDebugEnabled()) {
        return;
      }

      let performanceObserver: PerformanceObserver | null = null;
      try {
        performanceObserver = new PerformanceObserver(() => {
          logPointerEvent(
            buildLifecycleDebugEntry(
              "longtask-fallback",
              activePointerIdRef,
              activeStrokeRef,
              strokesRef,
            ),
          );
        });
        performanceObserver.observe({ entryTypes: ["longtask"] });
      } catch {
        performanceObserver = null;
      }

      let cancelled = false;
      let rafId = 0;
      let lastFrameTime = performance.now();

      const watchdog = (now: number) => {
        if (now - lastFrameTime > LONG_FRAME_THRESHOLD_MS) {
          logPointerEvent(
            buildLifecycleDebugEntry(
              "longtask-fallback",
              activePointerIdRef,
              activeStrokeRef,
              strokesRef,
            ),
          );
        }
        lastFrameTime = now;
        if (!cancelled) {
          rafId = requestAnimationFrame(watchdog);
        }
      };
      rafId = requestAnimationFrame(watchdog);

      return () => {
        cancelled = true;
        cancelAnimationFrame(rafId);
        performanceObserver?.disconnect();
      };
    }, []);

    const canvasElement = (
      <canvas
        ref={canvasRef}
        className="solve-no-callout size-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
      />
    );

    if (!scrollable) {
      return (
        <div ref={outerRef} className="absolute inset-0 z-0">
          {canvasElement}
        </div>
      );
    }

    return (
      <div ref={outerRef} className="absolute inset-0 z-0 overflow-y-auto">
        <div ref={contentRef} className="relative w-full" style={{ height: contentHeight ?? "100%" }}>
          {canvasElement}
        </div>
      </div>
    );
  },
);

/** 마운트/언마운트/리사이즈/long-task처럼 특정 포인터 이벤트에 종속되지 않는 디버그 로그 항목을 조립한다. */
function buildLifecycleDebugEntry(
  eventType: PointerDebugEventType,
  activePointerIdRef: React.RefObject<number | null>,
  activeStrokeRef: React.RefObject<Stroke | null>,
  strokesRef: React.RefObject<Stroke[]>,
  extra?: Partial<PointerDebugEntry>,
): PointerDebugEntry {
  return {
    timestamp: performance.now(),
    eventType,
    activePointerIdBefore: activePointerIdRef.current,
    activePointerIdAfter: activePointerIdRef.current,
    drawing: activeStrokeRef.current !== null,
    coalescedCount: null,
    hasCapture: null,
    strokeCount: strokesRef.current.length,
    ...extra,
  };
}
