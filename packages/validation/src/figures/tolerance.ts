/**
 * 도형 의미 검증·계산 커널의 허용오차와 계산 상한 — `docs/FIGURE_SPEC.md` §12.
 *
 * 모든 길이 허용오차는 도형의 좌표 스케일 S(= boundingBox 가로·세로 중 큰 값)를 기준으로 한다.
 * 좌표계가 0~1이든 0~1000이든 같은 "화면 대비 비율"로 판정하기 위해서다.
 */

/** 퇴화 판정 비율: 길이가 `DEGENERATE_REL × S`보다 작으면 0으로 본다(같은 점, 길이 0인 선분 등). */
export const DEGENERATE_REL = 1e-6;

/** 길이 비교 상대오차. 두 길이 a, b는 `|a − b| ≤ LENGTH_REL_TOL × max(|a|, |b|, S)`이면 같다고 본다(S 기준 하한 포함). */
export const LENGTH_REL_TOL = 1e-3;

/** 각도 비교 허용오차(도). */
export const ANGLE_TOL_DEG = 0.1;

/** 방향 판정 허용오차: 정규화한 내적(수직)·외적(평행)의 절댓값이 이 값 이하이면 성립. */
export const DIRECTION_TOL = 1e-3;

/** boundingBox 가로·세로 최소값. 이보다 좁으면 의미 있는 도형을 그릴 수 없다. */
export const MIN_BBOX_SPAN = 1e-2;

/** keepAspectRatio인 도형의 boundingBox 가로세로비 상한(1:20). */
export const MAX_BBOX_ASPECT_RATIO = 20;

/** 원의 반지름 상한 비율: 반지름이 `MAX_RADIUS_REL × S`를 넘으면 거부한다. */
export const MAX_RADIUS_REL = 10;

/** 함수 그래프 균등 샘플 수. */
export const GRAPH_SAMPLE_COUNT = 400;

/** 도형 1개당 수식 평가 횟수 예산(샘플·이분 탐색·그래프 위 점 포함). */
export const FIGURE_EVAL_BUDGET = 20_000;

/** 그래프 값의 절댓값 상한. 이보다 크면 "값 없음"으로 보고 선을 끊는다. */
export const MAX_GRAPH_ABS_VALUE = 1e6;

/** 화면 밖 여유 비율: y가 `[bottom − H × r, top + H × r]`(H = 세로 폭) 밖이면 잘라내고 선을 끊는다. */
export const GRAPH_CLIP_MARGIN_REL = 1;

/** 인접 샘플 사이 |Δy|가 `H × 이 값`보다 크면 불연속 여부를 중점·이분 탐색으로 확인한다. */
export const GRAPH_JUMP_TRIGGER_REL = 0.02;

/** 불연속·경계 탐색 시 이분 탐색 최대 단계. */
export const GRAPH_BISECTION_STEPS = 10;

/** 의미 검증 오류 보고 최대 건수. */
export const MAX_SEMANTIC_ISSUES = 10;

/** 좌표 스케일 S = boundingBox 가로·세로 중 큰 값. */
export function figureScale(boundingBox: readonly [number, number, number, number]): number {
  const [left, top, right, bottom] = boundingBox;
  return Math.max(right - left, top - bottom);
}

/** 두 길이가 허용오차 안에서 같은지(S 기준 하한 포함). */
export function lengthsEqual(a: number, b: number, scale: number): boolean {
  return Math.abs(a - b) <= LENGTH_REL_TOL * Math.max(Math.abs(a), Math.abs(b), scale);
}

/** 점과 도형 사이 거리 허용오차(길이 단위). */
export function distanceTolerance(scale: number): number {
  return LENGTH_REL_TOL * scale;
}

/** 퇴화 판정 길이(길이 단위). */
export function degenerateLength(scale: number): number {
  return DEGENERATE_REL * scale;
}
