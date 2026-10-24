/**
 * AI가 생성한 도형 후보 1개를 검증한다(Stage 3) — `docs/FIGURE_SPEC.md` §16.
 *
 * `parseSolutionFigures`(관대 파서, 저장·재조회 경로)는 그대로 두고, AI 경로 전용으로
 * - 실패 이유를 **보정 요청에 실을 수 있는 형태**(code + path만)로 돌려주고,
 * - 풀이 단계 범위(`step_out_of_range`)와 수치 표시 근거(`measure_without_constraint`)를 추가로 검사한다.
 *
 * 받아들인 도형은 항상 zod 출력 객체다(입력 객체를 그대로 넘기지 않는다). 절대 throw하지 않는다.
 *
 * 이 모듈은 최상위에서 함수 호출을 하지 않는다(웹 번들에서 사용하지 않을 때 트리 셰이킹되도록).
 */
import type { FigureSpec } from "shared-types";
import { FIGURE_SCHEMA_VERSION, figureSpecSchema } from "../figures";
import { validateFigureSemantics, type FigureSemanticIssueCode } from "./semantics";
import { checkFigureStepRange } from "./steps";

/** zod 4 issue code. */
type ZodIssueCodeName =
  | "invalid_type"
  | "too_big"
  | "too_small"
  | "invalid_format"
  | "not_multiple_of"
  | "unrecognized_keys"
  | "invalid_union"
  | "invalid_key"
  | "invalid_element"
  | "invalid_value"
  | "custom";

export type FigureCandidateErrorCode =
  | FigureSemanticIssueCode
  | ZodIssueCodeName
  | "step_out_of_range"
  | "measure_without_constraint"
  | "unsupported_schema_version"
  | "invalid";

export interface FigureCandidateError {
  code: FigureCandidateErrorCode;
  path: (string | number)[];
}

export type FigureCandidateResult =
  | { ok: true; figure: FigureSpec }
  | { ok: false; figureId?: string; errors: FigureCandidateError[] };

/** 보정 요청에 싣는 오류 최대 건수. */
export const MAX_FIGURE_REPAIR_ERRORS = 10;

/** 보정 요청에 실을 수 있는 code(이 목록 밖은 `"invalid"`로 바꾼다). 객체 리터럴 — 최상위 호출 없음. */
const ALLOWED_REPAIR_CODES: Record<FigureCandidateErrorCode, true> = {
  unknown_reference: true,
  forward_reference: true,
  self_reference: true,
  type_mismatch: true,
  duplicate_reference: true,
  unsupported: true,
  unknown_step: true,
  step_order: true,
  not_yet_visible: true,
  invalid_bounding_box: true,
  degenerate: true,
  point_out_of_view: true,
  radius_too_large: true,
  circle_out_of_view: true,
  line_out_of_view: true,
  dependency_not_visible: true,
  no_solution: true,
  invalid_pick: true,
  no_tangent: true,
  degenerate_tangent: true,
  self_intersecting: true,
  constraint_violation: true,
  graph_not_visible: true,
  out_of_domain: true,
  undefined_at_point: true,
  compute_budget_exceeded: true,
  unexpected_error: true,
  invalid_type: true,
  too_big: true,
  too_small: true,
  invalid_format: true,
  not_multiple_of: true,
  unrecognized_keys: true,
  invalid_union: true,
  invalid_key: true,
  invalid_element: true,
  invalid_value: true,
  custom: true,
  step_out_of_range: true,
  measure_without_constraint: true,
  unsupported_schema_version: true,
  invalid: true,
};

const FIGURE_ID_PATTERN = /^fig-[a-z0-9]{1,16}$/;
const PATH_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAllowedCode(code: string): code is FigureCandidateErrorCode {
  return Object.prototype.hasOwnProperty.call(ALLOWED_REPAIR_CODES, code);
}

/** 후보에서 형식이 올바른 figureId만 읽는다(악성 문자열을 로그·보정 요청에 옮기지 않기 위해). */
export function readCandidateFigureId(candidate: unknown): string | undefined {
  try {
    if (!isRecord(candidate)) return undefined;
    const figureId = candidate["figureId"];
    return typeof figureId === "string" && FIGURE_ID_PATTERN.test(figureId) ? figureId : undefined;
  } catch {
    return undefined;
  }
}

/** 경로 조각을 정수 또는 `^[A-Za-z][A-Za-z0-9_]{0,31}$`만 남기고, 그 밖의 조각이 나오면 거기서 자른다. */
function sanitizePath(path: readonly PropertyKey[]): (string | number)[] {
  const safe: (string | number)[] = [];
  for (const segment of path) {
    if (typeof segment === "number" && Number.isInteger(segment) && segment >= 0 && segment < 1e6) {
      safe.push(segment);
    } else if (typeof segment === "string" && PATH_KEY_PATTERN.test(segment)) {
      safe.push(segment);
    } else {
      break;
    }
  }
  return safe;
}

/**
 * 보정 프롬프트에 실을 오류 목록으로 정제한다: 허용 code(그 밖은 `"invalid"`) + 정제된 path만,
 * 최대 `MAX_FIGURE_REPAIR_ERRORS`건. zod message·unrecognized_keys 목록·값은 싣지 않는다.
 */
export function toRepairErrors(errors: readonly { code: string; path: readonly PropertyKey[] }[]): FigureCandidateError[] {
  return errors.slice(0, MAX_FIGURE_REPAIR_ERRORS).map((error) => ({
    code: isAllowedCode(error.code) ? error.code : "invalid",
    path: sanitizePath(error.path),
  }));
}

/**
 * `showLength`/`showMeasure`를 켰는데 대응하는 `length`/`angleMeasure` 제약이 없으면 오류다(AI 경로 전용).
 * 렌더러가 좌표로 계산한 값을 "조건"처럼 보여주지 않게 하기 위한 규칙(D5).
 */
export function checkMeasureConstraints(figure: FigureSpec): FigureCandidateError[] {
  const lengthTargets: string[] = [];
  const angleTargets: string[] = [];
  for (const constraint of figure.constraints) {
    if (constraint.type === "length") lengthTargets.push(constraint.segment);
    if (constraint.type === "angleMeasure") angleTargets.push(constraint.angle);
  }
  const errors: FigureCandidateError[] = [];
  figure.elements.forEach((element, index) => {
    if (
      (element.type === "segment" || element.type === "line" || element.type === "ray") &&
      element.showLength &&
      !lengthTargets.includes(element.id)
    ) {
      errors.push({ code: "measure_without_constraint", path: ["elements", index, "showLength"] });
    }
    if (element.type === "angle" && element.showMeasure && !angleTargets.includes(element.id)) {
      errors.push({ code: "measure_without_constraint", path: ["elements", index, "showMeasure"] });
    }
  });
  return errors;
}

function failure(figureId: string | undefined, errors: readonly { code: string; path: readonly PropertyKey[] }[]): FigureCandidateResult {
  const sanitized = toRepairErrors(errors);
  return figureId === undefined ? { ok: false, errors: sanitized } : { ok: false, figureId, errors: sanitized };
}

/**
 * AI 도형 후보 1개 검증: schemaVersion → 구조(zod strict) → 의미(`validateFigureSemantics`) →
 * 단계 범위(`step_out_of_range`) → 수치 표시 근거(`measure_without_constraint`).
 *
 * @param options.stepCount 풀이 단계 수. null이면 단계 분할 실패로 보고 단계 범위를 검사하지 않는다.
 */
export function validateFigureCandidate(
  candidate: unknown,
  options: { stepCount: number | null },
): FigureCandidateResult {
  const figureId = readCandidateFigureId(candidate);
  try {
    if (!isRecord(candidate)) return failure(figureId, [{ code: "invalid_type", path: [] }]);
    if (candidate["schemaVersion"] !== FIGURE_SCHEMA_VERSION) {
      return failure(figureId, [{ code: "unsupported_schema_version", path: ["schemaVersion"] }]);
    }
    const parsed = figureSpecSchema.safeParse(candidate);
    if (!parsed.success) return failure(figureId, parsed.error.issues);

    const semantics = validateFigureSemantics(parsed.data);
    if (!semantics.ok) return failure(figureId, semantics.issues);

    const extra = [...checkFigureStepRange(parsed.data, options.stepCount), ...checkMeasureConstraints(parsed.data)];
    if (extra.length > 0) return failure(figureId, extra);

    return { ok: true, figure: parsed.data };
  } catch {
    return failure(figureId, [{ code: "unexpected_error", path: [] }]);
  }
}
