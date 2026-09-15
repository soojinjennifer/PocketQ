import { strokeToPath } from "./strokeToPath";
import { ERASER_SIZE, INK_COLOR, PEN_SIZE } from "./strokeStyle";
import type { Stroke } from "./useDrawingStrokes";

/** 획 bounding box 바깥으로 확보하는 여백(px) — 획 가장자리가 캔버스 경계에 바로 붙어 잘리지 않도록 한다. */
const EXPORT_PADDING = 24;

/**
 * 내보내는 이미지의 긴 변 최대 픽셀 — 오너 승인 범위(1600~2000px) 안에서 orchestrator가 확정한 값.
 * 카메라 사진 경로(`resizeImageBlob.ts`, 최대 1568px)와 별도로 관리하되 같은 목적(AI 인식 전송량
 * 절감)이다. 원본이 이 값보다 작으면 확대하지 않는다.
 */
const EXPORT_MAX_DIMENSION = 1600;

/** JPEG 인코딩 품질 — 오너 승인 범위(0.80~0.88) 안에서 orchestrator가 확정한 값. */
const EXPORT_JPEG_QUALITY = 0.85;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBounds(strokes: Stroke[]): Bounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const stroke of strokes) {
    for (const point of stroke.points) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    return null;
  }

  return { minX, minY, maxX, maxY };
}

function drawStrokesToContext(ctx: CanvasRenderingContext2D, strokes: Stroke[], offsetX: number, offsetY: number): void {
  ctx.translate(offsetX, offsetY);
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
}

/**
 * 필기 획(strokes)을 불투명 흰 배경 + 실제 잉크만 있는 JPEG Blob으로 내보낸다.
 * Figma 종이 질감/캔버스 텍스처(`bg-canvas-texture`)는 화면 표시 전용이며 AI 인식 정확도를 방해하지
 * 않도록 이 export에는 포함하지 않는다(오너 확정).
 *
 * 화면 캔버스의 실제 픽셀 크기(컨테이너 크기)에 의존하지 않고, 획 좌표의 bounding box + 여백만으로
 * 캔버스 크기를 정한다 — stroke 데이터만 주어지면 항상 같은 결과가 나오는 결정적 함수다.
 *
 * 지우개 획이 배경까지 투명하게 뚫어버리지 않도록(캔버스는 배경 없이 투명하다는 전제로 그려지므로)
 * 잉크만 투명 레이어에 먼저 그린 뒤, 불투명 흰 배경 위에 합성하는 2단계로 처리한다.
 *
 * 합성된 결과의 긴 변이 `EXPORT_MAX_DIMENSION`을 넘으면 비율을 유지한 채 축소한 뒤(카메라 사진
 * 경로 `resizeImageBlob.ts`와 동일한 접근), `EXPORT_JPEG_QUALITY` 품질로 JPEG 인코딩한다 — 오너
 * 승인(리사이즈+압축 도입, 긴 변 1600~2000px, 품질 0.80~0.88) 범위 내 확정값(2026-09).
 */
export async function exportStrokesToJpegBlob(strokes: Stroke[]): Promise<Blob | null> {
  const bounds = computeBounds(strokes);
  if (!bounds) {
    return null;
  }

  const width = Math.ceil(bounds.maxX - bounds.minX) + EXPORT_PADDING * 2;
  const height = Math.ceil(bounds.maxY - bounds.minY) + EXPORT_PADDING * 2;

  const inkCanvas = document.createElement("canvas");
  inkCanvas.width = width;
  inkCanvas.height = height;
  const inkCtx = inkCanvas.getContext("2d");
  if (!inkCtx) {
    return null;
  }
  drawStrokesToContext(inkCtx, strokes, -bounds.minX + EXPORT_PADDING, -bounds.minY + EXPORT_PADDING);

  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputCtx = outputCanvas.getContext("2d");
  if (!outputCtx) {
    return null;
  }
  outputCtx.fillStyle = "#ffffff";
  outputCtx.fillRect(0, 0, width, height);
  outputCtx.drawImage(inkCanvas, 0, 0);

  const finalCanvas = resizeToMaxDimension(outputCanvas, EXPORT_MAX_DIMENSION);

  return new Promise((resolve) => {
    finalCanvas.toBlob((blob) => resolve(blob), "image/jpeg", EXPORT_JPEG_QUALITY);
  });
}

/**
 * 캔버스의 긴 변이 `maxDimension`을 넘으면 비율을 유지한 채 새 캔버스에 축소해 그린다. 넘지 않으면
 * (원본 대비 불필요한 확대를 피하기 위해) 입력 캔버스를 그대로 반환한다.
 * `resizeImageBlob.ts`의 리사이즈 규칙과 동일한 접근을 캔버스 소스에 대해 적용한 버전이다.
 */
function resizeToMaxDimension(source: HTMLCanvasElement, maxDimension: number): HTMLCanvasElement {
  const longestSide = Math.max(source.width, source.height);
  if (longestSide <= maxDimension) {
    return source;
  }

  const scale = maxDimension / longestSide;
  const targetWidth = Math.round(source.width * scale);
  const targetHeight = Math.round(source.height * scale);

  const scaledCanvas = document.createElement("canvas");
  scaledCanvas.width = targetWidth;
  scaledCanvas.height = targetHeight;
  const scaledCtx = scaledCanvas.getContext("2d");
  if (!scaledCtx) {
    return source;
  }
  scaledCtx.drawImage(source, 0, 0, targetWidth, targetHeight);
  return scaledCanvas;
}
