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
import type { Stroke, StrokePoint } from "../../shared/lib/canvas/useDrawingStrokes";

interface HandwritingCanvasProps {
  strokes: Stroke[];
  /** `pointerdown`(새 제스처 시작) 시 호출한다 — 항상 새 Stroke를 시작해야 한다. */
  onStartStroke: (point: StrokePoint) => void;
  /** `pointermove`(이어그리기) 시 호출한다 — 진행 중인 Stroke에 좌표를 이어붙인다. */
  onAddPoint: (point: StrokePoint) => void;
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
 * `scrollable` 모드에서 상위(page)가 스크롤 인디케이터(`SolveScroll`)를 구현할 수 있도록 노출하는
 * 최소 imperative handle. `scrollable=false`일 때는 `scrollToRatio`가 완전히 no-op이다.
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

/**
 * Figma 필기 캔버스 레이어 — 화면 전체를 덮는 절대 위치 `<canvas>`(`absolute inset-0`).
 * `ResizeObserver`로 컨테이너 크기 변화에 devicePixelRatio 스케일을 재적용하고,
 * Pointer Events로 획을 입력받아 매 프레임 `strokes` 전체를 다시 그린다.
 * 펜 획은 `ctx.fill(path)`, 지우개 획은 `globalCompositeOperation="destination-out"`으로 렌더링해서
 * undo/clear가 지우개 동작도 동일하게 되돌릴 수 있게 한다.
 * 손바닥/터치 오터치(`pointerType === "touch"`)는 무시하고, 펜과 마우스(개발 편의) 입력만 허용한다.
 * `pointerdown`은 항상 새 획의 시작을 의미하므로 `onStartStroke`를, `pointermove`는 이어그리기이므로
 * `onAddPoint`를 명확히 구분해 호출한다(현재 선택된 tool이 무엇이든 획 시작 시점의 tool로 고정된다).
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
    { strokes, onStartStroke, onAddPoint, scrollable = false, onScrollRatioChange, onScrollableChange },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const outerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const activePointerIdRef = useRef<number | null>(null);
    // `scrollable`일 때만 사용한다 — pointerId → 마지막 clientY. 펜으로 그리는 중이 아닐 때 시작된
    // 터치 포인터만 여기 등록된다(팜 리젝션 유지: 펜이 그리는 도중 닿는 손바닥은 등록되지 않는다).
    const touchScrollPointersRef = useRef<Map<number, number>>(new Map());
    // `scrollable`일 때만 사용한다 — outer(뷰포트) 높이 실측값. content 최초 높이/확장 단위로 쓴다.
    const outerHeightRef = useRef(0);
    const [contentHeight, setContentHeight] = useState<number | null>(null);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        return;
      }

      const ratio = window.devicePixelRatio || 1;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

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
      ctx.globalCompositeOperation = "source-over";
    }, [strokes]);

    useEffect(() => {
      render();
    }, [render]);

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
    // 크기를 따라간다(가로 폭만 outer 기준으로 고정).
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
          canvas.width = Math.round(rect.width * ratio);
          canvas.height = Math.round(rect.height * ratio);
          canvas.style.width = `${rect.width}px`;
          canvas.style.height = `${rect.height}px`;
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
        canvas.width = Math.round(outerRect.width * ratio);
        canvas.height = Math.round(contentRect.height * ratio);
        canvas.style.width = `${outerRect.width}px`;
        canvas.style.height = `${contentRect.height}px`;
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
    }, [render, scrollable, notifyScrollable]);

    // 학생이 쓴 내용이 content 하단 근처(threshold)까지 닿으면 outer 높이만큼 content를 늘린다
    // (동적 성장, 상한 없음 — 오너 승인).
    useEffect(() => {
      if (!scrollable || contentHeight === null || outerHeightRef.current === 0) {
        return;
      }

      let maxY = 0;
      for (const stroke of strokes) {
        for (const point of stroke.points) {
          if (point.y > maxY) {
            maxY = point.y;
          }
        }
      }

      if (maxY >= contentHeight * SCROLL_GROWTH_THRESHOLD_RATIO) {
        setContentHeight((prev) => (prev ?? outerHeightRef.current) + outerHeightRef.current);
      }
    }, [strokes, scrollable, contentHeight]);

    // 콘텐츠 높이가 바뀔 때마다(성장 로직 직후 포함) 실제 스크롤 가능 여부를 다시 확인한다 — 위
    // 리사이즈 effect의 `measureOuterHeight`/`resizeCanvasToContent`가 outer/content
    // `ResizeObserver` 콜백 시점에 이미 `notifyScrollable()`을 호출하지만, `contentHeight`
    // state로 트리거되는 확장 로직(아래 다음 effect)은 DOM 레이아웃이 아니라 React state로
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

    function toStrokePoint(event: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        pressure: event.pressure > 0 ? event.pressure : 0.5,
      };
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
      if (event.pointerType === "touch") {
        // 펜으로 그리는 중이 아닐 때 시작된 터치만 스크롤 후보로 등록한다 — 펜이 그리는 도중 닿는
        // 손바닥(터치)은 절대 등록하지 않는다(팜 리젝션과 스크롤 기능이 서로 방해하지 않게 하는 핵심 규칙).
        if (scrollable && activePointerIdRef.current === null) {
          touchScrollPointersRef.current.set(event.pointerId, event.clientY);
        }
        return;
      }
      activePointerIdRef.current = event.pointerId;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      onStartStroke(toStrokePoint(event));
    }

    function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
      if (event.pointerType === "touch") {
        if (scrollable) {
          handleScrollTouchMove(event);
        }
        return;
      }
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }
      onAddPoint(toStrokePoint(event));
    }

    function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
      if (scrollable && event.pointerType === "touch") {
        touchScrollPointersRef.current.delete(event.pointerId);
      }
      if (activePointerIdRef.current !== event.pointerId) {
        return;
      }
      activePointerIdRef.current = null;
    }

    // iOS Safari는 진행 중이던 포인터 제스처가 스크롤 등 다른 제스처로 전환될 때 `pointerup`
    // 대신 `pointercancel`을 보낼 수 있다. 이를 처리하지 않으면 `activePointerIdRef`가 풀리지
    // 않아 이후 `pointermove`/`pointerdown`이 무시되는 것처럼 보일 수 있어, `pointerup`과 동일하게
    // 캡처 상태를 정리한다.
    function handlePointerCancel(event: React.PointerEvent<HTMLCanvasElement>) {
      handlePointerUp(event);
    }

    const canvasElement = (
      <canvas
        ref={canvasRef}
        className="solve-no-callout size-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
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
