import type { Diagnosis, WorkLine } from "shared-types";
import type { Stroke } from "../canvas/useDrawingStrokes";

/**
 * `HandwritingHighlightOverlay`(features/drawing-canvas)가 그대로 렌더링할 수 있는 "막힌 지점"
 * 하이라이트 영역. 캔버스 좌표계(px) 기준 bounding box다.
 */
export interface HighlightRegion {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** `clusters.length`와 `workLines.length`가 정확히 일치할 때만 `"exact"`, 그 외 추정 경로는
   *  전부 `"approximate"`. Figma에는 신뢰도별 시각 구분이 없어(단일 variant) 렌더링에는
   *  쓰이지 않지만, 추후 시각 구분이 추가될 가능성에 대비해 데이터로 남겨둔다. */
  confidence: "exact" | "approximate";
}

/** 화면에 보이는 세로 위치 기준으로 재구성된 "한 줄" 단위 스트로크 묶음의 bounding box. */
export interface StrokeLineCluster {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

interface StrokeBBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  midY: number;
}

function computeStrokeBBox(stroke: Stroke): StrokeBBox | null {
  if (stroke.points.length === 0) {
    return null;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of stroke.points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }

  return { minX, maxX, minY, maxY, midY: (minY + maxY) / 2 };
}

/**
 * WORK 캔버스 스트로크(`workStrokes`)를 화면에 보이는 세로 위치 기준 "줄" 단위로 재구성한다.
 *
 * - 지우개 스트로크(`tool === "eraser"`)는 잉크 형상이 아니므로 bbox 계산에서 제외한다.
 * - 배열 순서가 아니라 각 스트로크의 `midY`(세로 중심) 오름차순으로 정렬한 뒤 그리디하게
 *   병합한다 — 지우고 다시 쓴 스트로크가 배열상 뒤에 있어도 화면에 보이는 세로 위치 기준으로
 *   같은 줄에 재배치되게 하기 위함이다.
 * - 정렬된 순서대로 "현재 클러스터의 `maxY`"와 "다음 스트로크의 `minY`" 차이가
 *   `lineGapThresholdPx` 이하면 같은 클러스터로, 초과하면 새 클러스터로 취급한다.
 */
export function clusterStrokesByLine(workStrokes: Stroke[], lineGapThresholdPx: number): StrokeLineCluster[] {
  const bboxes: StrokeBBox[] = [];
  for (const stroke of workStrokes) {
    if (stroke.tool !== "pen") {
      continue;
    }
    const bbox = computeStrokeBBox(stroke);
    if (bbox !== null) {
      bboxes.push(bbox);
    }
  }
  bboxes.sort((a, b) => a.midY - b.midY);

  const clusters: StrokeLineCluster[] = [];
  for (const bbox of bboxes) {
    const last = clusters[clusters.length - 1];
    if (last && bbox.minY - last.maxY <= lineGapThresholdPx) {
      last.minX = Math.min(last.minX, bbox.minX);
      last.maxX = Math.max(last.maxX, bbox.maxX);
      last.minY = Math.min(last.minY, bbox.minY);
      last.maxY = Math.max(last.maxY, bbox.maxY);
    } else {
      clusters.push({ minX: bbox.minX, maxX: bbox.maxX, minY: bbox.minY, maxY: bbox.maxY });
    }
  }
  return clusters;
}

function mergeClusters(a: StrokeLineCluster, b: StrokeLineCluster | undefined): StrokeLineCluster {
  if (!b) {
    return { ...a };
  }
  return {
    minX: Math.min(a.minX, b.minX),
    maxX: Math.max(a.maxX, b.maxX),
    minY: Math.min(a.minY, b.minY),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

// 클러스터링 시 "같은 줄"로 간주할 최대 세로 간격(px). 실기기 검증 전 잠정값 — 실기기 검증 후
// 조정 가능(오너 승인, work-order 6단계).
const LINE_GAP_THRESHOLD_PX = 32;

/**
 * WORK 캔버스 스트로크(`workStrokes`)와 그 인식 결과(`workLines`)를 진단 결과(`diagnosis`)에
 * 매핑해 "막힌 지점" 하이라이트 영역을 계산하는 순수함수. `deriveWorkLineJudgments.ts`와 동일한
 * 위치·스타일(순수함수, 판단 불가 시 예외를 던지지 않고 `null` 반환)을 따른다.
 *
 * 데이터 모델은 클라이언트 휴리스틱(스트로크 y좌표 클러스터링)이다 — 서버가 스트로크와 인식된
 * 줄의 대응 관계를 내려주지 않기 때문에, 클러스터 개수와 인식된 줄 개수를 비교해 신뢰도를
 * 추정한다(`diff === 0`이면 1:1 매핑 확신, `diff === 1`이면 비례 위치 추정 + 인접 클러스터
 * 병합으로 범위를 넓혀 안전 마진을 둔다, `diff >= 2`면 매핑을 포기한다).
 */
export function deriveHighlightRegion(
  workStrokes: Stroke[],
  workLines: WorkLine[],
  diagnosis: Diagnosis,
): HighlightRegion | null {
  // DIAG-4 "중단형" — 오류 없이 중단된 경우라 가리킬 잘못된 줄이 없다.
  if (diagnosis.stallLine === null) {
    return null;
  }
  if (workLines.length === 0) {
    return null;
  }

  const targetLineNo = diagnosis.stallLine;
  const clusters = clusterStrokesByLine(workStrokes, LINE_GAP_THRESHOLD_PX);
  if (clusters.length === 0) {
    return null;
  }

  const diff = Math.abs(clusters.length - workLines.length);

  let anchorIndex: number;
  let region: StrokeLineCluster;
  let confidence: HighlightRegion["confidence"];

  if (diff === 0) {
    // 클러스터 개수와 인식된 줄 개수가 정확히 같다 — 1:1 매핑으로 확신할 수 있다.
    anchorIndex = targetLineNo - 1;
    const exactCluster = clusters[anchorIndex];
    if (!exactCluster) {
      return null;
    }
    region = exactCluster;
    confidence = "exact";
  } else if (diff === 1) {
    // 클러스터 하나가 어긋나 있다 — 대상 줄의 비례 위치로 클러스터 인덱스를 추정한 뒤, 추정이
    // 빗나갔을 경우를 대비해 인접 클러스터(뒤가 있으면 뒤, 없으면 앞)까지 병합해 범위를 넓힌다.
    const proportion = (targetLineNo - 0.5) / workLines.length;
    const rawIndex = Math.round(proportion * clusters.length);
    anchorIndex = Math.min(Math.max(rawIndex, 0), clusters.length - 1);
    const approximateCluster = clusters[anchorIndex];
    if (!approximateCluster) {
      return null;
    }
    const adjacent = clusters[anchorIndex + 1] ?? clusters[anchorIndex - 1];
    region = mergeClusters(approximateCluster, adjacent);
    confidence = "approximate";
  } else {
    // 클러스터 개수가 인식된 줄 개수와 2줄 이상 어긋난다 — 매핑 신뢰도가 너무 낮아 하이라이트를
    // 생략한다.
    return null;
  }

  // 분수(`\frac`)처럼 여러 스트로크로 지그재그 배치될 가능성이 높은 표기는 한 줄이 여러
  // 클러스터에 걸쳐 있을 수 있으므로, 매핑된 클러스터의 다음 클러스터를 강제로 함께 포함한다.
  const targetLatex = workLines[targetLineNo - 1]?.latex;
  if (targetLatex?.includes("\\frac")) {
    const nextCluster = clusters[anchorIndex + 1];
    region = mergeClusters(region, nextCluster);
    confidence = "approximate";
  }

  return { ...region, confidence };
}
