/** 테스트 전용 — fixture를 스키마·의미 검증해 명세와 계산 결과를 돌려준다. */
import type { FigureSpec } from "shared-types";
import { figureSpecSchema, validateFigureSemantics, type ResolvedFigure } from "validation";

export function loadFixture(raw: unknown): { spec: FigureSpec; resolved: ResolvedFigure } {
  const spec = figureSpecSchema.parse(raw);
  const result = validateFigureSemantics(spec);
  if (!result.ok) throw new Error(`fixture 의미 검증 실패: ${JSON.stringify(result.issues)}`);
  return { spec, resolved: result.resolved };
}

export function point(id: string, x: number, y: number, role: "given" | "auxiliary" | "result" = "given") {
  return { id, type: "point", label: id, role, appearAt: null, x, y };
}

export function geometryRaw(
  figureId: string,
  boundingBox: [number, number, number, number],
  elements: unknown[],
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    figureId,
    kind: "geometry",
    description: "테스트 도형",
    boundingBox,
    axes: { visible: false, xLabel: null, yLabel: null },
    grid: { visible: false },
    keepAspectRatio: true,
    interaction: { mode: "fixed" },
    elements,
    constraints: [],
    steps: [],
    ...extra,
  };
}
