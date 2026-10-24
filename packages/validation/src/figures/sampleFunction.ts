/**
 * 함수 그래프 샘플러 — `docs/FIGURE_SPEC.md` §12.
 *
 * domain과 boundingBox의 x 범위 교집합에서 균등하게 `GRAPH_SAMPLE_COUNT`개 점을 계산하고, 선으로
 * 이어도 되는 구간끼리 묶은 **조각 배열**을 돌려준다. 렌더러는 조각마다 따로 선을 그린다.
 *
 * 선을 끊는 경우:
 * 1. 값 없음: 비유한수(NaN·±Infinity)이거나 |y| > `MAX_GRAPH_ABS_VALUE`.
 * 2. 화면 밖으로 크게 벗어남: y가 `[bottom − H·r, top + H·r]` 밖(H = 세로 폭, r = `GRAPH_CLIP_MARGIN_REL`).
 * 3. 불연속: 인접 두 점의 |Δy|가 크고(> H·`GRAPH_JUMP_TRIGGER_REL`) 중점 값이 두 값 사이에 있지
 *    않으면, 최대 `GRAPH_BISECTION_STEPS`단계 이분 탐색으로 간격을 좁힌다. 좁혀도 |Δy|가 줄지 않거나
 *    도중에 값 없음을 만나면 불연속(점근선 등)으로 보고 끊는다.
 *
 * 1·2로 끊길 때는 이분 탐색으로 경계에 가까운 점을 하나 더해 선이 화면 가장자리·정의역 끝까지
 * 이어지게 한다. 조각 안의 모든 점은 유한수다. 점이 1개뿐인 조각은 버린다.
 *
 * 모든 수식 평가는 공유 예산(`EvalBudget`)을 1씩 소모한다. 예산이 바닥나면 `compute_budget_exceeded`.
 */
import type { ExprNode } from "shared-types";
import { evaluateExpr } from "./expr";
import type { Vec2 } from "./geometry";
import {
  FIGURE_EVAL_BUDGET,
  GRAPH_BISECTION_STEPS,
  GRAPH_CLIP_MARGIN_REL,
  GRAPH_JUMP_TRIGGER_REL,
  GRAPH_SAMPLE_COUNT,
  MAX_GRAPH_ABS_VALUE,
} from "./tolerance";

export interface EvalBudget {
  remaining: number;
}

export function createEvalBudget(limit: number = FIGURE_EVAL_BUDGET): EvalBudget {
  return { remaining: limit };
}

/**
 * 예산 안에서 수식을 한 번 평가한다. 예산이 없으면 null(평가하지 않음).
 */
export function evaluateWithBudget(expr: ExprNode, x: number, budget: EvalBudget): number | null {
  if (budget.remaining <= 0) return null;
  budget.remaining -= 1;
  return evaluateExpr(expr, x);
}

export interface SampleFunctionOptions {
  domain: readonly [number, number] | null;
  boundingBox: readonly [number, number, number, number];
  budget: EvalBudget;
  /** 테스트용. 기본 `GRAPH_SAMPLE_COUNT`. 2 미만이면 2로 본다. */
  sampleCount?: number;
}

export type SampleFunctionResult =
  | { ok: true; pieces: Vec2[][]; range: [number, number] | null }
  | { ok: false; code: "compute_budget_exceeded" };

/** 값이 "값 있음"인지(유한수, 절댓값 상한 이내). */
export function isDefinedGraphValue(y: number): boolean {
  return Number.isFinite(y) && Math.abs(y) <= MAX_GRAPH_ABS_VALUE;
}

class BudgetExhausted extends Error {}

export function sampleFunctionGraph(expr: ExprNode, options: SampleFunctionOptions): SampleFunctionResult {
  const [left, top, right, bottom] = options.boundingBox;
  const lo = options.domain === null ? left : Math.max(options.domain[0], left);
  const hi = options.domain === null ? right : Math.min(options.domain[1], right);
  if (!(lo < hi)) return { ok: true, pieces: [], range: null };

  const height = top - bottom;
  const yMin = bottom - height * GRAPH_CLIP_MARGIN_REL;
  const yMax = top + height * GRAPH_CLIP_MARGIN_REL;
  const jumpTrigger = height * GRAPH_JUMP_TRIGGER_REL;
  const count = Math.max(2, Math.floor(options.sampleCount ?? GRAPH_SAMPLE_COUNT));
  const { budget } = options;

  const f = (x: number): number => {
    const value = evaluateWithBudget(expr, x, budget);
    if (value === null) throw new BudgetExhausted();
    return value;
  };
  const usable = (y: number): boolean => isDefinedGraphValue(y) && y >= yMin && y <= yMax;

  /**
   * 인접한 두 "쓸 수 있는" 샘플 사이가 불연속인지. |Δy|가 작거나 중점이 두 값 사이면 연속.
   * 아니면 |Δy|가 큰 쪽 절반으로 이분 탐색해, 간격이 줄었는데도 |Δy|가 줄지 않으면 불연속.
   */
  const isDiscontinuous = (x0: number, y0: number, x1: number, y1: number): boolean => {
    const initialJump = Math.abs(y1 - y0);
    if (initialJump <= jumpTrigger) return false;
    let xl = x0;
    let yl = y0;
    let xr = x1;
    let yr = y1;
    for (let step = 0; step < GRAPH_BISECTION_STEPS; step += 1) {
      const xm = (xl + xr) / 2;
      const ym = f(xm);
      if (!isDefinedGraphValue(ym)) return true;
      if (step === 0 && ym >= Math.min(y0, y1) && ym <= Math.max(y0, y1)) return false;
      if (Math.abs(ym - yl) >= Math.abs(yr - ym)) {
        xr = xm;
        yr = ym;
      } else {
        xl = xm;
        yl = ym;
      }
    }
    return Math.abs(yr - yl) >= initialJump;
  };

  /**
   * 쓸 수 있는 점(xGood, yGood)과 쓸 수 없는 점 xBad 사이의 경계를 이분 탐색으로 찾아, 경계에
   * 가장 가까운 쓸 수 있는 점을 돌려준다. 점근선을 건너뛰지 않도록, 나쁜 쪽 값이 유한하면 그
   * 방향으로 단조롭게 움직이는 중점만 받아들인다.
   */
  const refineEdge = (xGood: number, yGood: number, xBad: number, yBad: number): Vec2 | null => {
    let goodX = xGood;
    let goodY = yGood;
    let badX = xBad;
    const direction = Number.isNaN(yBad) ? 0 : yBad > yGood ? 1 : -1;
    for (let step = 0; step < GRAPH_BISECTION_STEPS; step += 1) {
      const xm = (goodX + badX) / 2;
      const ym = f(xm);
      const accepted =
        usable(ym) &&
        (direction > 0 ? ym >= goodY : direction < 0 ? ym <= goodY : Math.abs(ym - goodY) <= jumpTrigger);
      if (accepted) {
        goodX = xm;
        goodY = ym;
      } else {
        badX = xm;
      }
    }
    return goodX === xGood ? null : { x: goodX, y: goodY };
  };

  try {
    const pieces: Vec2[][] = [];
    let current: Vec2[] = [];
    const flush = (): void => {
      if (current.length >= 2) pieces.push(current);
      current = [];
    };

    let prevX = Number.NaN;
    let prevY = Number.NaN;
    let prevUsable = false;
    for (let index = 0; index < count; index += 1) {
      const x = index === count - 1 ? hi : lo + ((hi - lo) * index) / (count - 1);
      const y = f(x);
      const isUsable = usable(y);

      if (index > 0) {
        if (prevUsable && isUsable) {
          if (isDiscontinuous(prevX, prevY, x, y)) flush();
        } else if (prevUsable && !isUsable) {
          const edge = refineEdge(prevX, prevY, x, y);
          if (edge !== null) current.push(edge);
          flush();
        } else if (!prevUsable && isUsable) {
          const edge = refineEdge(x, y, prevX, prevY);
          if (edge !== null) current.push(edge);
        }
      }
      if (isUsable) current.push({ x, y });

      prevX = x;
      prevY = y;
      prevUsable = isUsable;
    }
    flush();
    return { ok: true, pieces, range: [lo, hi] };
  } catch (error) {
    if (error instanceof BudgetExhausted) return { ok: false, code: "compute_budget_exceeded" };
    throw error;
  }
}

/** 조각 중 하나라도 boundingBox의 세로 범위 [bottom, top]를 지나가면 true. */
export function piecesVisible(pieces: readonly (readonly Vec2[])[], top: number, bottom: number): boolean {
  for (const piece of pieces) {
    for (let index = 0; index < piece.length; index += 1) {
      const point = piece[index];
      if (point === undefined) continue;
      if (point.y >= bottom && point.y <= top) return true;
      const next = piece[index + 1];
      if (next !== undefined && Math.min(point.y, next.y) <= top && Math.max(point.y, next.y) >= bottom) return true;
    }
  }
  return false;
}
