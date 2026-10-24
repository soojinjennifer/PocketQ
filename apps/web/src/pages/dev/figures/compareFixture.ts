/** 개발 미리보기용 — fixture 기대값(손 계산)과 검증 커널 계산값을 나란히 놓는다. */
import { figureSpecSchema, formatFigureNumber, validateFigureSemantics, type ResolvedFigureElement } from "validation";
import type { FigureFixture } from "validation/fixtures";

export interface ComparisonRow {
  id: string;
  expected: string;
  actual: string;
  difference: string;
}

function format(value: number): string {
  return Number.isFinite(value) ? String(Number(value.toFixed(12))) : "—";
}

export function compareFixture(fixture: FigureFixture): ComparisonRow[] {
  const parsed = figureSpecSchema.safeParse(fixture.raw);
  if (!parsed.success) return [];
  const semantics = validateFigureSemantics(parsed.data);
  const resolved = semantics.ok ? semantics.resolved.elements : new Map<string, ResolvedFigureElement>();
  const rows: ComparisonRow[] = [];

  for (const point of fixture.expected?.points ?? []) {
    const element = resolved.get(point.id);
    const xy = element?.kind === "point" ? element.xy : null;
    rows.push({
      id: point.id,
      expected: `(${format(point.x)}, ${format(point.y)})`,
      actual: xy === null ? "—" : `(${format(xy.x)}, ${format(xy.y)})`,
      difference: xy === null ? "—" : format(Math.hypot(xy.x - point.x, xy.y - point.y)),
    });
  }
  for (const angle of fixture.expected?.angles ?? []) {
    const element = resolved.get(angle.id);
    const degrees = element?.kind === "angle" ? element.degrees : null;
    rows.push({
      id: angle.id,
      expected: formatFigureNumber(angle.degrees, { unit: "angle" }),
      actual: degrees === null ? "—" : `${format(degrees)}°`,
      difference: degrees === null ? "—" : format(Math.abs(degrees - angle.degrees)),
    });
  }
  for (const discontinuity of fixture.expected?.discontinuities ?? []) {
    const element = resolved.get(discontinuity.graph);
    const pieces = element?.kind === "graph" ? element.pieces : [];
    const spans = pieces.some((piece) => piece.some((p) => p.x < discontinuity.x) && piece.some((p) => p.x > discontinuity.x));
    rows.push({
      id: `${discontinuity.graph} 불연속`,
      expected: `x = ${format(discontinuity.x)}에서 끊김`,
      actual: `조각 ${pieces.length}개, ${spans ? "가로지름" : "끊김"}`,
      difference: spans ? "불일치" : "일치",
    });
  }
  return rows;
}
