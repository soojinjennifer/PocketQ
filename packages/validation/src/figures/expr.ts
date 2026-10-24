/**
 * 제한된 수식 AST(`ExprNode`) 평가기 — `docs/FIGURE_SPEC.md` §3.5, §12.
 *
 * 안전 규칙:
 * - 노드 종류·함수 이름마다 **명시적 switch**로만 분기한다. 이름으로 전역 객체를 동적 조회하거나
 *   문자열을 코드로 실행하는 경로가 없다.
 * - 알 수 없는 노드·함수는 NaN을 돌려준다(throw하지 않음). 그래프 샘플러는 NaN을 "값 없음"으로 끊는다.
 * - 음수 밑에 정수가 아닌 지수는 NaN이다(실수 범위 밖, D5).
 * - 스키마가 깊이를 10으로 제한하지만, 검증되지 않은 입력에 대비해 재귀 깊이 상한을 따로 둔다.
 */
import type { ExprNode } from "shared-types";

/** 평가기 자체의 재귀 깊이 상한(스키마 상한 10보다 넉넉하게). 넘으면 NaN. */
const MAX_EVAL_DEPTH = 64;

function power(base: number, exponent: number): number {
  if (base < 0 && !Number.isInteger(exponent)) return Number.NaN;
  return Math.pow(base, exponent);
}

function applyFn(name: Extract<ExprNode, { type: "fn" }>["name"], value: number): number {
  switch (name) {
    case "sin":
      return Math.sin(value);
    case "cos":
      return Math.cos(value);
    case "tan":
      return Math.tan(value);
    case "sqrt":
      return Math.sqrt(value);
    case "abs":
      return Math.abs(value);
    case "ln":
      return Math.log(value);
    case "log10":
      return Math.log10(value);
    case "exp":
      return Math.exp(value);
    default: {
      const unreachable: never = name;
      void unreachable;
      return Number.NaN;
    }
  }
}

function constantValue(name: Extract<ExprNode, { type: "const" }>["name"]): number {
  switch (name) {
    case "pi":
      return Math.PI;
    case "e":
      return Math.E;
    default: {
      const unreachable: never = name;
      void unreachable;
      return Number.NaN;
    }
  }
}

function evaluateAt(node: ExprNode, x: number, depth: number): number {
  if (depth > MAX_EVAL_DEPTH) return Number.NaN;
  switch (node.type) {
    case "num":
      return node.value;
    case "var":
      return x;
    case "const":
      return constantValue(node.name);
    case "add":
      return evaluateAt(node.args[0], x, depth + 1) + evaluateAt(node.args[1], x, depth + 1);
    case "sub":
      return evaluateAt(node.args[0], x, depth + 1) - evaluateAt(node.args[1], x, depth + 1);
    case "mul":
      return evaluateAt(node.args[0], x, depth + 1) * evaluateAt(node.args[1], x, depth + 1);
    case "div":
      return evaluateAt(node.args[0], x, depth + 1) / evaluateAt(node.args[1], x, depth + 1);
    case "pow":
      return power(evaluateAt(node.args[0], x, depth + 1), evaluateAt(node.args[1], x, depth + 1));
    case "neg":
      return -evaluateAt(node.arg, x, depth + 1);
    case "fn":
      return applyFn(node.name, evaluateAt(node.arg, x, depth + 1));
    default: {
      const unreachable: never = node;
      void unreachable;
      return Number.NaN;
    }
  }
}

/**
 * x에서 수식 값을 계산한다. 정의되지 않은 값(0으로 나누기, 음수의 로그·제곱근 등)은
 * NaN 또는 ±Infinity로 돌아온다. throw하지 않는다.
 */
export function evaluateExpr(node: ExprNode, x: number): number {
  try {
    return evaluateAt(node, x, 1);
  } catch {
    return Number.NaN;
  }
}
