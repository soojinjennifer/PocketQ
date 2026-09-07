import { describe, expect, it } from "vitest";
import type { Diagnosis, WorkLine } from "shared-types";
import type { Stroke, StrokePoint } from "../canvas/useDrawingStrokes";
import { clusterStrokesByLine, deriveHighlightRegion } from "./deriveHighlightRegion";

function point(x: number, y: number): StrokePoint {
  return { x, y, pressure: 0.5 };
}

function penStroke(...points: StrokePoint[]): Stroke {
  return { tool: "pen", points };
}

function eraserStroke(...points: StrokePoint[]): Stroke {
  return { tool: "eraser", points };
}

function createWorkLines(count: number): WorkLine[] {
  return Array.from({ length: count }, (_, index) => ({
    lineNo: index + 1,
    latex: `line-${index + 1}`,
    isLowConfidence: false,
  }));
}

function createDiagnosis(overrides: Partial<Diagnosis> = {}): Diagnosis {
  return {
    lastValidLine: 0,
    stallLine: null,
    errorTypeLabel: null,
    errorDetail: null,
    relatedConcepts: [],
    reachedAnswerWithNotes: false,
    isLowConfidence: false,
    conceptExplanations: [],
    identifiedMethod: null,
    isMethodApplicable: true,
    methodApplicabilityNote: null,
    problemAnswerLatex: "-1",
    ...overrides,
  };
}

describe("clusterStrokesByLine", () => {
  it("y좌표가 가까운 스트로크를 하나의 클러스터로 병합한다", () => {
    const strokes = [penStroke(point(10, 10), point(20, 20)), penStroke(point(30, 15), point(40, 25))];

    const clusters = clusterStrokesByLine(strokes, 32);

    expect(clusters).toEqual([{ minX: 10, maxX: 40, minY: 10, maxY: 25 }]);
  });

  it("y간격이 임계값을 초과하면 별도 클러스터로 분리한다", () => {
    const strokes = [penStroke(point(10, 10), point(20, 20)), penStroke(point(10, 100), point(20, 110))];

    const clusters = clusterStrokesByLine(strokes, 32);

    expect(clusters).toEqual([
      { minX: 10, maxX: 20, minY: 10, maxY: 20 },
      { minX: 10, maxX: 20, minY: 100, maxY: 110 },
    ]);
  });

  it("지우개 스트로크는 클러스터 계산에서 제외한다", () => {
    const strokes = [
      penStroke(point(10, 10), point(20, 20)),
      eraserStroke(point(0, 0), point(500, 500)),
    ];

    const clusters = clusterStrokesByLine(strokes, 32);

    expect(clusters).toEqual([{ minX: 10, maxX: 20, minY: 10, maxY: 20 }]);
  });

  it("배열 순서가 아니라 최종 세로 위치(midY) 기준으로 클러스터링한다(지우고 다시 쓴 스트로크가 뒤에 있어도)", () => {
    // 배열상으로는 "두 번째 줄"(y=100)이 먼저 오고, 지우고 다시 쓴 "첫 번째 줄"(y=10)이 뒤에 있다.
    const strokes = [
      penStroke(point(10, 100), point(20, 110)),
      penStroke(point(10, 10), point(20, 20)),
    ];

    const clusters = clusterStrokesByLine(strokes, 32);

    expect(clusters).toEqual([
      { minX: 10, maxX: 20, minY: 10, maxY: 20 },
      { minX: 10, maxX: 20, minY: 100, maxY: 110 },
    ]);
  });
});

describe("deriveHighlightRegion", () => {
  it("stallLine===null(중단형)이면 null을 반환한다", () => {
    const strokes = [penStroke(point(10, 10), point(20, 20))];
    const diagnosis = createDiagnosis({ stallLine: null });

    expect(deriveHighlightRegion(strokes, createWorkLines(1), diagnosis)).toBeNull();
  });

  it("클러스터 개수와 workLines 개수가 같으면(diff=0) exact로 1:1 매핑한다", () => {
    const strokes = [
      penStroke(point(10, 10), point(20, 20)),
      penStroke(point(10, 100), point(30, 110)),
    ];
    const diagnosis = createDiagnosis({ stallLine: 2 });

    const region = deriveHighlightRegion(strokes, createWorkLines(2), diagnosis);

    expect(region).toEqual({ minX: 10, maxX: 30, minY: 100, maxY: 110, confidence: "exact" });
  });

  it("클러스터 개수가 workLines보다 1개 많으면(diff=1) 비례 위치로 근사 매핑하고 인접 클러스터를 병합한다", () => {
    // workLines 2줄, 클러스터 3개(중간 줄이 두 스트로크로 나뉘어 인식된 상황을 흉내).
    const strokes = [
      penStroke(point(0, 10), point(10, 20)),
      penStroke(point(0, 100), point(10, 110)),
      penStroke(point(0, 200), point(10, 210)),
    ];
    const diagnosis = createDiagnosis({ stallLine: 2 });

    const region = deriveHighlightRegion(strokes, createWorkLines(2), diagnosis);

    expect(region).not.toBeNull();
    expect(region?.confidence).toBe("approximate");
    // targetLineNo=2, workLines.length=2 → proportion=(2-0.5)/2=0.75, rawIndex=round(0.75*3)=2(마지막
    // 클러스터, y=200) → 다음 클러스터가 없으므로 앞 클러스터(y=100)와 병합.
    expect(region).toEqual({ minX: 0, maxX: 10, minY: 100, maxY: 210, confidence: "approximate" });
  });

  it("클러스터 개수가 workLines와 2개 이상 어긋나면(diff>=2) null을 반환한다", () => {
    const strokes = [
      penStroke(point(0, 10), point(10, 20)),
      penStroke(point(0, 100), point(10, 110)),
      penStroke(point(0, 200), point(10, 210)),
      penStroke(point(0, 300), point(10, 310)),
    ];
    const diagnosis = createDiagnosis({ stallLine: 1 });

    expect(deriveHighlightRegion(strokes, createWorkLines(2), diagnosis)).toBeNull();
  });

  it("대상 줄 latex에 \\frac이 포함되면 다음 클러스터를 강제 병합하고 confidence를 approximate로 낮춘다", () => {
    const strokes = [
      penStroke(point(0, 10), point(10, 20)),
      penStroke(point(0, 100), point(10, 110)),
    ];
    const workLines: WorkLine[] = [
      { lineNo: 1, latex: "x=1", isLowConfidence: false },
      { lineNo: 2, latex: "\\frac{1}{2}", isLowConfidence: false },
    ];
    const diagnosis = createDiagnosis({ stallLine: 2 });

    const region = deriveHighlightRegion(strokes, workLines, diagnosis);

    // diff=0이라 원래는 exact로 clusters[1](y=100)만 매핑되지만, \frac 포함으로 다음 클러스터
    // (존재하지 않음)를 강제 병합 시도 후 confidence만 approximate로 낮춘다.
    expect(region).toEqual({ minX: 0, maxX: 10, minY: 100, maxY: 110, confidence: "approximate" });
  });

  it("대상 줄 latex에 \\frac이 포함되고 다음 클러스터가 존재하면 병합한 영역을 반환한다", () => {
    const strokes = [
      penStroke(point(0, 10), point(10, 20)),
      penStroke(point(0, 100), point(10, 110)),
      penStroke(point(0, 200), point(10, 210)),
    ];
    const workLines: WorkLine[] = [
      { lineNo: 1, latex: "\\frac{1}{2}", isLowConfidence: false },
      { lineNo: 2, latex: "x=1", isLowConfidence: false },
      { lineNo: 3, latex: "x=2", isLowConfidence: false },
    ];
    const diagnosis = createDiagnosis({ stallLine: 1 });

    const region = deriveHighlightRegion(strokes, workLines, diagnosis);

    expect(region).toEqual({ minX: 0, maxX: 10, minY: 10, maxY: 110, confidence: "approximate" });
  });

  it("workLines가 비어 있으면 null을 반환한다", () => {
    const strokes = [penStroke(point(0, 10), point(10, 20))];
    const diagnosis = createDiagnosis({ stallLine: 1 });

    expect(deriveHighlightRegion(strokes, [], diagnosis)).toBeNull();
  });

  it("스트로크가 하나도 없으면(클러스터 0개) null을 반환한다", () => {
    const diagnosis = createDiagnosis({ stallLine: 1 });

    expect(deriveHighlightRegion([], createWorkLines(1), diagnosis)).toBeNull();
  });
});
