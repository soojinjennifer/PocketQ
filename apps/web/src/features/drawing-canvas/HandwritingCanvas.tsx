import { useCallback, useEffect, useRef } from "react";
import { strokeToPath } from "../../shared/lib/canvas/strokeToPath";
import { ERASER_SIZE, INK_COLOR, PEN_SIZE } from "../../shared/lib/canvas/strokeStyle";
import type { Stroke, StrokePoint } from "../../shared/lib/canvas/useDrawingStrokes";

interface HandwritingCanvasProps {
  strokes: Stroke[];
  /** `pointerdown`(새 제스처 시작) 시 호출한다 — 항상 새 Stroke를 시작해야 한다. */
  onStartStroke: (point: StrokePoint) => void;
  /** `pointermove`(이어그리기) 시 호출한다 — 진행 중인 Stroke에 좌표를 이어붙인다. */
  onAddPoint: (point: StrokePoint) => void;
}

/**
 * Figma 필기 캔버스 레이어 — 화면 전체를 덮는 절대 위치 `<canvas>`(`absolute inset-0`).
 * `ResizeObserver`로 컨테이너 크기 변화에 devicePixelRatio 스케일을 재적용하고,
 * Pointer Events로 획을 입력받아 매 프레임 `strokes` 전체를 다시 그린다.
 * 펜 획은 `ctx.fill(path)`, 지우개 획은 `globalCompositeOperation="destination-out"`으로 렌더링해서
 * undo/clear가 지우개 동작도 동일하게 되돌릴 수 있게 한다.
 * 손바닥/터치 오터치(`pointerType === "touch"`)는 무시하고, 펜과 마우스(개발 편의) 입력만 허용한다.
 * `pointerdown`은 항상 새 획의 시작을 의미하므로 `onStartStroke`를, `pointermove`는 이어그리기이므로
 * `onAddPoint`를 명확히 구분해 호출한다(현재 선택된 tool이 무엇이든 획 시작 시점의 tool로 고정된다).
 */
export function HandwritingCanvas({ strokes, onStartStroke, onAddPoint }: HandwritingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointerIdRef = useRef<number | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) {
      return;
    }

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * ratio);
      canvas.height = Math.round(rect.height * ratio);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      render();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    return () => observer.disconnect();
  }, [render]);

  function toStrokePoint(event: React.PointerEvent<HTMLCanvasElement>): StrokePoint {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      pressure: event.pressure > 0 ? event.pressure : 0.5,
    };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "touch") {
      return;
    }
    activePointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onStartStroke(toStrokePoint(event));
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }
    onAddPoint(toStrokePoint(event));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
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

  return (
    <div ref={containerRef} className="absolute inset-0 z-0">
      <canvas
        ref={canvasRef}
        className="solve-no-callout size-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />
    </div>
  );
}
