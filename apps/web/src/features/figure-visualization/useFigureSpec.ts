import { useMemo } from "react";
import type { FigureSpec } from "shared-types";
import { figureSpecSchema, validateFigureSemantics } from "validation";

export type FigureSpecResult = { ok: true; spec: FigureSpec } | { ok: false; reason: string };

/**
 * 원시 도형 명세를 구조 스키마 → 의미 검증 순서로 확인한다(`parseSolutionFigures`와 같은 기준·사유 형식).
 * 사유 문자열은 개발용 화면·로그 전용이며 학생 화면에는 보이지 않는다(`docs/FIGURE_DESIGN.md` §8).
 */
export function parseFigureSpec(raw: unknown): FigureSpecResult {
  const parsed = figureSpecSchema.safeParse(raw);
  if (!parsed.success) {
    const summary = parsed.error.issues
      .slice(0, 3)
      .map((issue) => `${issue.path.map(String).join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    return { ok: false, reason: `invalid_figure: ${summary}` };
  }
  const semantics = validateFigureSemantics(parsed.data);
  if (!semantics.ok) {
    const summary = semantics.issues
      .slice(0, 3)
      .map((issue) => `${issue.code} at ${issue.path.map(String).join(".") || "(root)"}`)
      .join("; ");
    return { ok: false, reason: `invalid_semantics: ${summary}` };
  }
  return { ok: true, spec: parsed.data };
}

/** `parseFigureSpec`의 메모 훅. raw가 같은 참조면 다시 검사하지 않는다. */
export function useFigureSpec(raw: unknown): FigureSpecResult {
  return useMemo(() => parseFigureSpec(raw), [raw]);
}
